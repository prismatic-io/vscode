import { WebviewViewManager } from "@extension/WebviewViewManager";
import * as vscode from "vscode";
import type { ExecutionResultsMessage } from "@/webview/views/executionResults/types";
import { CONFIG } from "../../../../config";

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

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    ExecutionResultsViewProvider,
  );
}
