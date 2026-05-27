import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import type { BatchProgressService } from "./BatchProgressService";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import {
  BatchNode,
  ExecutionNode,
  ExecutionsTreeDataProvider,
  LoadingNode,
  LoadMoreNode,
  StepNode,
} from "./ExecutionsTreeDataProvider";
import type { ExecutionBatchNode } from "./types";
import {
  type ExecutionResult,
  InstanceExecutionResultResultType,
  type StepResult,
} from "./types";

const makeStep = (overrides: Partial<StepResult> = {}): StepResult => ({
  id: "step-1",
  startedAt: "2026-04-17T12:00:00Z",
  endedAt: "2026-04-17T12:00:05Z",
  stepName: "fetch",
  displayStepName: "Fetch Users",
  hasError: false,
  resultsMetadataUrl: "https://meta",
  resultsUrl: "https://results",
  ...overrides,
});

const makeExecution = (
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult => ({
  id: "exec-1",
  invokeType: null,
  startedAt: "2026-04-17T12:00:00Z",
  resultType: InstanceExecutionResultResultType.COMPLETED,
  status: null,
  endedAt: "2026-04-17T12:00:05Z",
  error: null,
  stepResults: [makeStep()],
  usesBatching: null,
  batchProgress: null,
  cancelRequestedAt: null,
  canceledBy: null,
  registeredBatchCount: null,
  triggerResolverBatchSize: null,
  ...overrides,
});

const makeService = (
  executions: ExecutionResult[],
): ExecutionResultsService => {
  return {
    getExecutions: () => executions,
    getExecution: (id: string) => executions.find((e) => e.id === id),
    onDidChangeExecutions: new vscode.EventEmitter().event,
    onDidChangeLogs: new vscode.EventEmitter().event,
    onDidChangeStepOutput: new vscode.EventEmitter().event,
  } as unknown as ExecutionResultsService;
};

const makeBatchService = (
  batches: ExecutionBatchNode[] = [],
  { loading = false, hasMore = false }: { loading?: boolean; hasMore?: boolean } = {},
): BatchProgressService => {
  const emitter = new vscode.EventEmitter<string>();
  return {
    onDidChangeBatches: emitter.event,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    cancel: vi.fn(),
    getSnapshot: () => null,
    getBatches: () => batches,
    hasMore: () => hasMore,
    totalCount: () => batches.length,
    isLoading: () => loading,
    setPaused: vi.fn(),
    dispose: vi.fn(),
  } as unknown as BatchProgressService;
};

const makeBatchNode = (
  overrides: Partial<ExecutionBatchNode> = {},
): ExecutionBatchNode => ({
  id: "b-1",
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

describe("ExecutionsTreeDataProvider", () => {
  it("returns an ExecutionNode per execution at the root", () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution()]),
    );
    const roots = provider.getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(ExecutionNode);
  });

  it("returns step children when an execution node is expanded", () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([
        makeExecution({
          stepResults: [makeStep(), makeStep({ id: "step-2" })],
        }),
      ]),
    );
    const [execNode] = provider.getChildren();
    const steps = provider.getChildren(execNode);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toBeInstanceOf(StepNode);
  });

  it("returns no children for step nodes", () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution()]),
    );
    const [execNode] = provider.getChildren();
    const [stepNode] = provider.getChildren(execNode);
    expect(provider.getChildren(stepNode)).toEqual([]);
  });
});

describe("ExecutionNode", () => {
  it("uses a spinning icon while running", () => {
    const node = new ExecutionNode(makeExecution({ endedAt: null }));
    const icon = node.iconPath as vscode.ThemeIcon;
    expect(icon.id).toBe("sync~spin");
  });

  it("marks a terminal execution with success context and icon", () => {
    const node = new ExecutionNode(makeExecution());
    expect(node.contextValue).toBe("executionItem.terminal");
  });

  it("marks an errored execution with a failure icon", () => {
    const node = new ExecutionNode(
      makeExecution({
        resultType: InstanceExecutionResultResultType.ERROR,
        error: "boom",
      }),
    );
    const icon = node.iconPath as vscode.ThemeIcon;
    expect(icon.id).toBe("error");
  });

  it("wires click to open logs with the execution id", () => {
    const node = new ExecutionNode(makeExecution());
    const command = node.command as {
      command: string;
      arguments: unknown[];
    };
    expect(command.command).toBe("prismatic.executionResults.openLogs");
    expect(command.arguments).toEqual(["exec-1"]);
  });
});

