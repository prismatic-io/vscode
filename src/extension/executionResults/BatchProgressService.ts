import * as vscode from "vscode";
import { log } from "@/extension";
import type { AuthManager } from "@/extension/AuthManager";
import type { StateManager } from "@/extension/StateManager";
import {
  type ApiCredentials,
  cancelBatchExecution,
  fetchBatchDetail,
  fetchBatchSnapshot,
} from "./api";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import type {
  BatchExecutionSnapshot,
  ExecutionBatchNode,
  ExecutionResult,
} from "./types";
import { isExecutionBatched } from "./types";

const TIGHT_MS = 1500;
const MEDIUM_MS = 5000;
const SLOW_MS = 10_000;
const TIGHT_WINDOW_MS = 10_000;
const MEDIUM_WINDOW_MS = 30_000;
const TOTAL_WINDOW_MS = 60_000;

const SUBSCRIBER_TTL_MS = 30_000;

type Bucket = "tight" | "medium" | "slow" | "stop";

interface SubscriberState {
  snapshot: BatchExecutionSnapshot | null;
  nodes: ExecutionBatchNode[];
  cursor: string | null;
  hasMore: boolean;
  totalCount: number;
  errorStreak: number;
  lastTouchedAt: number;
  endedTerminalAt: number | null;
  loading: boolean;
}

export interface BatchProgressServiceDeps {
  stateManager: StateManager;
  authManager: AuthManager;
  executionResultsService: ExecutionResultsService;
  pollIntervalMs?: number;
}

export class BatchProgressService {
  private readonly _onDidChangeBatches = new vscode.EventEmitter<string>();
  readonly onDidChangeBatches = this._onDidChangeBatches.event;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly states = new Map<string, SubscriberState>();

  private paused = true;
  private disposed = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingBusy = false;

  constructor(private readonly deps: BatchProgressServiceDeps) {
    this.disposables.push(
      this._onDidChangeBatches,
      deps.authManager.onDidChangeAuth(() => this.handleAuthChange()),
      deps.executionResultsService.onDidChangeExecutions(() =>
        this.handleParentChange(),
      ),
    );
  }

  getSnapshot(executionId: string): BatchExecutionSnapshot | null {
    const state = this.states.get(executionId);
    if (!state) return null;
    state.lastTouchedAt = Date.now();
    return state.snapshot;
  }

  getBatches(executionId: string): ExecutionBatchNode[] {
    const state = this.states.get(executionId);
    if (!state) return [];
    state.lastTouchedAt = Date.now();
    return state.nodes;
  }

  hasMore(executionId: string): boolean {
    return this.states.get(executionId)?.hasMore ?? false;
  }

  totalCount(executionId: string): number {
    return this.states.get(executionId)?.totalCount ?? 0;
  }

