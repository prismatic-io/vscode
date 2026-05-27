import * as vscode from "vscode";
import { log } from "@/extension";
import type { AuthManager } from "@/extension/AuthManager";
import type { StateManager } from "@/extension/StateManager";
import { createBatchProgressPanel } from "@/webview/views/batchProgress/ViewProvider";
import { BatchProgressService } from "./BatchProgressService";
import { ExecutionResultsService } from "./ExecutionResultsService";
import { ExecutionsTreeDataProvider } from "./ExecutionsTreeDataProvider";
import { LogsContentProvider } from "./LogsContentProvider";
import { StepContentProvider } from "./StepContentProvider";
import { buildLogsUri, buildStepUri, LOGS_SCHEME, STEP_SCHEME } from "./uris";

export const VIEW_ID = "prismatic.executionResultsView";
export const LOG_LANGUAGE_ID = "prismatic-log";

export interface RegisterOptions {
  context: vscode.ExtensionContext;
  stateManager: StateManager;
  authManager: AuthManager;
}

export interface RegisterResult {
  service: ExecutionResultsService;
  batchService: BatchProgressService;
  treeView: vscode.TreeView<unknown>;
  treeDataProvider: ExecutionsTreeDataProvider;
}

export const registerExecutionResults = (
  options: RegisterOptions,
): RegisterResult => {
  const { context, stateManager, authManager } = options;

  const service = new ExecutionResultsService({ stateManager, authManager });
  context.subscriptions.push({ dispose: () => service.dispose() });

  const batchService = new BatchProgressService({
    stateManager,
    authManager,
    executionResultsService: service,
  });
  context.subscriptions.push({ dispose: () => batchService.dispose() });

  context.subscriptions.push(
    createBatchProgressPanel(context, stateManager, authManager, batchService),
  );

  const treeDataProvider = new ExecutionsTreeDataProvider(service, batchService);
  context.subscriptions.push(treeDataProvider);

  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  service.setPaused(!treeView.visible);
  batchService.setPaused(!treeView.visible);
  context.subscriptions.push(
    treeView.onDidChangeVisibility((event) => {
      service.setPaused(!event.visible);
      batchService.setPaused(!event.visible);
    }),
  );

  const logsProvider = new LogsContentProvider(service);
  context.subscriptions.push(logsProvider);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      LOGS_SCHEME,
      logsProvider,
    ),
  );

  const stepProvider = new StepContentProvider(service);
  context.subscriptions.push(stepProvider);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      STEP_SCHEME,
      stepProvider,
    ),
  );

  const openLogsFor = async (executionId: string) => {
    const uri = buildLogsUri(executionId);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, LOG_LANGUAGE_ID);
    await vscode.window.showTextDocument(doc, { preview: true });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("prismatic.executionResults.refresh", () =>
      service.refresh(),
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openLogs",
      (executionId: string) => openLogsFor(executionId),
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openStep",
      async (executionId: string, stepId: string) => {
        const execution = service.getExecution(executionId);
        const step = execution?.stepResults.find((s) => s.id === stepId);
        const uri = buildStepUri(executionId, stepId, step?.stepName ?? null);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.cancelBatch",
      async (executionId: string) => {
        const confirm = await vscode.window.showWarningMessage(
          "Cancel batch processing for this execution? Running batches will continue, queued batches will not start.",
          { modal: true },
          "Cancel Batch",
          "Keep Running",
        );
        if (confirm !== "Cancel Batch") return;
        try {
          await batchService.cancel(executionId);
          await vscode.window.showInformationMessage(
            "Batch cancellation requested.",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(
            `Failed to cancel batch processing: ${message}`,
          );
        }
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.loadMoreBatches",
      (executionId: string) => batchService.loadMore(executionId),
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openBatchLogs",
      (_executionId: string, batchExecutionId: string) =>
        openLogsFor(batchExecutionId),
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openBatchStep",
      async (batchExecutionId: string, stepId: string) => {
        await vscode.commands.executeCommand(
          "prismatic.executionResults.openStep",
          batchExecutionId,
          stepId,
        );
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.copyBatchId",
      async (batchExecutionId: string) => {
        await vscode.env.clipboard.writeText(batchExecutionId);
        await vscode.window.showInformationMessage(
          `Copied batch id: ${batchExecutionId}`,
        );
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openBatchInBrowser",
      async (batchExecutionId: string) => {
        try {
          const globalState = await stateManager.getGlobalState();
          const prismaticUrl = globalState?.prismaticUrl;
          if (!prismaticUrl) {
            throw new Error("No Prismatic URL configured");
          }
          await vscode.env.openExternal(
            vscode.Uri.parse(
              `${prismaticUrl}/executions/${encodeURIComponent(batchExecutionId)}`,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(
            `Failed to open batch in browser: ${message}`,
          );
        }
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.subscribeBatched",
      (executionId: string) => {
        batchService.subscribe(executionId);
      },
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.revealBatchedParent",
      async (executionId: string) => {
        await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
        const node = treeDataProvider.getNodeByExecutionId(executionId);
        if (node) {
          await treeView.reveal(node, { focus: true, expand: true });
        }
      },
    ),
  );

  // Flow changes — repoint the service at the current active flow.
  const applyActiveFlow = async () => {
    try {
      const workspaceState = await stateManager.getWorkspaceState();
      service.setFlowId(workspaceState?.flow?.id ?? null);
    } catch (error) {
      log(
        "ERROR",
        `Failed to apply active flow: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
  void applyActiveFlow();

  context.subscriptions.push(
    stateManager.onDidChangeWorkspaceState(() => {
      void applyActiveFlow();
    }),
  );

  return { service, batchService, treeView, treeDataProvider };
};
