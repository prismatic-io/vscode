import * as vscode from "vscode";

/**
 * Detects if the current workspace is running in a WSL remote context.
 * This occurs when VSCode on Windows opens a folder inside WSL via the "Remote - WSL" extension.
 * In this scenario, the extension host runs on Windows but needs to execute commands inside WSL.
 *
 * @returns true if connected to a WSL remote workspace, false otherwise
 */
export function isWslRemote(): boolean {
  return vscode.env.remoteName === "wsl";
}
