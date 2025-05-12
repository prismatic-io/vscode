import * as vscode from "vscode";
import { PanelProvider } from "@providers/PanelProvider";
import type { ConfigWizardMessage, ConfigWizardDummyMessage } from "./types";
import { CONFIG } from "../../../config.js";
import { StateManager } from "@/utils/stateManager";

const webviewConfig = CONFIG.webviews.configWizard;

export function createConfigWizardPanel(context: vscode.ExtensionContext) {
  const configWizardProvider = new PanelProvider<ConfigWizardMessage>(context, {
    viewType: webviewConfig.viewType,
    title: webviewConfig.title,
    scriptPath: webviewConfig.scriptPath,
    onMessage: async (message, postMessage) => {
      const stateManager = StateManager.getInstance();

      switch (message.type) {
        case "configWizard.dummy": {
          vscode.window.showInformationMessage(
            `Received from config wizard: ${message.payload}`
          );

          postMessage({
            type: "configWizard.dummy",
            payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
          });
          break;
        }
        case "configWizard.complete": {
          // todo: this will close the config wizard panel
          await stateManager.updateGlobalState("configWizard", {
            isComplete: true,
            lastConfig: message.payload,
          });

          vscode.window.showInformationMessage(
            message.payload.message || "Configuration completed successfully"
          );

          configWizardProvider.dispose();
          break;
        }
        case "configWizard.error": {
          vscode.window.showErrorMessage(message.payload.message);
          break;
        }
      }
    },
  });

  return vscode.commands.registerCommand(webviewConfig.command, () =>
    configWizardProvider.createPanel()
  );
}
