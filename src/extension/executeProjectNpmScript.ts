import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { findNpmPath } from "@/extension/findNpmPath";

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
};

const execAsync = promisify(exec);

export const executeProjectNpmScript = async (
  scriptName: string
): Promise<{ stdout: string; stderr: string }> => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  // 1. check if workspace folder exists
  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  const packageJsonPath = path.join(workspaceFolder.uri.fsPath, "package.json");

  // 2. check if package.json exists
  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `No package.json found in workspace. Please ensure you're in a Node.js project directory.`
    );
  }

  const npmPath = await findNpmPath();

  // 3. check if npm is installed and accessible
  if (!npmPath) {
    throw new Error(
      "npm is not found. Please ensure npm is installed and accessible. " +
        "You can install npm by running 'brew install node' (macOS) or visiting https://nodejs.org/"
    );
  }

  try {
    const { stdout, stderr } = await execAsync(
      `"${npmPath}" run ${scriptName}`,
      {
        cwd: workspaceFolder.uri.fsPath,
        env: {
          ...process.env,
          // note: explicitly override DEBUG to prevent Node's require from dumping debug data when CNI projects set DEBUG=true via dotenv
          DEBUG: "false",
        },
      }
    );

    return { stdout, stderr };
  } catch (error) {
    const execError = error as ExecError;
    const errorMessage = execError.message || String(error);
    const errorStdOut = (execError.stdout || "").replace(/^\n+/, "");

    if (
      errorMessage.includes("command not found") ||
      errorMessage.includes("ENOENT")
    ) {
      throw new Error(
        `Failed to execute npm script '${scriptName}': npm command not found. Please ensure npm is installed and accessible. You can install npm by running 'brew install node' (macOS) or visiting https://nodejs.org/`
      );
    }

    throw new Error(
      `Failed to execute npm script '${scriptName}': ${errorMessage} \n ${errorStdOut}`
    );
  }
};
