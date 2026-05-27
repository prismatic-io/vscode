import * as vscode from "vscode";
import type { BatchProgressService } from "./BatchProgressService";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import type {
  ExecutionBatchNode,
  ExecutionResult,
  StepResult,
} from "./types";
import { isExecutionBatched, isExecutionTerminal } from "./types";
import { buildLogsUri, buildStepUri } from "./uris";

const NEW_EXECUTION_INDICATOR_MS = 30_000;

export type ExecutionsTreeNode =
  | ExecutionNode
  | StepNode
  | BatchNode
  | LoadMoreNode
  | LoadingNode;

export class ExecutionNode extends vscode.TreeItem {
  readonly kind = "execution" as const;

  constructor(public readonly execution: ExecutionResult) {
    const batched = isExecutionBatched(execution);
    const hasChildren =
      execution.stepResults.length > 0 || batched;
    super(
      executionLabel(execution),
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    this.id = `execution:${execution.id}`;
    this.description = executionDescription(execution);
    this.tooltip = executionTooltip(execution);
    this.iconPath = executionIcon(execution);
    this.contextValue = executionContextValue(execution);

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

export class BatchNode extends vscode.TreeItem {
  readonly kind = "batch" as const;

  constructor(
    public readonly execution: ExecutionResult,
    public readonly batchNode: ExecutionBatchNode,
  ) {
    super(batchNode.displayKey, vscode.TreeItemCollapsibleState.None);

    this.id = `batch:${execution.id}:${batchNode.id}`;
    this.description = batchNodeDescription(batchNode);
    this.tooltip = batchNodeTooltip(batchNode);
    this.iconPath = batchNodeIcon(batchNode);
    this.contextValue = `batchItem.${batchNode.status}`;

    this.resourceUri = buildLogsUri(batchNode.id);
    this.command = {
      command: "prismatic.executionResults.openBatchLogs",
      title: "Open Batch Logs",
      arguments: [execution.id, batchNode.id],
    };
  }
}

export class LoadMoreNode extends vscode.TreeItem {
  readonly kind = "loadMore" as const;

  constructor(public readonly execution: ExecutionResult) {
    super("Load more batches…", vscode.TreeItemCollapsibleState.None);
    this.id = `loadMore:${execution.id}`;
    this.iconPath = new vscode.ThemeIcon("more");
    this.contextValue = "loadMoreBatches";
    this.command = {
      command: "prismatic.executionResults.loadMoreBatches",
      title: "Load More Batches",
      arguments: [execution.id],
    };
  }
}

export class LoadingNode extends vscode.TreeItem {
  readonly kind = "loading" as const;

  constructor(public readonly execution: ExecutionResult) {
    super("Loading batches…", vscode.TreeItemCollapsibleState.None);
    this.id = `loading:${execution.id}`;
    this.iconPath = new vscode.ThemeIcon("sync~spin");
    this.contextValue = "loadingBatches";
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

  constructor(
    private readonly service: ExecutionResultsService,
    private readonly batchService: BatchProgressService | null = null,
  ) {
    this.disposables.push(
      service.onDidChangeExecutions(() => this._onDidChangeTreeData.fire()),
      this._onDidChangeTreeData,
    );
    if (batchService) {
      this.disposables.push(
        batchService.onDidChangeBatches(() => {
          this._onDidChangeTreeData.fire();
        }),
      );
    }
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
      if (isExecutionBatched(element.execution) && this.batchService) {
        this.batchService.subscribe(element.execution.id);
        if (this.batchService.isLoading(element.execution.id)) {
          return [new LoadingNode(element.execution)];
        }
        const nodes = this.batchService
          .getBatches(element.execution.id)
          .map((b) => new BatchNode(element.execution, b));
        if (this.batchService.hasMore(element.execution.id)) {
          nodes.push(new LoadMoreNode(element.execution) as never);
        }
        return nodes;
      }
      return element.execution.stepResults.map(
        (step) => new StepNode(element.execution, step),
      );
    }

    return [];
  }

  getNodeByExecutionId(executionId: string): ExecutionNode | null {
    const execution = this.service.getExecution(executionId);
    return execution ? new ExecutionNode(execution) : null;
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

  if (isExecutionBatched(execution) && execution.batchProgress) {
    const p = execution.batchProgress;
    const denom = p.total > 0 ? p.total : p.discovered;
    parts.push(`${p.completed}/${denom} batches`);
    if (p.failed > 0) parts.push(`${p.failed} failed`);
  }

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

const executionContextValue = (execution: ExecutionResult): string => {
  if (!isExecutionBatched(execution)) {
    return isExecutionTerminal(execution)
      ? "executionItem.terminal"
      : "executionItem.running";
  }
  if (execution.status === "CANCELING" || execution.cancelRequestedAt) {
    return "executionItem.batched.canceling";
  }
  return isExecutionTerminal(execution)
    ? "executionItem.batched.terminal"
    : "executionItem.batched.running";
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
  if (isExecutionBatched(execution)) {
    if (execution.triggerResolverBatchSize !== null) {
      md.appendMarkdown(
        `Resolver batch size: ${execution.triggerResolverBatchSize}\n\n`,
      );
    }
    const limit = execution.batchProgress?.concurrencyLimit;
    const limitSource = execution.batchProgress?.concurrencyLimitSource;
    if (limit !== null && limit !== undefined) {
      md.appendMarkdown(
        `Concurrency limit: ${limit}${limitSource ? ` (${limitSource})` : ""}\n\n`,
      );
    }
    if (execution.cancelRequestedAt) {
      md.appendMarkdown(`Cancel requested at: ${execution.cancelRequestedAt}\n\n`);
    }
  }
  if (execution.error) {
    md.appendMarkdown(`Error: ${execution.error}`);
  }
  return md;
};

const executionIcon = (execution: ExecutionResult): vscode.ThemeIcon => {
  if (
    isExecutionBatched(execution) &&
    execution.batchProgress?.discoveryComplete === false
  ) {
    return new vscode.ThemeIcon("sync~spin");
  }

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

const batchNodeDescription = (node: ExecutionBatchNode): string => {
  const parts: string[] = [];
  parts.push(node.label);
  parts.push(node.role);
  if (node.startedAt && node.completedAt) {
    const ms =
      new Date(node.completedAt).getTime() - new Date(node.startedAt).getTime();
    parts.push(formatDuration(ms));
  } else if (node.startedAt) {
    parts.push("running…");
  } else {
    parts.push("queued");
  }
  return parts.join(" · ");
};

const batchNodeTooltip = (node: ExecutionBatchNode): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Batch** \`${node.displayKey}\`\n\n`);
  md.appendMarkdown(`Records: ${node.recordCount}\n\n`);
  md.appendMarkdown(`Steps: ${node.stepCount}\n\n`);
  md.appendMarkdown(`Status: ${node.status}\n\n`);
  if (node.startedAt) md.appendMarkdown(`Started: ${node.startedAt}\n\n`);
  if (node.completedAt) md.appendMarkdown(`Completed: ${node.completedAt}\n\n`);
  if (node.errorMessage) md.appendMarkdown(`Error: ${node.errorMessage}`);
  return md;
};

const batchNodeIcon = (node: ExecutionBatchNode): vscode.ThemeIcon => {
  switch (node.status) {
    case "success":
      return new vscode.ThemeIcon(
        "pass-filled",
        new vscode.ThemeColor("testing.iconPassed"),
      );
    case "fail":
      return new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("testing.iconFailed"),
      );
    case "partial":
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("notebookStatusErrorIcon.foreground"),
      );
    case "running":
      return new vscode.ThemeIcon("sync~spin");
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
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
