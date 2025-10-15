import { existsSync } from "node:fs";
import * as vscode from "vscode";
import type { ExecutablePath } from "@/extension/lib/findExecutable";

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

  if (customPath && customPath.trim() !== "") {
    const resolvedPath = customPath.trim();

    if (existsSync(resolvedPath)) {
      console.log(`${logPrefix}: Using configured path:`, resolvedPath);

      return {
        command: resolvedPath,
        args: [],
        isNpx: false,
      };
    }

    console.warn(
      `${logPrefix}: Configured path '${resolvedPath}' does not exist. Falling back to auto-detection.`,
    );
  }

  return null;
};
