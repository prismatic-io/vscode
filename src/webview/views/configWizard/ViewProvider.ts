import * as vscode from "vscode";
import { WebviewPanelManager } from "@/extension/WebviewPanelManager";
import type { ConfigWizardMessage } from "@/webview/views/configWizard/types";
import { CONFIG } from "../../../../config";
import { StateManager } from "@/extension/StateManager";
import { log } from "@/extension";

const WEBVIEW_CONFIG = CONFIG.webviews.configWizard;

export function createConfigWizardPanel(context: vscode.ExtensionContext) {
  const configWizardProvider = new WebviewPanelManager<ConfigWizardMessage>(
    context,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: async (message, _postMessage) => {
        switch (message.type) {
          case "configWizard.closed": {
            configWizardProvider.close();

            // Refresh integration data after config wizard closes
            // The configuration may have changed
            try {
              const stateManager = StateManager.getInstance();
              await stateManager.refreshIntegrationData();

              // Also refresh the integration tree view
              await vscode.commands.executeCommand("prismatic.integration.refresh");

              log("INFO", "Integration data refreshed after config wizard closed");
            } catch (error) {
              log("ERROR", `Failed to refresh integration data after config wizard: ${error}`);
            }
            break;
          }
          case "configWizard.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    },
  );

  return vscode.commands.registerCommand(WEBVIEW_CONFIG.command, () =>
    configWizardProvider.createPanel(),
  );
}
