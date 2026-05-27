import path from "node:path";
import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import type { BatchProgressService } from "./executionResults/BatchProgressService";
import type { ExecutionResultsService } from "./executionResults/ExecutionResultsService";
import type { ExecutionResult } from "./executionResults/types";
import { isExecutionBatched } from "./executionResults/types";

const BATCH_COMPLETION_LINGER_MS = 3000;

interface BatchSummary {
  executionId: string;
  completed: number;
  total: number;
  failed: number;
  running: number;
  queued: number;
  discoveryComplete: boolean;
  cancelRequested: boolean;
  concurrencyLimit: number | null;
  concurrencyLimitSource: string | null;
}

export class StatusBarManager {
  private userStatusBarItem: vscode.StatusBarItem;
  private integrationStatusBarItem: vscode.StatusBarItem;
  private batchStatusBarItem: vscode.StatusBarItem;
  private authManager: AuthManager;
  private stateManager: StateManager;
  private executionResultsService: ExecutionResultsService | null = null;
  private batchProgressService: BatchProgressService | null = null;
  private executionsViewVisible = false;
  private batchLingerTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly lateSubscriptions: vscode.Disposable[] = [];

  constructor(
    authManager: AuthManager,
    stateManager: StateManager,
    context: vscode.ExtensionContext,
  ) {
    this.authManager = authManager;
    this.stateManager = stateManager;

    this.userStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.userStatus",
      vscode.StatusBarAlignment.Left,
      0,
    );
    this.userStatusBarItem.name = "Prismatic User";

