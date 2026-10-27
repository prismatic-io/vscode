import { describe, expect, it, vi } from "vitest";

vi.mock(import("@/extension"), () => ({
  log: vi.fn(),
}));

const fetchExecutionResultsMock = vi.fn();
const fetchExecutionLogsMock = vi.fn();
const fetchExecutionBatchesMock = vi.fn();
const fetchExecutionBatchStepResultsMock = vi.fn();

vi.mock(import("./api"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    fetchExecutionResults: (...args: unknown[]) =>
      fetchExecutionResultsMock(...args),
    fetchExecutionLogs: (...args: unknown[]) => fetchExecutionLogsMock(...args),
    fetchExecutionBatches: (...args: unknown[]) =>
      fetchExecutionBatchesMock(...args),
    fetchExecutionBatchStepResults: (...args: unknown[]) =>
      fetchExecutionBatchStepResultsMock(...args),
  };
});

import * as vscode from "vscode";
import { ExecutionResultsService } from "./ExecutionResultsService";
import {
  type ExecutionBatch,
  ExecutionBatchStatus,
  type ExecutionResult,
  InstanceExecutionResultResultType,
  type StepResult,
} from "./types";

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const makeExecution = (
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult => ({
  id: "exec-1",
  invokeType: null,
  startedAt: "2026-04-17T12:00:00Z",
  resultType: InstanceExecutionResultResultType.COMPLETED,
  endedAt: "2026-04-17T12:00:05Z",
  error: null,
  stepResults: [],
  usesBatching: false,
  batchProgress: null,
  ...overrides,
});

const makeBatch = (
  overrides: Partial<ExecutionBatch> = {},
): ExecutionBatch => ({
  id: "batch-1",
  status: ExecutionBatchStatus.COMPLETED,
  recordCount: 10,
  errorMessage: null,
  startedAt: "2026-04-17T12:00:00Z",
  completedAt: "2026-04-17T12:00:05Z",
  ...overrides,
});

const makeStep = (overrides: Partial<StepResult> = {}): StepResult => ({
  id: "step-1",
  startedAt: "2026-04-17T12:00:00Z",
  endedAt: "2026-04-17T12:00:05Z",
  stepName: "fetch",
  displayStepName: "Fetch",
  hasError: false,
  resultsMetadataUrl: "https://meta",
  resultsUrl: "https://results",
  ...overrides,
});

const makeDeps = (flowId: string | null = "flow-1") => {
  const authEmitter = new vscode.EventEmitter<void>();
  return {
    stateManager: {
      getGlobalState: vi.fn().mockResolvedValue({
        prismaticUrl: "https://example",
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        flow: flowId ? { id: flowId, name: "f", stableKey: "f" } : undefined,
      }),
    },
    authManager: {
      getAccessToken: vi.fn().mockResolvedValue("access-token"),
      onDidChangeAuth: authEmitter.event,
    },
    authEmitter,
  };
};

describe("ExecutionResultsService", () => {
  it("does not poll while paused", async () => {
    fetchExecutionResultsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10,
      idlePollIntervalMs: 10,
    });

    await tick();
    expect(fetchExecutionResultsMock).not.toHaveBeenCalled();
    service.dispose();
  });

  it("polls on unpause and uses the active flow", async () => {
    fetchExecutionResultsMock.mockResolvedValue([makeExecution()]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps("flow-7");
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
      idlePollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh();

    expect(fetchExecutionResultsMock).toHaveBeenCalledTimes(1);
    const call = fetchExecutionResultsMock.mock.calls[0][0];
    expect(call.flowId).toBe("flow-7");
    expect(call.prismaticUrl).toBe("https://example");
    expect(service.getExecutions()).toHaveLength(1);
    service.dispose();
  });

  it("fires onDidChangeExecutions when results arrive", async () => {
    fetchExecutionResultsMock.mockResolvedValue([makeExecution()]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    let count = 0;
    service.onDidChangeExecutions(() => {
      count++;
    });

    service.setPaused(false);
    await service.refresh();

    expect(count).toBeGreaterThanOrEqual(1);
    service.dispose();
  });

  it("clears cache and refires on auth change", async () => {
    fetchExecutionResultsMock.mockResolvedValue([makeExecution()]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh();
    expect(service.getExecutions()).toHaveLength(1);

    deps.authEmitter.fire();
    expect(service.getExecutions()).toEqual([]);
    service.dispose();
  });

  it("clears cached state when the flow id changes", async () => {
    fetchExecutionResultsMock.mockResolvedValue([makeExecution()]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    service.setFlowId("flow-1");
    await service.refresh();
    expect(service.getExecutions()).toHaveLength(1);

    service.setFlowId("flow-2");
    expect(service.getExecutions()).toEqual([]);
    service.dispose();
  });

  it("skips polling when no flow is selected", async () => {
    fetchExecutionResultsMock.mockResolvedValue([]);
    const deps = makeDeps(null);
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh();

    expect(fetchExecutionResultsMock).not.toHaveBeenCalled();
    service.dispose();
  });

  it("keeps polling logs for a terminal execution within the post-terminal window", async () => {
    const terminalExecution = makeExecution();
    fetchExecutionResultsMock.mockResolvedValue([terminalExecution]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    // Simulate a log doc being opened, then load the initial payload.
    service.setPaused(false);
    service.trackLogDoc(terminalExecution.id);
    await service.loadLogs(terminalExecution.id);
    const initialFetchCount = fetchExecutionLogsMock.mock.calls.length;

    // A subsequent poll should still fetch logs (post-terminal grace window).
    await service.refresh();
    expect(fetchExecutionLogsMock.mock.calls.length).toBeGreaterThan(
      initialFetchCount,
    );

    service.dispose();
  });

  it("stops polling logs once the post-terminal window expires", async () => {
    const terminalExecution = makeExecution();
    fetchExecutionResultsMock.mockResolvedValue([terminalExecution]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.loadLogs(terminalExecution.id);

    // Backdate the post-terminal marker past the 60s window.
    const internal = service as unknown as {
      logPollState: Map<string, { firstSeenTerminalAt: number | null }>;
    };
    internal.logPollState.set(terminalExecution.id, {
      firstSeenTerminalAt: Date.now() - 120_000,
    });

    const countBefore = fetchExecutionLogsMock.mock.calls.length;
    await service.refresh();
    expect(fetchExecutionLogsMock.mock.calls.length).toBe(countBefore);

    service.dispose();
  });

  it("fires onDidChangeLogs when a later poll picks up more logs", async () => {
    const terminalExecution = makeExecution();
    fetchExecutionResultsMock.mockResolvedValue([terminalExecution]);
    fetchExecutionLogsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        message: "late arrival",
        severity: "INFO",
        stepName: null,
        timestamp: "2026-04-17T12:00:10Z",
      },
    ]);

    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    service.trackLogDoc(terminalExecution.id);
    await service.loadLogs(terminalExecution.id);

    const fired: string[] = [];
    service.onDidChangeLogs((id) => fired.push(id));

    await service.refresh();
    expect(fired).toContain(terminalExecution.id);

    service.dispose();
  });

  it("does not poll logs for executions without an open log doc", async () => {
    fetchExecutionResultsMock.mockResolvedValue([makeExecution()]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh();

    expect(fetchExecutionResultsMock).toHaveBeenCalledTimes(1);
    expect(fetchExecutionLogsMock).not.toHaveBeenCalled();

    service.dispose();
  });

  it("fires onDidChangeStepOutput and clears cache when a step transitions", async () => {
    const running = makeExecution({
      endedAt: null,
      stepResults: [
        {
          id: "step-1",
          startedAt: "2026-04-17T12:00:00Z",
          endedAt: null,
          stepName: "fetch",
          displayStepName: "Fetch",
          hasError: false,
          resultsMetadataUrl: "",
          resultsUrl: "",
        },
      ],
    });
    const finished: ExecutionResult = {
      ...running,
      endedAt: "2026-04-17T12:00:05Z",
      stepResults: [
        {
          ...running.stepResults[0],
          endedAt: "2026-04-17T12:00:05Z",
          resultsMetadataUrl: "https://meta",
          resultsUrl: "https://results",
        },
      ],
    };

    fetchExecutionResultsMock
      .mockResolvedValueOnce([running])
      .mockResolvedValueOnce([finished]);
    fetchExecutionLogsMock.mockResolvedValue([]);

    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    // Seed a stale cache entry and subscribe to the change event.
    const internal = service as unknown as {
      stepOutputCache: Map<string, unknown>;
    };
    internal.stepOutputCache.set("exec-1::step-1", { data: "stale" });

    service.setPaused(false);
    await service.refresh(); // seed with "running"

    const fired: Array<{ executionId: string; stepId: string }> = [];
    service.onDidChangeStepOutput((ev) => fired.push(ev));

    await service.refresh(); // "finished" → step transitioned
    expect(fired).toEqual([{ executionId: "exec-1", stepId: "step-1" }]);
    expect(internal.stepOutputCache.has("exec-1::step-1")).toBe(false);

    service.dispose();
  });

  it("stops polling logs once the doc is untracked", async () => {
    const exec = makeExecution();
    fetchExecutionResultsMock.mockResolvedValue([exec]);
    fetchExecutionLogsMock.mockResolvedValue([]);
    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    service.trackLogDoc(exec.id);
    await service.refresh();
    const afterOpen = fetchExecutionLogsMock.mock.calls.length;
    expect(afterOpen).toBeGreaterThan(0);

    service.untrackLogDoc(exec.id);
    await service.refresh();
    expect(fetchExecutionLogsMock.mock.calls.length).toBe(afterOpen);

    service.dispose();
  });

  it("refetches batches and batch steps until they finish", async () => {
    const running = makeExecution({ endedAt: null, usesBatching: true });
    const finished: ExecutionResult = {
      ...running,
      endedAt: "2026-04-17T12:00:05Z",
    };
    fetchExecutionResultsMock
      .mockResolvedValueOnce([running])
      .mockResolvedValue([finished]);
    fetchExecutionBatchesMock.mockResolvedValue({
      batches: [makeBatch()],
      totalCount: 1,
    });
    fetchExecutionBatchStepResultsMock.mockResolvedValue([makeStep()]);

    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh(); // running
    await service.loadBatches(running.id);
    await service.loadBatches(running.id);
    expect(fetchExecutionBatchesMock).toHaveBeenCalledTimes(2);

    await service.refresh(); // finished
    await service.loadBatches(running.id); // first fetch after finishing
    await service.loadBatches(running.id); // served from cache
    expect(fetchExecutionBatchesMock).toHaveBeenCalledTimes(3);

    const runningBatch = makeBatch({ completedAt: null });
    await service.loadBatchSteps(running.id, runningBatch);
    await service.loadBatchSteps(running.id, runningBatch);
    expect(fetchExecutionBatchStepResultsMock).toHaveBeenCalledTimes(2);

    await service.loadBatchSteps(running.id, makeBatch()); // first fetch after finishing
    await service.loadBatchSteps(running.id, makeBatch()); // served from cache
    expect(fetchExecutionBatchStepResultsMock).toHaveBeenCalledTimes(3);
    expect(service.findStep(running.id, "step-1")).toBeDefined();

    service.dispose();
  });

  it("fetches batch logs scoped to the batch without tracking them", async () => {
    const exec = makeExecution({ usesBatching: true });
    fetchExecutionResultsMock.mockResolvedValue([exec]);
    fetchExecutionLogsMock.mockResolvedValue([]);

    const deps = makeDeps();
    const service = new ExecutionResultsService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      pollIntervalMs: 10_000,
    });

    service.setPaused(false);
    await service.refresh();
    await service.loadBatchLogs(exec.id, "batch-1");

    expect(fetchExecutionLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: exec.id,
        executionBatchId: "batch-1",
        startedDate: exec.startedAt,
      }),
    );

    fetchExecutionLogsMock.mockClear();
    await service.refresh();
    expect(fetchExecutionLogsMock).not.toHaveBeenCalled();

    service.dispose();
  });
});
