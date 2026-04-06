import { WebviewViewManager } from "@extension/WebviewViewManager";
import * as vscode from "vscode";
import { CONFIG } from "@/config";
import type { IntegrationDetailsMessage } from "@/webview/views/integrationDetails/types";

const WEBVIEW_CONFIG = CONFIG.webviews.integrationDetails;

export function createIntegrationDetailsViewProvider(
  context: vscode.ExtensionContext,
) {
  const IntegrationDetailsViewProvider =
    new WebviewViewManager<IntegrationDetailsMessage>(context.extensionUri, {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: (message, _postMessage) => {
        switch (message.type) {
          case "integrationDetails.refresh": {
            vscode.commands.executeCommand(
              "prismatic.integrationDetails.refresh",
            );
            break;
          }
          case "integrationDetails.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
          case "integrationDetails.authenticate": {
            vscode.env.openExternal(
              vscode.Uri.parse(message.payload.authorizationUrl),
            );
            break;
          }
          case "integrationDetails.flowsLoaded": {
            vscode.commands.executeCommand(
              "prismatic.flowPayloads.setFlows",
              message.payload.flows,
            );
            break;
          }
        }
      },
    });

  return vscode.window.registerWebviewViewProvider(
    WEBVIEW_CONFIG.viewType,
    IntegrationDetailsViewProvider,
  );
}
