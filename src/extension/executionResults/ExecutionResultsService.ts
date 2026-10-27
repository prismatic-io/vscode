import { addHours } from "date-fns";
import * as vscode from "vscode";
import { log } from "@/extension";
import type { AuthManager } from "@/extension/AuthManager";
import type { StateManager } from "@/extension/StateManager";
import {
  type ApiCredentials,
  fetchExecutionBatches,
  fetchExecutionBatchStepResults,
  fetchExecutionLogs,
  fetchExecutionResults,
  fetchStepOutput,
  fetchStepResultMeta,
  type StepOutput,
} from "./api";
import type {
  ExecutionBatch,
  ExecutionBatchList,
  ExecutionLog,
  ExecutionResult,
  StepResult,
} from "./types";
import { isBatchTerminal, isExecutionTerminal } from "./types";

const DEFAULT_LIMIT = 20;
// Batched executions can fan out into thousands of batches; the tree only
// lists the first page.
const MAX_BATCHES = 100;
const POLL_INTERVAL_MS = 3000;
const IDLE_POLL_INTERVAL_MS = 10000;

// Log poll cadence buckets, keyed on time since execution went terminal.
// Running executions always use TIGHT; post-terminal tails follow this ladder.
const LOG_POLL_TIGHT_MS = 2000;
const LOG_POLL_MEDIUM_MS = 5000;
const LOG_POLL_SLOW_MS = 10000;
const LOG_POLL_TIGHT_WINDOW_MS = 10_000;
const LOG_POLL_MEDIUM_WINDOW_MS = 30_000;
const LOG_POLL_TOTAL_WINDOW_MS = 60_000;

type LogPollBucket = "tight" | "medium" | "slow" | "stop";

interface LogPollState {
  firstSeenTerminalAt: number | null;
  logCount: number;
}

export interface ExecutionResultsServiceDeps {
  stateManager: StateManager;
  authManager: AuthManager;
  pollIntervalMs?: number;
  idlePollIntervalMs?: number;
  limit?: number;
}

export class ExecutionResultsService {
  private readonly _onDidChangeExecutions = new vscode.EventEmitter<void>();
  readonly onDidChangeExecutions = this._onDidChangeExecutions.event;

  private readonly _onDidChangeLogs = new vscode.EventEmitter<string>();
  readonly onDidChangeLogs = this._onDidChangeLogs.event;

  private readonly _onDidChangeStepOutput = new vscode.EventEmitter<{
    executionId: string;
    stepId: string;
  }>();
  readonly onDidChangeStepOutput = this._onDidChangeStepOutput.event;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly logsCache = new Map<string, ExecutionLog[]>();
  private readonly logPollState = new Map<string, LogPollState>();
  private readonly watchedLogIds = new Set<string>();
  private readonly stepOutputCache = new Map<string, StepOutput>();
  // Batches and batch steps are fetched when their tree node expands. The
  // tree re-requests children on every poll, so entries are only reused when
  // fetched after the execution or batch finished (`final`).
  private readonly batchesCache = new Map<
    string,
    { list: ExecutionBatchList; final: boolean }
  >();
  private readonly batchStepsCache = new Map<
    string,
    { executionId: string; steps: StepResult[]; final: boolean }
  >();

  private executions: ExecutionResult[] = [];
  private activeFlowId: string | null = null;
  private paused = true;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingBusy = false;
  private disposed = false;

  private readonly pollIntervalMs: number;
  private readonly idlePollIntervalMs: number;
  private readonly limit: number;

  constructor(private readonly deps: ExecutionResultsServiceDeps) {
    this.pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.idlePollIntervalMs = deps.idlePollIntervalMs ?? IDLE_POLL_INTERVAL_MS;
    this.limit = deps.limit ?? DEFAULT_LIMIT;

    this.disposables.push(
      this._onDidChangeExecutions,
      this._onDidChangeLogs,
      this._onDidChangeStepOutput,
      deps.authManager.onDidChangeAuth(() => this.handleAuthChange()),
    );
  }

  getExecutions(): ExecutionResult[] {
    return this.executions;
  }

  getExecution(executionId: string): ExecutionResult | undefined {
    return this.executions.find((e) => e.id === executionId);
  }

  getCachedLogs(executionId: string): ExecutionLog[] | undefined {
    return this.logsCache.get(executionId);
  }

