import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isWslRemote } from "./isWslRemote";

const execAsync = promisify(exec);

interface FindExecutablePathOptions {
  npxPackage?: string;
  logPrefix?: string;
}

export interface ExecutablePath {
  command: string;
  args: string[];
  isNpx: boolean;
  isWsl: boolean;
}

export async function findExecutable(
  executable: string,
  options: FindExecutablePathOptions = {},
): Promise<ExecutablePath | null> {
  const { npxPackage, logPrefix = "findExecutable" } = options;
  const isWsl = isWslRemote() && process.platform === "win32";

  // Test if the package is available via npx
  if (npxPackage) {
    try {
      // In WSL remote, run npx via wsl.exe
      const npxCommand = isWsl
        ? `wsl.exe npx ${npxPackage} --version`
        : `npx ${npxPackage} --version`;

      await execAsync(npxCommand);

      return {
        command: "npx",
        args: [npxPackage],
        isNpx: true,
        isWsl,
      };
    } catch (error) {
      console.error(
        `${logPrefix}: npx package ${npxPackage} not available:`,
        error,
      );
    }
  }

  // Fallback to which/where for direct executable lookup
  try {
    let cmd: string;

    if (isWsl) {
      // In WSL remote on Windows, use wsl.exe to run which
      cmd = `wsl.exe which ${executable}`;
    } else if (process.platform === "win32") {
      cmd = `where ${executable}`;
    } else {
      cmd = `which ${executable}`;
    }

    const { stdout } = await execAsync(cmd);

    const result = stdout.split(/\r?\n/)[0].trim();

    if (result) {
      return {
        command: result,
        args: [],
        isNpx: false,
        isWsl,
      };
    }
  } catch (error) {
    console.error(`${logPrefix}: Error finding ${executable}:`, error);
  }

  return null;
}
