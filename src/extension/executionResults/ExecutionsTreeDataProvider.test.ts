import { describe, expect, it } from "vitest";
import * as vscode from "vscode";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import {
  ExecutionNode,
  ExecutionsTreeDataProvider,
  StepNode,
} from "./ExecutionsTreeDataProvider";
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
  endedAt: "2026-04-17T12:00:05Z",
  error: null,
  stepResults: [makeStep()],
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