  // Steps of a batched execution live on its batches, so look there too.
  findStep(executionId: string, stepId: string): StepResult | undefined {
    const direct = this.getExecution(executionId)?.stepResults.find(
      (s) => s.id === stepId,
    );
    if (direct) return direct;

    for (const entry of this.batchStepsCache.values()) {
      if (entry.executionId !== executionId) continue;
      const match = entry.steps.find((s) => s.id === stepId);
      if (match) return match;
    }
    return undefined;
  }

  getCachedStepOutput(
    executionId: string,
    stepId: string,
  ): StepOutput | undefined {
    return this.stepOutputCache.get(stepOutputKey(executionId, stepId));
  }

  setFlowId(flowId: string | null): void {
    if (this.activeFlowId === flowId) return;
    this.activeFlowId = flowId;
    this.executions = [];
    this.logsCache.clear();
    this.logPollState.clear();
    this.watchedLogIds.clear();
    this.stepOutputCache.clear();
    this.batchesCache.clear();
    this.batchStepsCache.clear();
    this._onDidChangeExecutions.fire();
    if (!this.paused) {
      this.kickPoll(0);
    }
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.cancelPoll();
    } else {
      this.kickPoll(0);
    }
  }

  trackLogDoc(executionId: string): void {
    const wasNew = !this.watchedLogIds.has(executionId);
    this.watchedLogIds.add(executionId);
    // Reopening restarts the post-terminal grace window.
    if (wasNew) {
      this.logPollState.delete(executionId);
      if (!this.paused) this.kickPoll(LOG_POLL_TIGHT_MS);
    }
  }

  untrackLogDoc(executionId: string): void {
    this.watchedLogIds.delete(executionId);
    this.logPollState.delete(executionId);
  }

  async refresh(): Promise<void> {
    await this.poll();
  }

  async loadLogs(executionId: string): Promise<ExecutionLog[]> {
    // Cache is the render buffer; polling keeps it fresh while the
    // execution is in its active window. On first read we still need a
    // synchronous fetch so the user sees data immediately.
    if (this.logsCache.has(executionId)) {
      return this.logsCache.get(executionId) ?? [];
    }

    const logs = await this.fetchAndCacheLogs(executionId);
    // Wake the poll loop — a new execution just entered the active set,
    // and we want the next tick to run at its tight cadence.
    if (!this.paused) {
      this.kickPoll(LOG_POLL_TIGHT_MS);
    }
    return logs;
  }

  private async fetchAndCacheLogs(
    executionId: string,
  ): Promise<ExecutionLog[]> {
    const creds = await this.credentials();
    if (!creds) return this.logsCache.get(executionId) ?? [];

    const execution = this.getExecution(executionId);
    const startedDate =
      execution?.startedAt ?? addHours(new Date(), -24).toISOString();

    try {
      const logs = await fetchExecutionLogs({
        ...creds,
        executionId,
        startedDate,
      });
      this.recordLogFetch(executionId, execution, logs);
      return logs;
    } catch (error) {
      log(
        "ERROR",
        `Failed to fetch logs for execution ${executionId}: ${describeError(error)}`,
      );
      return this.logsCache.get(executionId) ?? [];
    }
  }

  // Batch logs are fetched fresh on each open and aren't polled while open.
  async loadBatchLogs(
    executionId: string,
    batchId: string,
  ): Promise<ExecutionLog[]> {
    const creds = await this.credentials();
    if (!creds) return [];

    const execution = this.getExecution(executionId);
    const startedDate =
      execution?.startedAt ?? addHours(new Date(), -24).toISOString();

    try {
      return await fetchExecutionLogs({
        ...creds,
        executionId,
        executionBatchId: batchId,
        startedDate,
      });
    } catch (error) {
      log(
        "ERROR",
        `Failed to fetch logs for batch ${batchId}: ${describeError(error)}`,
      );
      return [];
    }
  }

  async loadBatches(executionId: string): Promise<ExecutionBatchList> {
    const cached = this.batchesCache.get(executionId);
    if (cached?.final) return cached.list;

    const creds = await this.credentials();
    if (!creds) return cached?.list ?? { batches: [], totalCount: 0 };

    const execution = this.getExecution(executionId);
    const final = execution ? isExecutionTerminal(execution) : false;
    try {
      const list = await fetchExecutionBatches({
        ...creds,
        executionId,
        first: MAX_BATCHES,
      });
      this.batchesCache.set(executionId, { list, final });
      return list;
    } catch (error) {
      log(
        "ERROR",
        `Failed to fetch batches for execution ${executionId}: ${describeError(error)}`,
      );
      return cached?.list ?? { batches: [], totalCount: 0 };
    }
  }

  async loadBatchSteps(
    executionId: string,
    batch: ExecutionBatch,
  ): Promise<StepResult[]> {
    const cached = this.batchStepsCache.get(batch.id);
    if (cached?.final) return cached.steps;

    const creds = await this.credentials();
    if (!creds) return cached?.steps ?? [];

    const final = isBatchTerminal(batch);
    try {
      const steps = await fetchExecutionBatchStepResults({
        ...creds,
        batchId: batch.id,
      });
      this.batchStepsCache.set(batch.id, { executionId, steps, final });
      return steps;
    } catch (error) {
      log(
        "ERROR",
        `Failed to fetch steps for batch ${batch.id}: ${describeError(error)}`,
      );
      return cached?.steps ?? [];
    }
  }

  async loadStepOutput(
    executionId: string,
    stepId: string,
  ): Promise<StepOutput | null> {
    const key = stepOutputKey(executionId, stepId);
    const cached = this.stepOutputCache.get(key);
    if (cached) return cached;

    const step = this.findStep(executionId, stepId);
    if (!step) return null;

    const creds = await this.credentials();
    if (!creds) return null;

    try {
      const meta =
        step.resultsMetadataUrl && step.resultsUrl
          ? {
              id: step.id,
              resultsMetadataUrl: step.resultsMetadataUrl,
              resultsUrl: step.resultsUrl,
            }
          : await fetchStepResultMeta({
              ...creds,
              executionId,
              stepId,
              startedAt: step.startedAt,
              endedAt: step.endedAt,
            });

      if (!meta) return null;

      const output = await fetchStepOutput({
        resultsMetadataUrl: meta.resultsMetadataUrl,
        resultsUrl: meta.resultsUrl,
      });

      // Unfinished batch steps aren't diffed by the poll loop, so caching
      // their output would pin a stale preview.
      if (step.endedAt) this.stepOutputCache.set(key, output);
      return output;
    } catch (error) {
      log(
        "ERROR",
        `Failed to fetch step output ${executionId}/${stepId}: ${describeError(error)}`,
      );
      return null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPoll();
    for (const d of this.disposables) d.dispose();
  }

  private cancelPoll(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private kickPoll(delayMs: number): void {
    if (this.disposed || this.paused) return;
    this.cancelPoll();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (this.disposed || this.pollingBusy) return;
    this.pollingBusy = true;

    try {
      await this.pollOnce();
    } finally {
      this.pollingBusy = false;
      if (!this.disposed && !this.paused) {
        this.kickPoll(this.computeNextPollDelay());
      }
    }
  }

  private computeNextPollDelay(): number {
    const candidates: number[] = [this.idlePollIntervalMs];

    if (this.hasInFlightExecutions()) {
      candidates.push(this.pollIntervalMs);
    }

    for (const execution of this.executions) {
      if (!this.watchedLogIds.has(execution.id)) continue;
      const bucket = this.getLogPollBucket(execution);
      if (bucket === "tight") candidates.push(LOG_POLL_TIGHT_MS);
      else if (bucket === "medium") candidates.push(LOG_POLL_MEDIUM_MS);
      else if (bucket === "slow") candidates.push(LOG_POLL_SLOW_MS);
    }

    return Math.min(...candidates);
  }

  private async pollOnce(): Promise<void> {
    const creds = await this.credentials();
    if (!creds) return;

    if (!this.activeFlowId) {
      const workspaceState = await this.deps.stateManager.getWorkspaceState();
      this.activeFlowId = workspaceState?.flow?.id ?? null;
    }

    if (!this.activeFlowId) return;

    const now = new Date();
    const startedDate = addHours(now, -24).toISOString();
    const endedDate = addHours(now, 1).toISOString();

    let nextExecutions: ExecutionResult[];
    try {
      nextExecutions = await fetchExecutionResults({
        ...creds,
        flowId: this.activeFlowId,
        startedDate,
        endedDate,
        limit: this.limit,
      });
    } catch (error) {
      log("ERROR", `Failed to poll executions: ${describeError(error)}`);
      return;
    }

    const changedSteps = diffStepKeys(this.executions, nextExecutions);
    this.executions = nextExecutions;

    for (const key of changedSteps) {
      this.stepOutputCache.delete(key);
      const [executionId, stepId] = splitStepOutputKey(key);
      this._onDidChangeStepOutput.fire({ executionId, stepId });
    }

    this._onDidChangeExecutions.fire();

    for (const execution of nextExecutions) {
      await this.refreshLogsIfNeeded(execution, creds);
    }
  }

  private async refreshLogsIfNeeded(
    execution: ExecutionResult,
    creds: ApiCredentials,
  ): Promise<void> {
    if (!this.watchedLogIds.has(execution.id)) return;
    if (this.getLogPollBucket(execution) === "stop") return;

    try {
      const logs = await fetchExecutionLogs({
        ...creds,
        executionId: execution.id,
        startedDate: execution.startedAt,
      });

      if (this.recordLogFetch(execution.id, execution, logs)) {
        this._onDidChangeLogs.fire(execution.id);
      }
    } catch (error) {
      log(
        "ERROR",
        `Failed to poll logs for ${execution.id}: ${describeError(error)}`,
      );
    }
  }

  private recordLogFetch(
    executionId: string,
    execution: ExecutionResult | undefined,
    logs: ExecutionLog[],
  ): boolean {
    const prev = this.logsCache.get(executionId);
    const countChanged = !prev || prev.length !== logs.length;
    this.logsCache.set(executionId, logs);

    // Track post-terminal window start. Running executions reset the marker
    // (a re-entry shouldn't happen, but this keeps state sane).
    const prevState = this.logPollState.get(executionId);
    const isTerminal = execution ? isExecutionTerminal(execution) : true;
    this.logPollState.set(executionId, {
      firstSeenTerminalAt: isTerminal
        ? (prevState?.firstSeenTerminalAt ?? Date.now())
        : null,
      logCount: logs.length,
    });

    return countChanged;
  }

  private getLogPollBucket(execution: ExecutionResult): LogPollBucket {
    if (!isExecutionTerminal(execution)) return "tight";

    const state = this.logPollState.get(execution.id);
    // No state yet means we haven't fetched once post-terminal; fetch now.
    const terminalAt = state?.firstSeenTerminalAt ?? Date.now();
    const sinceTerminal = Date.now() - terminalAt;

    if (sinceTerminal < LOG_POLL_TIGHT_WINDOW_MS) return "tight";
    if (sinceTerminal < LOG_POLL_MEDIUM_WINDOW_MS) return "medium";
    if (sinceTerminal < LOG_POLL_TOTAL_WINDOW_MS) return "slow";
    return "stop";
  }

  private hasInFlightExecutions(): boolean {
    return this.executions.some((e) => !isExecutionTerminal(e));
  }

  private async credentials(): Promise<ApiCredentials | null> {
    try {
      const globalState = await this.deps.stateManager.getGlobalState();
      const prismaticUrl = globalState?.prismaticUrl;
      if (!prismaticUrl) return null;

      const accessToken = await this.deps.authManager.getAccessToken();
      return { accessToken, prismaticUrl };
    } catch {
      return null;
    }
  }

  private handleAuthChange(): void {
    this.executions = [];
    this.logsCache.clear();
    this.logPollState.clear();
    this.watchedLogIds.clear();
    this.stepOutputCache.clear();
    this.batchesCache.clear();
    this.batchStepsCache.clear();
    this._onDidChangeExecutions.fire();
    if (!this.paused) {
      this.kickPoll(0);
    }
  }
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const STEP_OUTPUT_KEY_SEPARATOR = "::";

const stepOutputKey = (executionId: string, stepId: string): string =>
  `${executionId}${STEP_OUTPUT_KEY_SEPARATOR}${stepId}`;

const splitStepOutputKey = (key: string): [string, string] => {
  const idx = key.indexOf(STEP_OUTPUT_KEY_SEPARATOR);
  return [key.slice(0, idx), key.slice(idx + STEP_OUTPUT_KEY_SEPARATOR.length)];
};

const diffStepKeys = (
  prev: ExecutionResult[],
  next: ExecutionResult[],
): Set<string> => {
  const steps = new Set<string>();
  const prevById = new Map(prev.map((e) => [e.id, e]));

  for (const execution of next) {
    const existing = prevById.get(execution.id);
    const prevStepsById = new Map(
      (existing?.stepResults ?? []).map((s) => [s.id, s]),
    );

    for (const step of execution.stepResults) {
      const prevStep = prevStepsById.get(step.id);
      if (!prevStep) {
        steps.add(stepOutputKey(execution.id, step.id));
        continue;
      }
      if (
        prevStep.endedAt !== step.endedAt ||
        prevStep.hasError !== step.hasError ||
        prevStep.resultsMetadataUrl !== step.resultsMetadataUrl ||
        prevStep.resultsUrl !== step.resultsUrl
      ) {
        steps.add(stepOutputKey(execution.id, step.id));
      }
    }
  }

  return steps;
};