  isLoading(executionId: string): boolean {
    return this.states.get(executionId)?.loading ?? false;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.cancelPoll();
    } else if (this.states.size > 0) {
      this.kickPoll(0);
    }
  }

  subscribe(executionId: string): void {
    const existing = this.states.get(executionId);
    if (existing) {
      existing.lastTouchedAt = Date.now();
      return;
    }
    this.states.set(executionId, {
      snapshot: null,
      nodes: [],
      cursor: null,
      hasMore: false,
      totalCount: 0,
      errorStreak: 0,
      lastTouchedAt: Date.now(),
      endedTerminalAt: null,
      loading: true,
    });
    void this.primeSubscription(executionId);
    if (!this.paused) this.kickPoll(TIGHT_MS);
  }

  unsubscribe(executionId: string): void {
    this.states.delete(executionId);
  }

  async refresh(executionId: string): Promise<void> {
    await this.pollOne(executionId, { resetCursor: true });
  }

  async loadMore(executionId: string): Promise<void> {
    const state = this.states.get(executionId);
    if (!state || !state.hasMore || !state.cursor) return;
    const creds = await this.credentials();
    if (!creds) return;
    try {
      const page = await fetchBatchDetail({
        ...creds,
        executionId,
        after: state.cursor,
      });
      state.nodes = mergeBatchNodes(state.nodes, page.nodes);
      state.cursor = page.endCursor;
      state.hasMore = page.hasNextPage;
      state.totalCount = page.totalCount || state.totalCount;
      this._onDidChangeBatches.fire(executionId);
    } catch (error) {
      log(
        "ERROR",
        `Failed to load more batches for ${executionId}: ${describeError(error)}`,
      );
    }
  }

  async cancel(executionId: string): Promise<void> {
    const creds = await this.credentials();
    if (!creds) throw new Error("Not authenticated");
    await cancelBatchExecution({ ...creds, executionId });
    await this.refresh(executionId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPoll();
    for (const d of this.disposables) d.dispose();
    this.states.clear();
  }

  private async primeSubscription(executionId: string): Promise<void> {
    const creds = await this.credentials();
    if (!creds) return;
    const state = this.states.get(executionId);
    if (!state) return;

    try {
      const [snapshot, page] = await Promise.all([
        fetchBatchSnapshot({ ...creds, executionId }),
        fetchBatchDetail({ ...creds, executionId }),
      ]);
      state.snapshot = snapshot;
      state.nodes = page.nodes;
      state.cursor = page.endCursor;
      state.hasMore = page.hasNextPage;
      state.totalCount = page.totalCount;
      state.errorStreak = 0;
      state.loading = false;
      this._onDidChangeBatches.fire(executionId);
    } catch (error) {
      state.errorStreak += 1;
      state.loading = false;
      log(
        "ERROR",
        `Failed to prime batch subscription ${executionId}: ${describeError(error)}`,
      );
    }
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
      const ids = Array.from(this.states.keys());
      for (const id of ids) {
        const state = this.states.get(id);
        if (!state) continue;
        const ttlExpired = Date.now() - state.lastTouchedAt > SUBSCRIBER_TTL_MS;
        const isUntracked = this.isUntracked(id);
        if (ttlExpired && isUntracked) {
          this.states.delete(id);
          continue;
        }
        if (this.bucketFor(id) === "stop") continue;
        await this.pollOne(id, { resetCursor: false });
      }
    } finally {
      this.pollingBusy = false;
      if (!this.disposed && !this.paused && this.states.size > 0) {
        this.kickPoll(this.computeNextPollDelay());
      }
    }
  }

  private async pollOne(
    executionId: string,
    options: { resetCursor: boolean },
  ): Promise<void> {
    const creds = await this.credentials();
    if (!creds) return;
    const state = this.states.get(executionId);
    if (!state) return;

    try {
      const snapshot = await fetchBatchSnapshot({ ...creds, executionId });
      state.snapshot = snapshot;
      state.errorStreak = 0;

      // Top-of-list re-fetch keeps the most recent N batches fresh.
      const page = await fetchBatchDetail({
        ...creds,
        executionId,
        after: options.resetCursor ? null : null,
      });
      state.nodes = mergeBatchNodes(state.nodes, page.nodes);
      // First page cursor is the head; further pages are appended via loadMore.
      if (state.nodes.length <= page.nodes.length) {
        state.cursor = page.endCursor;
        state.hasMore = page.hasNextPage;
      }
      state.totalCount = page.totalCount || state.totalCount;
      this._onDidChangeBatches.fire(executionId);
    } catch (error) {
      state.errorStreak += 1;
      log(
        "ERROR",
        `Failed to poll batches for ${executionId}: ${describeError(error)}`,
      );
    }
  }

  private bucketFor(executionId: string): Bucket {
    const state = this.states.get(executionId);
    if (!state) return "stop";
    const snapshot = state.snapshot;
    const parent = this.deps.executionResultsService.getExecution(executionId);

    const discoveryComplete = snapshot?.batchProgress?.discoveryComplete ?? false;
    const cancelPending = Boolean(
      snapshot?.cancelRequestedAt && snapshot.status !== "CANCELED",
    );

    if (!discoveryComplete) return "tight";
    if (cancelPending) return "tight";

    const parentEndedAt = parent?.endedAt ?? null;
    if (!parentEndedAt) {
      // No parent terminal signal yet — keep tight while work might still drop in.
      const stillBusy =
        (snapshot?.batchProgress?.running ?? 0) +
          (snapshot?.batchProgress?.queued ?? 0) >
        0;
      return stillBusy ? "tight" : "medium";
    }

    if (state.endedTerminalAt === null) state.endedTerminalAt = Date.now();
    const since = Date.now() - state.endedTerminalAt;
    if (since < TIGHT_WINDOW_MS) return "tight";
    if (since < MEDIUM_WINDOW_MS) return "medium";
    if (since < TOTAL_WINDOW_MS) return "slow";

    const stillBusy =
      (snapshot?.batchProgress?.running ?? 0) +
        (snapshot?.batchProgress?.queued ?? 0) >
      0;
    if (stillBusy || !discoveryComplete) return "slow";
    return "stop";
  }

  private computeNextPollDelay(): number {
    let delay = SLOW_MS;
    for (const id of this.states.keys()) {
      const bucket = this.bucketFor(id);
      if (bucket === "tight") return TIGHT_MS;
      if (bucket === "medium" && delay > MEDIUM_MS) delay = MEDIUM_MS;
    }
    return delay;
  }

  private isUntracked(executionId: string): boolean {
    return !this.deps.executionResultsService.getExecution(executionId);
  }

  private handleParentChange(): void {
    let needsTick = false;
    for (const execution of this.deps.executionResultsService.getExecutions()) {
      if (!this.states.has(execution.id)) continue;
      if (!isExecutionBatched(execution as ExecutionResult)) continue;
      needsTick = true;
    }
    if (needsTick && !this.paused) {
      this.kickPoll(TIGHT_MS);
    }
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
    this.states.clear();
    this.cancelPoll();
  }
}

const mergeBatchNodes = (
  existing: ExecutionBatchNode[],
  next: ExecutionBatchNode[],
): ExecutionBatchNode[] => {
  if (existing.length === 0) return next;
  const byId = new Map(existing.map((node) => [node.id, node]));
  for (const node of next) byId.set(node.id, node);
  return Array.from(byId.values());
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
