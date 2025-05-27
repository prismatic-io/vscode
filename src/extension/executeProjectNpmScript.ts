import * as vscode from "vscode";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const executeProjectNpmScript = async (
  scriptName: string
): Promise<{ stdout: string; stderr: string }> => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  try {
    const { stdout, stderr } = await execAsync(`npm run ${scriptName}`, {
      cwd: workspaceFolder.uri.fsPath,
    });

    return { stdout, stderr };
  } catch (error) {
    throw new Error(
      `Failed to execute npm script '${scriptName}': ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
