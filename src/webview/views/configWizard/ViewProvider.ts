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
      onMessage: async (message, _postMessage) => {
        switch (message.type) {
          case "configWizard.closed": {
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
  );

  return vscode.commands.registerCommand(WEBVIEW_CONFIG.command, () =>
    configWizardProvider.createPanel(),
  );
}
