import * as vscode from "vscode";
import { log } from "@/extension";
import type { AuthManager } from "@/extension/AuthManager";
import type { StateManager } from "@/extension/StateManager";
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
  treeView: vscode.TreeView<unknown>;
  treeDataProvider: ExecutionsTreeDataProvider;
}

export const registerExecutionResults = (
  options: RegisterOptions,
): RegisterResult => {
  const { context, stateManager, authManager } = options;

  const service = new ExecutionResultsService({ stateManager, authManager });
  context.subscriptions.push({ dispose: () => service.dispose() });

  const treeDataProvider = new ExecutionsTreeDataProvider(service);
  context.subscriptions.push(treeDataProvider);

  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  service.setPaused(!treeView.visible);
  context.subscriptions.push(
    treeView.onDidChangeVisibility((event) => {
      service.setPaused(!event.visible);
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

  context.subscriptions.push(
    vscode.commands.registerCommand("prismatic.executionResults.refresh", () =>
      service.refresh(),
    ),
    vscode.commands.registerCommand(
      "prismatic.executionResults.openLogs",
      async (executionId: string) => {
        const uri = buildLogsUri(executionId);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.languages.setTextDocumentLanguage(doc, LOG_LANGUAGE_ID);
        await vscode.window.showTextDocument(doc, { preview: true });
      },
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

  return { service, treeView, treeDataProvider };
};
