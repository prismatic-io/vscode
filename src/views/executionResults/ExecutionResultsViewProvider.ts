import * as vscode from "vscode";
import { WebviewProvider } from "@providers/WebviewProvider";
import type { ExecutionResultsMessage } from "./types";
import { CONFIG } from "../../../config.js";
import { StateManager } from "@/utils/stateManager";

const webviewConfig = CONFIG.webviews.executionResults;

export function createExecutionResultsViewProvider(
  context: vscode.ExtensionContext
) {
  const ExecutionResultsViewProvider =
    new WebviewProvider<ExecutionResultsMessage>(context.extensionUri, {
      viewType: webviewConfig.viewType,
      title: webviewConfig.title,
      scriptPath: webviewConfig.scriptPath,
      onMessage: (message, postMessage) => {
        const stateManager = StateManager.getInstance();

        switch (message.type) {
          case "executionResults.dummy": {
            // e.g. just an example
            // manual update of execution results, should be handle by stateChange message type.
            stateManager.updateGlobalState("executionResults", {
              lastExecution: {
                timestamp: Date.now(),
                results: message.payload,
              },
            });

            postMessage({
              type: "executionResults.dummy",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });

            vscode.window.showInformationMessage(
              `Received from execution results view: ${message.payload}`
            );
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
    webviewConfig.viewType,
    ExecutionResultsViewProvider
  );
}
