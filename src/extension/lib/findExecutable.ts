import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface FindExecutablePathOptions {
  npxPackage?: string;
  logPrefix?: string;
}

export interface ExecutablePath {
  command: string;
  args: string[];
  isNpx: boolean;
}

export async function findExecutable(
  executable: string,
  options: FindExecutablePathOptions = {},
): Promise<ExecutablePath | null> {
  const { npxPackage, logPrefix = "findExecutable" } = options;

  try {
    const cmd =
      process.platform === "win32"
        ? `where ${executable}`
        : `which ${executable}`;

    const { stdout } = await execAsync(cmd);

    const result = stdout.split(/\r?\n/)[0].trim();

    if (result) {
      return {
        command: result,
        args: [],
        isNpx: false,
      };
    }
  } catch (error) {
    console.error(`${logPrefix}: Error finding ${executable}:`, error);
  }

  if (npxPackage) {
    try {
      await execAsync(`npx ${npxPackage} --version`);

      return {
        command: "npx",
        args: [npxPackage],
        isNpx: true,
      };
    } catch (error) {
      console.error(
        `${logPrefix}: npx package ${npxPackage} not available:`,
        error,
      );
    }
  }

  return null;
}
