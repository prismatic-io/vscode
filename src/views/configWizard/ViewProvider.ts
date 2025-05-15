import * as vscode from "vscode";
import { PanelProvider } from "@/lib/PanelProvider";
import type { ConfigWizardMessage } from "./types";
import { CONFIG } from "../../../config.js";

const WEBVIEW_CONFIG = CONFIG.webviews.configWizard;

export function createConfigWizardPanel(context: vscode.ExtensionContext) {
  const configWizardProvider = new PanelProvider<ConfigWizardMessage>(context, {
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
  });

  return vscode.commands.registerCommand(WEBVIEW_CONFIG.command, () =>
    configWizardProvider.createPanel()
  );
}
