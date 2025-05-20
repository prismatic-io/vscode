import * as vscode from "vscode";
import { WebviewViewManager } from "@extension/WebviewViewManager";
import { CONFIG } from "../../../../config";
import type { ExecutionResultsMessage } from "./types";

const WEBVIEW_CONFIG = CONFIG.webviews.executionResults;

export function createExecutionResultsViewProvider(
  context: vscode.ExtensionContext
) {
  const ExecutionResultsViewProvider =
    new WebviewViewManager<ExecutionResultsMessage>(context.extensionUri, {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: (message, postMessage) => {
        switch (message.type) {
          case "executionResults.example": {
            vscode.window.showInformationMessage(
              `Received from execution results view: ${message.payload}`
            );

            postMessage({
              type: "executionResults.example",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });
            break;
          }
          case "executionResults.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    });

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    ExecutionResultsViewProvider
  );
}
