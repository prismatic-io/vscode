import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as vscode from "vscode";
import type { ExecutablePath } from "@/extension/lib/findExecutable";
import { isWslRemote } from "./isWslRemote";

interface GetConfiguredExecutablePathProps {
  configKey: string;
  logPrefix: string;
}

/**
 * Attempts to read a custom executable path from VSCode workspace configuration.
 * Validates that the path exists before returning it.
 *
 * @param options - Configuration options
 * @returns ExecutablePath if a valid custom path is configured, null otherwise
 */
export const getConfiguredExecutablePath = ({
  configKey,
  logPrefix,
}: GetConfiguredExecutablePathProps): ExecutablePath | null => {
  const config = vscode.workspace.getConfiguration("prismatic");
  const customPath = config.get<string>(configKey);
  const isWsl = isWslRemote() && process.platform === "win32";

  if (customPath && customPath.trim() !== "") {
    const resolvedPath = customPath.trim();

    // Check if path exists - use wsl.exe for WSL paths
    let pathExists = false;
    if (isWsl) {
      try {
        // Use wsl.exe to check if the Linux path exists
        execSync(`wsl.exe test -f "${resolvedPath}"`, { stdio: "ignore" });
        pathExists = true;
      } catch {
        pathExists = false;
      }
    } else {
      pathExists = existsSync(resolvedPath);
    }

    if (pathExists) {
      console.log(`${logPrefix}: Using configured path:`, resolvedPath);

      return {
        command: resolvedPath,
        args: [],
        isNpx: false,
        isWsl,
      };
    }

    console.warn(
      `${logPrefix}: Configured path '${resolvedPath}' does not exist. Falling back to auto-detection.`,
    );
  }

  return null;
};
