import { existsSync } from "node:fs";
import { x } from "tinyexec";
import * as vscode from "vscode";

export interface ExecutablePath {
  command: string;
  args: string[];
  isNpx: boolean;
}

function getConfiguredPath(configKey: string): ExecutablePath | null {
  const config = vscode.workspace.getConfiguration("prismatic");
  const customPath = config.get<string>(configKey);

  if (!customPath || customPath.trim() === "") {
    return null;
  }

  const resolvedPath = customPath.trim();

  if (existsSync(resolvedPath)) {
    return { command: resolvedPath, args: [], isNpx: false };
  }

  console.warn(
    `Configured path '${resolvedPath}' does not exist. Falling back to PATH lookup.`,
  );
  return null;
}

async function findOnPath(name: string): Promise<string | null> {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = await x(cmd, [name], { throwOnError: true });
    const path = result.stdout.split(/\r?\n/)[0]?.trim();
    return path || null;
  } catch {
    return null;
  }
}

async function isNpxAvailable(packageName: string): Promise<boolean> {
  try {
    await x("npx", [packageName, "--version"], { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

export async function resolveNpmExecutable(): Promise<ExecutablePath | null> {
  const configured = getConfiguredPath("npmCliPath");
  if (configured) return configured;

  const npmPath = await findOnPath("npm");
  if (npmPath) return { command: npmPath, args: [], isNpx: false };

  return null;
}

export async function resolvePrismExecutable(): Promise<ExecutablePath | null> {
  const configured = getConfiguredPath("prismCliPath");
  if (configured) return configured;

  const prismPath = await findOnPath("prism");
  if (prismPath) return { command: prismPath, args: [], isNpx: false };

  if (await isNpxAvailable("@prismatic-io/prism")) {
    return { command: "npx", args: ["@prismatic-io/prism"], isNpx: true };
  }

  return null;
}
