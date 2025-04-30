import * as vscode from "vscode";
import { WebviewProvider } from "@providers/WebviewProvider";
import type { PrismaticMessage } from "./types";
import { CONFIG } from "../../../config.js";

const webviewConfig = CONFIG.webviews.prismatic;

export function createPrismaticViewProvider(context: vscode.ExtensionContext) {
  const PrismaticViewProvider = new WebviewProvider<PrismaticMessage>(
    context.extensionUri,
    {
      viewType: webviewConfig.viewType,
      title: webviewConfig.title,
      scriptPath: webviewConfig.scriptPath,
      onMessage: (message, postMessage) => {
        switch (message.type) {
          case "prismatic.dummy": {
            vscode.window.showInformationMessage(
              `Received from webviews: ${message.payload}`
            );

            postMessage({
              type: "prismatic.dummy",
              payload: `VS Code received your message at ${new Date().toLocaleTimeString()}`,
            });
            break;
          }
          case "prismatic.error": {
            vscode.window.showErrorMessage(message.payload.message);
            break;
          }
        }
      },
    }
  );

  return vscode.window.registerWebviewViewProvider(
    webviewConfig.viewType,
    PrismaticViewProvider
  );
}
