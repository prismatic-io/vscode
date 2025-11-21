import { execSync } from "node:child_process";
import * as vscode from "vscode";
import { log } from "@/extension";
import type { ExecutablePath } from "./findExecutable";

/**
 * Builds a command string from an ExecutablePath object for use with exec().
 * @param executable - The ExecutablePath object containing command and args
 * @param additionalArgs - Additional arguments to append to the command
 * @returns The complete command string ready for execution with exec()
 * @example "npx --yes npm run build" or "/path/to/npm run build"
 */
export function buildExecCommand(
  executable: ExecutablePath,
  additionalArgs: string[] = [],
): string {
  const allArgs = [...executable.args, ...additionalArgs];

  if (executable.isNpx) {
    return `npx ${allArgs.join(" ")}`;
  } else {
    return `"${executable.command}" ${allArgs.join(" ")}`;
  }
}

/**
 * Builds command and args from an ExecutablePath object for use with spawn().
 * @param executable - The ExecutablePath object containing command and args
 * @param additionalArgs - Additional arguments to append to the command
 * @returns Object with command and args suitable for spawn()
 * @example { command: "npx", args: ["--yes", "npm", "run", "build"] } or { command: "/path/to/npm", args: ["run", "build"] }
 */
export function buildSpawnCommand(
  executable: ExecutablePath,
  additionalArgs: string[] = [],
): { command: string; args: string[] } {
  const allArgs = [...executable.args, ...additionalArgs];

  if (executable.isNpx) {
    return {
      command: "npx",
      args: allArgs,
    };
  }

  return {
    command: executable.command,
    args: allArgs,
  };
}

export interface ExecLogOptions {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Logs execution context for debugging purposes.
 * Call this before execAsync to log command, node version, cwd, and env variables.
 */
export function logExecContext(options: ExecLogOptions): void {
  const config = vscode.workspace.getConfiguration("prismatic");
  const debugMode = config.get<string>("debugMode", "off");

  if (debugMode === "off") {
    return;
  }

  const { command, cwd, env } = options;
  let nodeVersion: string;

  try {
    nodeVersion = execSync("node --version", {
      encoding: "utf-8",
      cwd,
    }).trim();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    nodeVersion = `not found \nERROR: ${errorMessage}`;
  }

  const debugInfo = [
    `\nCOMMAND: ${command}`,
    `CWD: ${cwd ?? "system"}`,
    `NODE VERSION: ${nodeVersion}`,
  ];

  if (debugMode === "verbose") {
    debugInfo.push(`ENV:\n${JSON.stringify(env ?? {}, null, 2)}`);
  }

  log("DEBUG", `${debugInfo.join("\n")}\n`);
}
