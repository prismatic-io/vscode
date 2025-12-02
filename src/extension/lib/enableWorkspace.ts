import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { SPECTRAL_DIR } from "@/extension/constants";
import { getWorkspacePath } from "@/extension/lib/getWorkspacePath";

/**
 * Check if the workspace contains the SPECTRAL_DIR and enable the extension context.
 * Uses fs.existsSync which ignores .gitignore (unlike VS Code's workspaceContains activation event).
 *
 * @returns boolean indicating if the workspace is a Prismatic workspace
 */
export const enableWorkspace = async (): Promise<boolean> => {
  let isEnabled = false;

  try {
    const workspacePath = getWorkspacePath();
    const spectralPath = path.join(workspacePath, SPECTRAL_DIR);

    isEnabled = fs.existsSync(spectralPath);
  } catch {
    // No workspace folder found
  }

  await vscode.commands.executeCommand(
    "setContext",
    "prismatic.workspaceEnabled",
    isEnabled,
  );

  return isEnabled;
};
