import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import { CONFIG } from "@/config";
import { WebviewPanelManager } from "@/extension/WebviewPanelManager";
import type { ConfigWizardMessage } from "@/webview/views/configWizard/types";

const WEBVIEW_CONFIG = CONFIG.webviews.configWizard;

export const createConfigWizardPanel = (
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  authManager: AuthManager,
) => {
  const configWizardProvider = new WebviewPanelManager<ConfigWizardMessage>(
    context,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: async (message, _postMessage) => {
        switch (message.type) {
          case "configWizard.closed": {
            // Refresh integration details to pick up new config state
            await vscode.commands.executeCommand(
              "prismatic.integrationDetails.refresh",
            );
            configWizardProvider.close();
            break;
          }
          case "configWizard.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    },
    stateManager,
    authManager,
  );

  return vscode.commands.registerCommand(WEBVIEW_CONFIG.command, () =>
    configWizardProvider.createPanel(),
  );
};
