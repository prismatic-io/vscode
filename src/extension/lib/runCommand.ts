import type { SpawnOptions } from "node:child_process";
import { type Result, x } from "tinyexec";
import * as vscode from "vscode";
import { log } from "@/extension";
import type { ExecutablePath } from "./resolveExecutable";

export interface RunResult {
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function resolveCommandAndArgs(
  executable: ExecutablePath,
  additionalArgs: string[],
): { command: string; args: string[] } {
  return {
    command: executable.command,
    args: [...executable.args, ...additionalArgs],
  };
}

export async function runExecutable(
  executable: ExecutablePath,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { command, args: resolvedArgs } = resolveCommandAndArgs(
    executable,
    args,
  );

  logExecContext({
    command: `${command} ${resolvedArgs.join(" ")}`,
    cwd: options.cwd,
    env: options.env,
  });

  const result = await x(command, resolvedArgs, {
    nodeOptions: {
      cwd: options.cwd,
      env: options.env,
    },
  });

  if (result.exitCode !== 0) {
    const error = new Error(
      `Command failed with exit code ${result.exitCode}: ${command} ${resolvedArgs.join(" ")}${result.stderr ? `\n${result.stderr.trim()}` : ""}`,
    );
    throw Object.assign(error, {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  }

  return { stdout: result.stdout, stderr: result.stderr };
}

export function spawnExecutable(
  executable: ExecutablePath,
  args: string[],
  options: RunOptions & { nodeOptions?: SpawnOptions } = {},
): Result {
  const { command, args: resolvedArgs } = resolveCommandAndArgs(
    executable,
    args,
  );
  const { cwd, env, nodeOptions } = options;

  logExecContext({
    command: `${command} ${resolvedArgs.join(" ")}`,
    cwd,
    env,
  });

  const result = x(command, resolvedArgs, {
    nodeOptions: { cwd, env, ...nodeOptions },
  });

  return result;
}

interface ExecLogOptions {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function logExecContext(options: ExecLogOptions): void {
  const config = vscode.workspace.getConfiguration("prismatic");
  const debugMode = config.get<string>("debugMode", "off");

  if (debugMode === "off") return;

  const { command, cwd, env } = options;

  const debugInfo = [
    `\nCOMMAND: ${command}`,
    `CWD: ${cwd ?? "system"}`,
    `NODE VERSION: ${process.version}`,
  ];

  if (debugMode === "verbose") {
    debugInfo.push(`ENV:\n${JSON.stringify(env ?? {}, null, 2)}`);
  }

  log("DEBUG", `${debugInfo.join("\n")}\n`);
}
