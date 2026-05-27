import { describe, expect, it, vi } from "vitest";

vi.mock(import("@/extension"), () => ({
  log: vi.fn(),
}));

const fetchBatchSnapshotMock = vi.fn();
const fetchBatchDetailMock = vi.fn();
const cancelBatchExecutionMock = vi.fn();

vi.mock(import("./api"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    fetchBatchSnapshot: (...args: unknown[]) => fetchBatchSnapshotMock(...args),
    fetchBatchDetail: (...args: unknown[]) => fetchBatchDetailMock(...args),
    cancelBatchExecution: (...args: unknown[]) =>
      cancelBatchExecutionMock(...args),
  };
});

import * as vscode from "vscode";
import { BatchProgressService } from "./BatchProgressService";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import type {
  BatchExecutionSnapshot,
  ExecutionBatchNode,
  ExecutionResult,
} from "./types";

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const makeSnapshot = (
  overrides: Partial<BatchExecutionSnapshot> = {},
): BatchExecutionSnapshot => ({
  id: "exec-1",
  usesBatching: true,
  status: "RUNNING",
  cancelRequestedAt: null,
  canceledBy: null,
  registeredBatchCount: 0,
  triggerResolverBatchSize: null,
  batchProgress: {
    discovered: 0,
    discoveryComplete: false,
    completed: 0,
    failed: 0,
    canceled: 0,
    queued: 0,
    running: 0,
    total: 0,
    concurrencyLimit: null,
    concurrencyLimitSource: null,
  },
  ...overrides,
});

const makeBatchNode = (
  overrides: Partial<ExecutionBatchNode> = {},
): ExecutionBatchNode => ({
  id: "batch-1",
  displayKey: "batch-0001",
  role: "processing",
  status: "running",
  recordCount: 1,
  stepCount: 0,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
  label: "1 record",
  ...overrides,
});

const makeExecution = (
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult => ({
  id: "exec-1",
  invokeType: null,
  startedAt: "2026-05-20T00:00:00Z",
  resultType: null,
  status: null,
  endedAt: null,
  error: null,
  stepResults: [],
  usesBatching: true,
  batchProgress: null,
  cancelRequestedAt: null,
  canceledBy: null,
  registeredBatchCount: null,
  triggerResolverBatchSize: null,
  ...overrides,
});

const makeDeps = (executions: ExecutionResult[] = []) => {
  const authEmitter = new vscode.EventEmitter<void>();
  const parentEmitter = new vscode.EventEmitter<void>();
  const executionResultsService = {
    getExecutions: () => executions,
    getExecution: (id: string) => executions.find((e) => e.id === id),
    onDidChangeExecutions: parentEmitter.event,
  } as unknown as ExecutionResultsService;

  return {
    stateManager: {
      getGlobalState: vi.fn().mockResolvedValue({
        prismaticUrl: "https://example",
      }),
    },
    authManager: {
      getAccessToken: vi.fn().mockResolvedValue("access-token"),
      onDidChangeAuth: authEmitter.event,
    },
    executionResultsService,
    authEmitter,
    parentEmitter,
    setExecutions(next: ExecutionResult[]) {
      executions.splice(0, executions.length, ...next);
    },
  };
};

describe("BatchProgressService", () => {
  it("primes a subscription with snapshot + detail", async () => {
    fetchBatchSnapshotMock.mockResolvedValue(makeSnapshot());
    fetchBatchDetailMock.mockResolvedValue({
      nodes: [makeBatchNode()],
      endCursor: null,
      hasNextPage: false,
      totalCount: 1,
    });
    const deps = makeDeps([makeExecution()]);
    const service = new BatchProgressService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      executionResultsService: deps.executionResultsService,
    });

    service.subscribe("exec-1");
    await tick();
    await tick();
    await tick();

    expect(fetchBatchSnapshotMock).toHaveBeenCalledTimes(1);
    expect(fetchBatchDetailMock).toHaveBeenCalledTimes(1);
    expect(service.getBatches("exec-1")).toHaveLength(1);
    expect(service.totalCount("exec-1")).toBe(1);
    service.dispose();
  });

  it("emits onDidChangeBatches when snapshot lands", async () => {
    fetchBatchSnapshotMock.mockResolvedValue(makeSnapshot());
    fetchBatchDetailMock.mockResolvedValue({
      nodes: [],
      endCursor: null,
      hasNextPage: false,
      totalCount: 0,
    });
    const deps = makeDeps([makeExecution()]);
    const service = new BatchProgressService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      executionResultsService: deps.executionResultsService,
    });

    const seen: string[] = [];
    service.onDidChangeBatches((id) => seen.push(id));
    service.subscribe("exec-1");

    await tick();
    await tick();
    await tick();

    expect(seen).toContain("exec-1");
    service.dispose();
  });

  it("clears state on auth change", async () => {
    fetchBatchSnapshotMock.mockResolvedValue(makeSnapshot());
    fetchBatchDetailMock.mockResolvedValue({
      nodes: [makeBatchNode()],
      endCursor: null,
      hasNextPage: false,
      totalCount: 1,
    });
    const deps = makeDeps([makeExecution()]);
    const service = new BatchProgressService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      executionResultsService: deps.executionResultsService,
    });

    service.subscribe("exec-1");
    await tick();
    await tick();
    await tick();
    expect(service.getBatches("exec-1")).toHaveLength(1);

    deps.authEmitter.fire();
    expect(service.getBatches("exec-1")).toEqual([]);
    service.dispose();
  });

  it("cancel calls the mutation then refreshes", async () => {
    fetchBatchSnapshotMock.mockResolvedValue(makeSnapshot());
    fetchBatchDetailMock.mockResolvedValue({
      nodes: [],
      endCursor: null,
      hasNextPage: false,
      totalCount: 0,
    });
    cancelBatchExecutionMock.mockResolvedValue({ id: "exec-1" });
    const deps = makeDeps([makeExecution()]);
    const service = new BatchProgressService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      executionResultsService: deps.executionResultsService,
    });

    service.subscribe("exec-1");
    await tick();
    await tick();
    await tick();
    fetchBatchSnapshotMock.mockClear();

    await service.cancel("exec-1");
    expect(cancelBatchExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-1" }),
    );
    expect(fetchBatchSnapshotMock).toHaveBeenCalled();
    service.dispose();
  });

  it("loadMore appends the next page", async () => {
    fetchBatchSnapshotMock.mockResolvedValue(makeSnapshot());
    fetchBatchDetailMock.mockResolvedValueOnce({
      nodes: [makeBatchNode({ id: "b1" })],
      endCursor: "cursor-1",
      hasNextPage: true,
      totalCount: 2,
    });
    const deps = makeDeps([makeExecution()]);
    const service = new BatchProgressService({
      // biome-ignore lint/suspicious/noExplicitAny: test double
      stateManager: deps.stateManager as any,
      // biome-ignore lint/suspicious/noExplicitAny: test double
      authManager: deps.authManager as any,
      executionResultsService: deps.executionResultsService,
    });

    service.subscribe("exec-1");
    await tick();
    await tick();
    await tick();

    fetchBatchDetailMock.mockResolvedValueOnce({
      nodes: [makeBatchNode({ id: "b2" })],
      endCursor: null,
      hasNextPage: false,
      totalCount: 2,
    });

    await service.loadMore("exec-1");
    expect(service.getBatches("exec-1").map((n) => n.id).sort()).toEqual([
      "b1",
      "b2",
    ]);
    service.dispose();
  });
});
