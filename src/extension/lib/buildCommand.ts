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
    const command = `npx ${allArgs.join(" ")}`;

    log("COMMAND", `buildExecCommand: Using npx: ${command}`);

    return command;
  } else {
    const command = `"${executable.command}" ${allArgs.join(" ")}`;

    log("COMMAND", `buildExecCommand: Using direct executable: ${command}`);

    return command;
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
    const result = {
      command: "npx",
      args: allArgs,
    };

    log(
      "COMMAND",
      `buildSpawnCommand: Using npx: npx ${result.args.join(" ")}`,
    );

    return result;
  }

  const result = {
    command: executable.command,
    args: allArgs,
  };

  log(
    "COMMAND",
    `buildSpawnCommand: Using direct executable: ${result.command}`,
  );

  return result;
}
