import { existsSync } from "node:fs";
import { detect, type Agent as PackageManager } from "package-manager-detector";
import { x } from "tinyexec";
import * as vscode from "vscode";

export type { PackageManager };

export interface ExecutablePath {
  command: string;
  args: string[];
}

export interface PackageManagerResolution {
  packageManager: PackageManager;
  executable: ExecutablePath | null;
  detectedFromProject: boolean;
}

const getConfiguredPath = (configKey: string): ExecutablePath | null => {
  const config = vscode.workspace.getConfiguration("prismatic");
  const customPath = config.get<string>(configKey);

  if (!customPath || customPath.trim() === "") {
    return null;
  }

  const resolvedPath = customPath.trim();

  if (existsSync(resolvedPath)) {
    return { command: resolvedPath, args: [] };
  }

  console.warn(
    `Configured path '${resolvedPath}' does not exist. Falling back to PATH lookup.`,
  );
  return null;
};

const findOnPath = async (name: string): Promise<string | null> => {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = await x(cmd, [name], { throwOnError: true });
    const path = result.stdout.split(/\r?\n/)[0]?.trim();
    return path || null;
  } catch {
    return null;
  }
};

const isNpxAvailable = async (packageName: string): Promise<boolean> => {
  try {
    await x("npx", [packageName, "--version"], { throwOnError: true });
    return true;
  } catch {
    return false;
  }
};

export const packageManagerBinary = (pm: PackageManager): string =>
  pm.split("@")[0];

export const resolvePackageManager = async (
  cwd: string,
): Promise<PackageManagerResolution> => {
  const detected = await detect({ cwd });
  const packageManager: PackageManager = detected?.agent ?? "npm";
  const detectedFromProject = detected !== null;

  const found = await findOnPath(packageManagerBinary(packageManager));
  const executable: ExecutablePath | null = found
    ? { command: found, args: [] }
    : null;

  return { packageManager, executable, detectedFromProject };
};

export const resolvePrismExecutable =
  async (): Promise<ExecutablePath | null> => {
    const configured = getConfiguredPath("prismCliPath");
    if (configured) return configured;

    const prismPath = await findOnPath("prism");
    if (prismPath) return { command: prismPath, args: [] };

    if (await isNpxAvailable("@prismatic-io/prism")) {
      return { command: "npx", args: ["@prismatic-io/prism"] };
    }

    return null;
  };
