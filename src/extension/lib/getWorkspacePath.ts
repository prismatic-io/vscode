import * as vscode from "vscode";

export const getWorkspacePath = () => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error("No workspace folder found.");
  }

  return workspaceFolder.uri.fsPath;
};
