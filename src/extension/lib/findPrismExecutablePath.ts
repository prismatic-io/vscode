import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { findExecutablePath } from "./findExecutablePath";

export async function findPrismExecutablePath(): Promise<string | null> {
  // Check if a custom path is configured
  const config = vscode.workspace.getConfiguration("prismatic");
  const customPath = config.get<string>("prismCliPath");

  if (customPath && customPath.trim() !== "") {
    const resolvedPath = customPath.trim();

    // Verify the custom path exists
    if (existsSync(resolvedPath)) {
      console.log("findPrismExecutablePath: Using configured path:", resolvedPath);
      return resolvedPath;
    }

    console.warn(
      `findPrismExecutablePath: Configured path '${resolvedPath}' does not exist. Falling back to auto-detection.`
    );
  }

  // Fall back to automatic detection
  return findExecutablePath("prism", {
    npxFallback: "@prismatic-io/prism",
    logPrefix: "findPrismExecutablePath",
  });
}
