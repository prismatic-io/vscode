import * as vscode from "vscode";
import { WebviewPanelManager } from "@/extension/WebviewPanelManager";
import type { ConfigWizardMessage } from "@/webview/views/configWizard/types";
import { CONFIG } from "../../../../config";

const WEBVIEW_CONFIG = CONFIG.webviews.configWizard;

export function createConfigWizardPanel(context: vscode.ExtensionContext) {
  const configWizardProvider = new WebviewPanelManager<ConfigWizardMessage>(
    context,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: async (message, postMessage) => {
        switch (message.type) {
          case "configWizard.example": {
            vscode.window.showInformationMessage(
              `Received from config wizard: ${message.payload}`
            );

            postMessage({
              type: "configWizard.example",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });
            break;
          }
          case "configWizard.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    }
  );

  return vscode.commands.registerCommand(WEBVIEW_CONFIG.command, () =>
    configWizardProvider.createPanel()
  );
}