    this.integrationStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.integrationStatus",
      vscode.StatusBarAlignment.Left,
      -1,
    );
    this.integrationStatusBarItem.name = "Prismatic Integration";
    this.integrationStatusBarItem.command = "prismatic.integrations.select";

    this.batchStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.batchProgress",
      vscode.StatusBarAlignment.Left,
      -2,
    );
    this.batchStatusBarItem.name = "Prismatic Batch Progress";

    context.subscriptions.push(
      this,
      authManager.onDidChangeAuth(() => {
        void this.updateUserStatusBar();
      }),
    );

    void this.updateUserStatusBar();
    void this.updateIntegrationStatusBar();
    this.updateBatchStatusBar();
  }

  public async updateUserStatusBar(): Promise<void> {
    try {
      const userInfo = await this.authManager.getCurrentUser();

      this.userStatusBarItem.text = `$(prismatic-logo) ${userInfo.organization || "Logged in"}`;
      this.userStatusBarItem.tooltip = new vscode.MarkdownString(
        `**Prismatic User**\n\n` +
          `- **Name:** ${userInfo.name}\n` +
          `- **Email:** ${userInfo.email}\n` +
          `- **Organization:** ${userInfo.organization}\n` +
          `- **Endpoint:** ${userInfo.endpointUrl}`,
      );
      this.userStatusBarItem.command = "prismatic.switchTenant";
      this.userStatusBarItem.show();
    } catch {
      this.userStatusBarItem.text = "$(prismatic-logo) Not logged in";
      this.userStatusBarItem.tooltip = "Prismatic: Click to log in";
      this.userStatusBarItem.command = "prismatic.login";
      this.userStatusBarItem.show();
    }
  }

  public async updateIntegrationStatusBar(): Promise<void> {
    try {
      const workspaceState = await this.stateManager.getWorkspaceState();
      const activeIntegrationPath = workspaceState?.activeIntegrationPath;

      if (activeIntegrationPath) {
        const integrationName = path.basename(activeIntegrationPath);
        this.integrationStatusBarItem.text = `$(prismatic-logo) ${integrationName}`;
        this.integrationStatusBarItem.tooltip = new vscode.MarkdownString(
          `**Active Integration**\n\n` +
            `- **Name:** ${integrationName}\n` +
            `- **Path:** ${activeIntegrationPath}`,
        );
        this.integrationStatusBarItem.show();
      } else {
        this.integrationStatusBarItem.text = "$(prismatic-logo) No integration";
        this.integrationStatusBarItem.tooltip =
          "Prismatic: No integration selected";
        this.integrationStatusBarItem.show();
      }
    } catch {
      this.integrationStatusBarItem.text = "$(prismatic-logo) No integration";
      this.integrationStatusBarItem.tooltip =
        "Prismatic: Error fetching integration info";
      this.integrationStatusBarItem.show();
    }
  }

  public setExecutionsViewVisible(visible: boolean): void {
    if (this.executionsViewVisible === visible) return;
    this.executionsViewVisible = visible;
    this.updateBatchStatusBar();
  }

  public attachExecutionResults(
    executionResultsService: ExecutionResultsService,
    batchProgressService: BatchProgressService,
    treeView: vscode.TreeView<unknown>,
  ): void {
    this.executionResultsService = executionResultsService;
    this.batchProgressService = batchProgressService;
    this.executionsViewVisible = treeView.visible;

    const subs: vscode.Disposable[] = [
      executionResultsService.onDidChangeExecutions(() =>
        this.updateBatchStatusBar(),
      ),
      batchProgressService.onDidChangeBatches(() =>
        this.updateBatchStatusBar(),
      ),
      treeView.onDidChangeVisibility((e) =>
        this.setExecutionsViewVisible(e.visible),
      ),
    ];
    this.lateSubscriptions.push(...subs);

    this.updateBatchStatusBar();
  }

  public updateBatchStatusBar(): void {
    if (!this.executionResultsService) {
      this.batchStatusBarItem.hide();
      return;
    }

    const activeSummary = this.pickActiveBatch();
    const completedSummary = this.pickRecentlyCompleted();

    if (!activeSummary && !completedSummary) {
      this.batchStatusBarItem.hide();
      return;
    }

    if (!this.executionsViewVisible) {
      this.batchStatusBarItem.hide();
      return;
    }

    if (activeSummary) {
      this.clearLinger();
      this.batchStatusBarItem.text = this.formatActiveText(activeSummary);
      this.batchStatusBarItem.tooltip = this.formatTooltip(activeSummary);
      this.batchStatusBarItem.command = {
        title: "Reveal batched execution",
        command: "prismatic.executionResults.revealBatchedParent",
        arguments: [activeSummary.executionId],
      };
      this.batchStatusBarItem.show();
      return;
    }

    if (completedSummary) {
      this.batchStatusBarItem.text = `$(check) ${completedSummary.completed}/${completedSummary.total} batches`;
      this.batchStatusBarItem.tooltip = this.formatTooltip(completedSummary);
      this.batchStatusBarItem.command = {
        title: "Reveal batched execution",
        command: "prismatic.executionResults.revealBatchedParent",
        arguments: [completedSummary.executionId],
      };
      this.batchStatusBarItem.show();
      this.scheduleLingerHide();
    }
  }

  private pickActiveBatch(): BatchSummary | null {
    if (!this.executionResultsService) return null;
    for (const execution of this.executionResultsService.getExecutions()) {
      if (!isExecutionBatched(execution)) continue;
      const summary = this.toSummary(execution);
      const isActive =
        !summary.discoveryComplete ||
        summary.running > 0 ||
        summary.queued > 0 ||
        summary.cancelRequested;
      if (isActive) return summary;
    }
    return null;
  }

  private pickRecentlyCompleted(): BatchSummary | null {
    if (!this.executionResultsService) return null;
    for (const execution of this.executionResultsService.getExecutions()) {
      if (!isExecutionBatched(execution)) continue;
      const summary = this.toSummary(execution);
      const done =
        summary.discoveryComplete &&
        summary.running === 0 &&
        summary.queued === 0;
      if (done && summary.total > 0) return summary;
    }
    return null;
  }

  private toSummary(execution: ExecutionResult): BatchSummary {
    const p = execution.batchProgress;
    return {
      executionId: execution.id,
      completed: p?.completed ?? 0,
      total: (p?.total ?? 0) || (p?.discovered ?? 0),
      failed: p?.failed ?? 0,
      running: p?.running ?? 0,
      queued: p?.queued ?? 0,
      discoveryComplete: p?.discoveryComplete ?? false,
      cancelRequested: Boolean(execution.cancelRequestedAt),
      concurrencyLimit: p?.concurrencyLimit ?? null,
      concurrencyLimitSource: p?.concurrencyLimitSource ?? null,
    };
  }

  private formatActiveText(s: BatchSummary): string {
    const denom = s.total > 0 ? s.total : "?";
    const parts: string[] = [`$(sync~spin) ${s.completed}/${denom}`];
    if (s.failed > 0) parts.push(`${s.failed} failed`);
    return parts.join(" · ");
  }

  private formatTooltip(s: BatchSummary): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Batch progress**\n\n`);
    md.appendMarkdown(`- Completed: ${s.completed}\n`);
    md.appendMarkdown(`- Total: ${s.total}\n`);
    md.appendMarkdown(`- Failed: ${s.failed}\n`);
    md.appendMarkdown(`- Running: ${s.running}\n`);
    md.appendMarkdown(`- Queued: ${s.queued}\n`);
    md.appendMarkdown(
      `- Discovery: ${s.discoveryComplete ? "complete" : "in progress"}\n`,
    );
    if (s.concurrencyLimit !== null) {
      md.appendMarkdown(
        `- Concurrency limit: ${s.concurrencyLimit}${s.concurrencyLimitSource ? ` (${s.concurrencyLimitSource})` : ""}\n`,
      );
    }
    if (s.cancelRequested) md.appendMarkdown(`- Cancel requested\n`);
    return md;
  }

  private scheduleLingerHide(): void {
    this.clearLinger();
    this.batchLingerTimer = setTimeout(() => {
      this.batchStatusBarItem.hide();
      this.batchLingerTimer = null;
    }, BATCH_COMPLETION_LINGER_MS);
  }

  private clearLinger(): void {
    if (this.batchLingerTimer) {
      clearTimeout(this.batchLingerTimer);
      this.batchLingerTimer = null;
    }
  }

  public hide(): void {
    this.userStatusBarItem.hide();
    this.integrationStatusBarItem.hide();
    this.batchStatusBarItem.hide();
  }

  public show(): void {
    this.userStatusBarItem.show();
    this.integrationStatusBarItem.show();
    this.batchStatusBarItem.show();
  }

  public get userStatusBarCommand(): string | vscode.Command | undefined {
    return this.userStatusBarItem.command;
  }

  public dispose(): void {
    this.clearLinger();
    for (const d of this.lateSubscriptions) d.dispose();
    this.userStatusBarItem.dispose();
    this.integrationStatusBarItem.dispose();
    this.batchStatusBarItem.dispose();
  }
}
