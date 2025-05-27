import * as vscode from "vscode";
import { WebviewViewManager } from "@extension/WebviewViewManager";
import type { SettingsMessage } from "@/webview/views/settings/types";
import { CONFIG } from "../../../../config";

const WEBVIEW_CONFIG = CONFIG.webviews.settings;

export function createSettingsViewProvider(context: vscode.ExtensionContext) {
  const SettingsViewProvider = new WebviewViewManager<SettingsMessage>(
    context.extensionUri,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: (message, postMessage) => {
        switch (message.type) {
          case "settings.example": {
            vscode.window.showInformationMessage(
              `Received from webviews: ${message.payload}`
            );

            postMessage({
              type: "settings.example",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });
            break;
          }
          case "settings.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    }
  );

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    SettingsViewProvider
  );
}
