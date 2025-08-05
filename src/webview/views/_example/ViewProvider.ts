import * as vscode from "vscode";
import { WebviewViewManager } from "@extension/WebviewViewManager";
import type { ExampleMessage } from "@/webview/views/_example/types";
import { CONFIG } from "../../../../config";

const WEBVIEW_CONFIG = CONFIG.webviews.example;

export function createExampleViewProvider(context: vscode.ExtensionContext) {
  const ExampleViewProvider = new WebviewViewManager<ExampleMessage>(
    context.extensionUri,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: (message, postMessage) => {
        switch (message.type) {
          case "example.payload": {
            vscode.window.showInformationMessage(
              `Received from webviews: ${message.payload}`
            );

            postMessage({
              type: "example.payload",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });
            break;
          }
          case "example.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    }
  );

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    ExampleViewProvider
  );
}