describe("StepNode", () => {
  it("renders status-less while the execution is running and the step has no end time", () => {
    const step = makeStep({ endedAt: null });
    const node = new StepNode(
      makeExecution({ endedAt: null, stepResults: [step] }),
      step,
    );
    const icon = node.iconPath as vscode.ThemeIcon;
    expect(icon.id).toBe("circle-outline");
  });

  it("shows a failure icon when the step has an error", () => {
    const step = makeStep({ hasError: true });
    const node = new StepNode(makeExecution({ stepResults: [step] }), step);
    const icon = node.iconPath as vscode.ThemeIcon;
    expect(icon.id).toBe("error");
  });

  it("wires click to open the step output", () => {
    const step = makeStep();
    const node = new StepNode(makeExecution({ stepResults: [step] }), step);
    const command = node.command as {
      command: string;
      arguments: unknown[];
    };
    expect(command.command).toBe("prismatic.executionResults.openStep");
    expect(command.arguments).toEqual(["exec-1", "step-1"]);
  });
});

describe("ExecutionsTreeDataProvider — batched", () => {
  it("returns BatchNode children for a batched parent", () => {
    const batchService = makeBatchService([makeBatchNode()]);
    const provider = new ExecutionsTreeDataProvider(
      makeService([
        makeExecution({
          usesBatching: true,
          batchProgress: {
            discovered: 1,
            discoveryComplete: true,
            completed: 1,
            failed: 0,
            canceled: 0,
            queued: 0,
            running: 0,
            total: 1,
            concurrencyLimit: null,
            concurrencyLimitSource: null,
          },
        }),
      ]),
      batchService,
    );
    const [parent] = provider.getChildren();
    const children = provider.getChildren(parent);
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(BatchNode);
  });

  it("returns a LoadingNode while the first page is loading", () => {
    const batchService = makeBatchService([], { loading: true });
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution({ usesBatching: true })]),
      batchService,
    );
    const [parent] = provider.getChildren();
    const children = provider.getChildren(parent);
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(LoadingNode);
  });

  it("appends a LoadMoreNode when more pages are available", () => {
    const batchService = makeBatchService([makeBatchNode()], {
      hasMore: true,
    });
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution({ usesBatching: true })]),
      batchService,
    );
    const [parent] = provider.getChildren();
    const children = provider.getChildren(parent);
    expect(children[children.length - 1]).toBeInstanceOf(LoadMoreNode);
  });

  it("still returns step children when execution is not batched", () => {
    const batchService = makeBatchService();
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution()]),
      batchService,
    );
    const [parent] = provider.getChildren();
    const children = provider.getChildren(parent);
    expect(children[0]).toBeInstanceOf(StepNode);
  });

  it("keeps sync~spin icon while discovery is incomplete after parent end", () => {
    const node = new ExecutionNode(
      makeExecution({
        usesBatching: true,
        endedAt: "2026-05-20T00:00:30Z",
        batchProgress: {
          discovered: 5,
          discoveryComplete: false,
          completed: 5,
          failed: 0,
          canceled: 0,
          queued: 0,
          running: 0,
          total: 5,
          concurrencyLimit: null,
          concurrencyLimitSource: null,
        },
      }),
    );
    expect((node.iconPath as vscode.ThemeIcon).id).toBe("sync~spin");
  });

  it("includes x/y batches summary in the parent description", () => {
    const node = new ExecutionNode(
      makeExecution({
        usesBatching: true,
        batchProgress: {
          discovered: 100,
          discoveryComplete: true,
          completed: 75,
          failed: 2,
          canceled: 0,
          queued: 20,
          running: 5,
          total: 100,
          concurrencyLimit: null,
          concurrencyLimitSource: null,
        },
      }),
    );
    expect(String(node.description)).toContain("75/100 batches");
    expect(String(node.description)).toContain("2 failed");
  });
});
