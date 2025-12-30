import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { SPECTRAL_DIR } from "@/extension/constants";

/**
 * Recursively search for a .spectral directory within maxDepth levels
 */
const hasSpectralDirectory = (
  currentPath: string,
  currentDepth: number,
  maxDepth: number,
): boolean => {
  if (currentDepth > maxDepth) return false;

  try {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip common directories that won't contain integrations
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git" ||
        entry.name === ".vscode"
      ) {
        continue;
      }

      if (entry.name === SPECTRAL_DIR) {
        return true;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (hasSpectralDirectory(fullPath, currentDepth + 1, maxDepth)) {
        return true;
      }
    }
  } catch {
    // Ignore permission errors or other access issues
  }

  return false;
};

/**
 * Check if any workspace folder contains the SPECTRAL_DIR (at any nesting level) and enable the extension context.
 * Uses fs.readdirSync which ignores .gitignore (unlike VS Code's workspaceContains activation event).
 * Supports multi-root workspaces (mono-repo) with nested .spectral directories.
 *
 * @returns boolean indicating if any workspace folder is a Prismatic workspace
 */
export const enableWorkspace = async (): Promise<boolean> => {
  let isEnabled = false;

  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        if (hasSpectralDirectory(folder.uri.fsPath, 0, 5)) {
          isEnabled = true;
          break;
        }
      }
    }
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
