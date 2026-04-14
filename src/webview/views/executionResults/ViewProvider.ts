import { AuthManager } from "@extension/AuthManager";
import { StateManager } from "@extension/StateManager";
import { WebviewViewManager } from "@extension/WebviewViewManager";
import * as vscode from "vscode";
import { CONFIG } from "@/config";
import type { ExecutionResultsMessage } from "@/webview/views/executionResults/types";

const WEBVIEW_CONFIG = CONFIG.webviews.executionResults;

export function createExecutionResultsViewProvider(
  context: vscode.ExtensionContext,
) {
  const ExecutionResultsViewProvider =
    new WebviewViewManager<ExecutionResultsMessage>(context.extensionUri, {
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
    });

  context.subscriptions.push(
    AuthManager.getInstance().onDidChangeAuth(() => {
      StateManager.getInstance().notifyWebviews({
        type: "executionResults.refetch",
        payload: new Date().toISOString(),
      });
    }),
  );

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    ExecutionResultsViewProvider,
  );
}
