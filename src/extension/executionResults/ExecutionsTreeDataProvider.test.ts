import { describe, expect, it } from "vitest";
import * as vscode from "vscode";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import {
  BatchNode,
  ExecutionNode,
  ExecutionsTreeDataProvider,
  MoreBatchesNode,
  StepNode,
} from "./ExecutionsTreeDataProvider";
import {
  type ExecutionBatch,
  type ExecutionBatchList,
  ExecutionBatchStatus,
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
  endedAt: "2026-04-17T12:00:05Z",
  error: null,
  stepResults: [makeStep()],
  usesBatching: false,
  batchProgress: null,
  ...overrides,
});

const makeBatch = (
  overrides: Partial<ExecutionBatch> = {},
): ExecutionBatch => ({
  id: "batch-1",
  status: ExecutionBatchStatus.COMPLETED,
  recordCount: 25,
  errorMessage: null,
  startedAt: "2026-04-17T12:00:00Z",
  completedAt: "2026-04-17T12:00:02Z",
  ...overrides,
});

const makeService = (
  executions: ExecutionResult[],
  batches: ExecutionBatchList = { batches: [], totalCount: 0 },
  batchSteps: StepResult[] = [],
): ExecutionResultsService => {
  return {
    getExecutions: () => executions,
    getExecution: (id: string) => executions.find((e) => e.id === id),
    loadBatches: async () => batches,
    loadBatchSteps: async () => batchSteps,
    onDidChangeExecutions: new vscode.EventEmitter().event,
    onDidChangeLogs: new vscode.EventEmitter().event,
    onDidChangeStepOutput: new vscode.EventEmitter().event,
  } as unknown as ExecutionResultsService;
};

describe("ExecutionsTreeDataProvider", () => {
  it("returns an ExecutionNode per execution at the root", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution()]),
    );
    const roots = await provider.getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(ExecutionNode);
  });

  it("returns step children when an execution node is expanded", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([
        makeExecution({
          stepResults: [makeStep(), makeStep({ id: "step-2" })],
        }),
      ]),
    );
    const [execNode] = await provider.getChildren();
    const steps = await provider.getChildren(execNode);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toBeInstanceOf(StepNode);
  });

  it("returns no children for step nodes", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution()]),
    );
    const [execNode] = await provider.getChildren();
    const [stepNode] = await provider.getChildren(execNode);
    expect(await provider.getChildren(stepNode)).toEqual([]);
  });

  it("returns batch children for a batched execution", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution({ usesBatching: true, stepResults: [] })], {
        batches: [makeBatch(), makeBatch({ id: "batch-2" })],
        totalCount: 2,
      }),
    );
    const [execNode] = await provider.getChildren();
    expect(execNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    const batches = await provider.getChildren(execNode);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toBeInstanceOf(BatchNode);
    expect(batches[0].label).toBe("Batch 1");
    expect(batches[1].label).toBe("Batch 2");
  });

  it("notes batches past the first page", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService([makeExecution({ usesBatching: true, stepResults: [] })], {
        batches: [makeBatch()],
        totalCount: 150,
      }),
    );
    const [execNode] = await provider.getChildren();
    const children = await provider.getChildren(execNode);
    expect(children).toHaveLength(2);
    expect(children[1]).toBeInstanceOf(MoreBatchesNode);
    expect(children[1].label).toBe("149 more batches not shown");
  });

  it("returns step children when a batch node is expanded", async () => {
    const provider = new ExecutionsTreeDataProvider(
      makeService(
        [makeExecution({ usesBatching: true, stepResults: [] })],
        { batches: [makeBatch()], totalCount: 1 },
        [makeStep(), makeStep({ id: "step-2" })],
      ),
    );
    const [execNode] = await provider.getChildren();
    const [batchNode] = await provider.getChildren(execNode);
    const steps = await provider.getChildren(batchNode);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toBeInstanceOf(StepNode);
  });
});

describe("ExecutionNode", () => {
  it("uses a spinning icon while running", () => {
    const node = new ExecutionNode(makeExecution({ endedAt: null }));
    const icon = node.iconPath as vscode.ThemeIcon;
    expect(icon.id).toBe("sync~spin");
  });

  it("summarizes batch progress for a batched execution", () => {
    const node = new ExecutionNode(
      makeExecution({
        usesBatching: true,
        batchProgress: { total: 12, completed: 12, failed: 2 },
      }),
    );
    expect(node.description).toBe("5.0s · 12 batches · 2 failed");
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

describe("BatchNode", () => {
  it("wires click to open logs scoped to the batch", () => {
    const node = new BatchNode(makeExecution(), makeBatch(), 0);
    const command = node.command as {
      command: string;
      arguments: unknown[];
    };
    expect(command.command).toBe("prismatic.executionResults.openLogs");
    expect(command.arguments).toEqual(["exec-1", "batch-1"]);
  });

  it("shows record count and duration", () => {
    const node = new BatchNode(makeExecution(), makeBatch(), 0);
    expect(node.description).toBe("25 records · 2.0s");
  });

  it("uses a spinning icon while the batch runs", () => {
    const node = new BatchNode(
      makeExecution(),
      makeBatch({ completedAt: null }),
      0,
    );
    expect((node.iconPath as vscode.ThemeIcon).id).toBe("sync~spin");
  });

  it("marks a failed batch with a failure icon", () => {
    const node = new BatchNode(
      makeExecution(),
      makeBatch({ status: ExecutionBatchStatus.FAILED, errorMessage: "boom" }),
      0,
    );
    expect((node.iconPath as vscode.ThemeIcon).id).toBe("error");
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
