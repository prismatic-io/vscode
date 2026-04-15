import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import { WebviewViewManager } from "@extension/WebviewViewManager";
import * as vscode from "vscode";
import { CONFIG } from "@/config";
import type { ExecutionResultsMessage } from "@/webview/views/executionResults/types";

const WEBVIEW_CONFIG = CONFIG.webviews.executionResults;

export const createExecutionResultsViewProvider = (
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  authManager: AuthManager,
) => {
  const ExecutionResultsViewProvider =
    new WebviewViewManager<ExecutionResultsMessage>(
      context.extensionUri,
      {
        viewType: WEBVIEW_CONFIG.viewType,
        title: WEBVIEW_CONFIG.title,
        scriptPath: WEBVIEW_CONFIG.scriptPath,
        onMessage: (message) => {
          switch (message.type) {
            case "executionResults.error": {
              vscode.window.showErrorMessage(message.payload.message);
              break;
            }
          }
        },
      },
      stateManager,
      authManager,
    );

  context.subscriptions.push(
    authManager.onDidChangeAuth(() => {
      stateManager.notifyWebviews({
        type: "executionResults.refetch",
        payload: new Date().toISOString(),
      });
    }),
  );

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    ExecutionResultsViewProvider,
  );
};
