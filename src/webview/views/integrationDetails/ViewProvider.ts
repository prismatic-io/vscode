import { WebviewViewManager } from "@extension/WebviewViewManager";
import * as vscode from "vscode";
import type { IntegrationDetailsMessage } from "@/webview/views/integrationDetails/types";
import { CONFIG } from "../../../../config";

const WEBVIEW_CONFIG = CONFIG.webviews.integrationDetails;

export function createIntegrationDetailsViewProvider(
  context: vscode.ExtensionContext,
) {
  const IntegrationDetailsViewProvider =
    new WebviewViewManager<IntegrationDetailsMessage>(context.extensionUri, {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: (message, postMessage) => {
        switch (message.type) {
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
