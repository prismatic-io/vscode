import * as vscode from "vscode";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import type { ExecutionResult, StepResult } from "./types";
import { isExecutionTerminal } from "./types";
import { buildLogsUri, buildStepUri } from "./uris";

const NEW_EXECUTION_INDICATOR_MS = 30_000;

export type ExecutionsTreeNode = ExecutionNode | StepNode;

export class ExecutionNode extends vscode.TreeItem {
  readonly kind = "execution" as const;

  constructor(public readonly execution: ExecutionResult) {
    super(
      executionLabel(execution),
      execution.stepResults.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    this.id = `execution:${execution.id}`;
    this.description = executionDescription(execution);
    this.tooltip = executionTooltip(execution);
    this.iconPath = executionIcon(execution);
    this.contextValue = isExecutionTerminal(execution)
      ? "executionItem.terminal"
      : "executionItem.running";

    this.resourceUri = buildLogsUri(execution.id);
    this.command = {
      command: "prismatic.executionResults.openLogs",
      title: "Open Logs",
      arguments: [execution.id],
    };
  }
}

export class StepNode extends vscode.TreeItem {
  readonly kind = "step" as const;

  constructor(
    public readonly execution: ExecutionResult,
    public readonly step: StepResult,
  ) {
    super(stepLabel(step), vscode.TreeItemCollapsibleState.None);

    this.id = `step:${execution.id}:${step.id}`;
    this.description = stepDescription(step);
    this.tooltip = stepTooltip(step);
    this.iconPath = stepIcon(step, isExecutionTerminal(execution));
    this.contextValue = "stepItem";

    this.resourceUri = buildStepUri(execution.id, step.id, step.stepName);
    this.command = {
      command: "prismatic.executionResults.openStep",
      title: "Open Step Output",
      arguments: [execution.id, step.id],
    };
  }
}

export class ExecutionsTreeDataProvider
  implements vscode.TreeDataProvider<ExecutionsTreeNode>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    // biome-ignore lint/suspicious/noConfusingVoidType: VS Code EventEmitter requires this shape
    ExecutionsTreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly service: ExecutionResultsService) {
    this.disposables.push(
      service.onDidChangeExecutions(() => this._onDidChangeTreeData.fire()),
      this._onDidChangeTreeData,
    );
  }

  getTreeItem(element: ExecutionsTreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExecutionsTreeNode): ExecutionsTreeNode[] {
    if (!element) {
      return this.service
        .getExecutions()
        .map((execution) => new ExecutionNode(execution));
    }

    if (element.kind === "execution") {
      return element.execution.stepResults.map(
        (step) => new StepNode(element.execution, step),
      );
    }

    return [];
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

const executionLabel = (execution: ExecutionResult): string => {
  const relative = relativeTime(execution.startedAt);
  return relative ?? execution.startedAt;
};

const executionDescription = (execution: ExecutionResult): string => {
  const parts: string[] = [];
  if (execution.endedAt) {
    const durationMs =
      new Date(execution.endedAt).getTime() -
      new Date(execution.startedAt).getTime();
    parts.push(formatDuration(durationMs));
  } else {
    parts.push("running…");
  }

  if (execution.invokeType) {
    parts.push(execution.invokeType.replace(/_/g, " ").toLowerCase());
  }

  return parts.join(" · ");
};

const executionTooltip = (
  execution: ExecutionResult,
): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Execution** \`${execution.id}\`\n\n`);
  md.appendMarkdown(`Started: ${execution.startedAt}\n\n`);
  md.appendMarkdown(`Ended: ${execution.endedAt ?? "running"}\n\n`);
  if (execution.resultType) {
    md.appendMarkdown(`Result: ${execution.resultType}\n\n`);
  }
  if (execution.error) {
    md.appendMarkdown(`Error: ${execution.error}`);
  }
  return md;
};

const executionIcon = (execution: ExecutionResult): vscode.ThemeIcon => {
  if (!isExecutionTerminal(execution)) {
    return new vscode.ThemeIcon("sync~spin");
  }

  if (execution.error || execution.resultType === "ERROR") {
    return new vscode.ThemeIcon(
      "error",
      new vscode.ThemeColor("testing.iconFailed"),
    );
  }

  const isRecent =
    Date.now() - new Date(execution.startedAt).getTime() <
    NEW_EXECUTION_INDICATOR_MS;

  return new vscode.ThemeIcon(
    isRecent ? "pass-filled" : "pass",
    new vscode.ThemeColor("testing.iconPassed"),
  );
};

const stepLabel = (step: StepResult): string =>
  step.displayStepName ?? step.stepName ?? step.id;

const stepDescription = (step: StepResult): string => {
  if (!step.endedAt) return "running…";
  const durationMs =
    new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime();
  return formatDuration(durationMs);
};

const stepTooltip = (step: StepResult): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Step** \`${step.stepName ?? step.id}\`\n\n`);
  md.appendMarkdown(`Started: ${step.startedAt}\n\n`);
  md.appendMarkdown(`Ended: ${step.endedAt ?? "running"}\n\n`);
  if (step.hasError) {
    md.appendMarkdown(`Failed`);
  }
  return md;
};

const stepIcon = (
  step: StepResult,
  executionTerminal: boolean,
): vscode.ThemeIcon => {
  if (step.hasError) {
    return new vscode.ThemeIcon(
      "error",
      new vscode.ThemeColor("testing.iconFailed"),
    );
  }

  if (!step.endedAt && !executionTerminal) {
    return new vscode.ThemeIcon("circle-outline");
  }

  return new vscode.ThemeIcon("circle-filled");
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
};

const relativeTime = (timestamp: string): string | null => {
  const ms = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ms)) return null;

  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleString();
};
