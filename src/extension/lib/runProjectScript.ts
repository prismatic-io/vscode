import { existsSync } from "node:fs";
import path from "node:path";
import { INSTALL_PAGE, resolveCommand } from "package-manager-detector";
import * as vscode from "vscode";
import { log } from "@/extension";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import {
  type ExecutablePath,
  type PackageManager,
  packageManagerBinary,
  resolvePackageManager,
} from "@/extension/lib/resolveExecutable";
import { runExecutable, spawnExecutable } from "@/extension/lib/runCommand";

const ensureDependenciesInstalled = async ({
  integrationPath,
  packageManager,
  executable,
}: {
  integrationPath: string;
  packageManager: PackageManager;
  executable: ExecutablePath;
}): Promise<void> => {
  if (existsSync(path.join(integrationPath, "node_modules"))) return;

  const binary = packageManagerBinary(packageManager);
  const installArgs = ["install"];
  const installLabel = `${binary} ${installArgs.join(" ")}`;

  const choice = await vscode.window.showWarningMessage(
    `Dependencies aren't installed for this integration. Run '${installLabel}' now?`,
    { modal: true },
    "Install",
  );

  if (choice !== "Install") {
    throw new Error(
      `Dependencies are not installed. Run '${installLabel}' in ${integrationPath} and try again.`,
    );
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Running ${installLabel}…`,
      cancellable: false,
    },
    async () => {
      const proc = spawnExecutable(executable, installArgs, {
        cwd: integrationPath,
      });

      for await (const line of proc) {
        log("INFO", line);
      }

      if (proc.exitCode !== 0) {
        throw new Error(
          `${installLabel} exited with code ${proc.exitCode}. See the Prismatic output channel for details.`,
        );
      }
    },
  );
};

export const runProjectScript = async (
  integrationPath: string,
  scriptName: string,
): Promise<{ stdout: string; stderr: string }> => {
  const { workspaceFolderPath, fileData: packageFileData } =
    getWorkspaceJsonFile({
      workspaceFolderPath: integrationPath,
      fileName: "package.json",
    });

  if (!packageFileData) {
    throw new Error(
      `No package.json found in the active integration. Please ensure it exists in: ${integrationPath}`,
    );
  }

  const { packageManager, executable } =
    await resolvePackageManager(workspaceFolderPath);

  if (!executable) {
    const installHint = INSTALL_PAGE[packageManager]
      ? ` See ${INSTALL_PAGE[packageManager]} for install instructions.`
      : "";
    throw new Error(
      `Detected '${packageManager}' as the project's package manager, but the '${packageManagerBinary(packageManager)}' executable was not found on PATH.${installHint}`,
    );
  }

  await ensureDependenciesInstalled({
    integrationPath: workspaceFolderPath,
    packageManager,
    executable,
  });

  const runCommand = resolveCommand(packageManager, "run", [scriptName]);
  const runArgs = runCommand?.args ?? ["run", scriptName];

  // Exclude DEBUG to prevent debug noise from CNI projects
  const { DEBUG: _, ...execEnv } = process.env;

  try {
    return await runExecutable(executable, runArgs, {
      cwd: workspaceFolderPath,
      env: execEnv,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const execError = error as { stdout?: string; stderr?: string };
    const errorStdout = (execError.stdout || "").trim();
    const errorStderr = (execError.stderr || "").trim();

    const details = [
      `Failed to execute '${packageManager} run ${scriptName}'`,
      errorMessage,
      errorStdout && `stdout: ${errorStdout}`,
      errorStderr && `stderr: ${errorStderr}`,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(details);
  }
};
