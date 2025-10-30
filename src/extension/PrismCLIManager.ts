import { exec, spawn } from "node:child_process";
import * as os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import {
  buildExecCommand,
  buildSpawnCommand,
} from "@/extension/lib/buildCommand";
import type { ExecutablePath } from "@/extension/lib/findExecutable";
import { findPrismExecutable } from "@/extension/lib/findPrismExecutable";

const execAsync = promisify(exec);

export class PrismCLIManager {
  private static instance: PrismCLIManager | null = null;
  private stateManager: StateManager;
  private watcher: vscode.FileSystemWatcher | undefined;
  private prismExecutable: ExecutablePath;
  private prismConfigPath = path.join(
    os.homedir(),
    ".config",
    "prism",
    "config.yml",
  );

  private constructor(
    prismExecutable: ExecutablePath,
    stateManager: StateManager,
  ) {
    this.prismExecutable = prismExecutable;
    this.stateManager = stateManager;
  }

  /**
   * Gets the singleton instance of PrismCLIManager.
   * @returns {Promise<PrismCLIManager>} A promise that resolves to the singleton instance of PrismCLIManager
   */
  public static async getInstance(): Promise<PrismCLIManager> {
    if (!PrismCLIManager.instance) {
      const prismExecutable = await findPrismExecutable();

      if (!prismExecutable) {
        throw new Error(
          "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed on your system. Run 'npm install -g @prismatic-io/prism' to install it.",
        );
      }

      const stateManager = StateManager.getInstance();

      PrismCLIManager.instance = new PrismCLIManager(
        prismExecutable,
        stateManager,
      );
    }

    return PrismCLIManager.instance;
  }

  /**
   * Executes a Prismatic CLI command.
   * @param {string} command - The command to execute
   * @param {boolean} fromWorkspace - Whether to execute the command from the workspace
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves to an object containing stdout and stderr
   * @throws {Error} If CLI is not installed or command execution fails
   */
  public async executeCommand(
    command: string,
    fromWorkspace = false,
  ): Promise<{ stdout: string; stderr: string }> {
    const globalState = await this.stateManager.getGlobalState();

    if (!globalState?.prismaticUrl) {
      throw new Error(
        "Prismatic URL is not set. Please set it using the 'Prismatic URL' command.",
      );
    }

    const cwd = fromWorkspace
      ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      : undefined;

    try {
      const fullCommand = buildExecCommand(this.prismExecutable, [command]);

      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd,
        env: {
          ...process.env,
          PRISMATIC_URL: globalState.prismaticUrl,
          // explicitly override DEBUG to prevent Node's require from dumping debug data when CNI projects set DEBUG=true via dotenv
          DEBUG: undefined,
        },
      });

      return { stdout, stderr };
    } catch (error) {
      throw new Error(
        `Failed to execute Prismatic CLI command: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Initiates the Prismatic login process.
   * Opens the browser for authentication and handles the login flow.
   * @returns {Promise<string>} A promise that resolves to the login completion message
   * @throws {Error} If the login process fails
   */
  public async login(): Promise<string> {
    const globalState = await this.stateManager.getGlobalState();

    return new Promise((resolve, reject) => {
      const { command, args } = buildSpawnCommand(this.prismExecutable, [
        "login",
      ]);

      const loginProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PRISMATIC_URL: globalState?.prismaticUrl,
        },
      });

      let promptShown = false;
      let loginComplete = false;
      let lastMessage = "";

      loginProcess.stdout.on("data", (data) => {
        const chunk = data.toString();
        lastMessage = chunk.trim();

        if (chunk.includes("Login complete!")) {
          loginComplete = true;
          resolve(lastMessage);
        }
      });

      loginProcess.stderr.on("data", (data) => {
        const chunk = data.toString();

        if (
          chunk.includes(
            "Press any key to open prismatic.io in your default browser",
          ) &&
          !promptShown
        ) {
          promptShown = true;
          loginProcess.stdin.write("\n");
        }
      });

      loginProcess.on("close", (code) => {
        if (!loginComplete) {
          if (code === 126) {
            const pathInfo = buildExecCommand(this.prismExecutable);
            reject(
              new Error(
                `Prismatic CLI was found but could not be executed (exit code 126). Path: ${pathInfo}. Please check that it is installed correctly and is executable.`,
              ),
            );
          } else if (code === 127) {
            reject(
              new Error(
                "Prismatic CLI was not found (exit code 127). Please ensure @prismatic-io/prism is installed and in your PATH.",
              ),
            );
          } else {
            code === 0
              ? resolve(lastMessage)
              : reject(new Error(`Login process exited with code ${code}`));
          }
        }
      });

      loginProcess.on("error", (error) => {
        reject(
          new Error(
            `Failed to start login process: ${error.message}\nPlease ensure @prismatic-io/prism is installed and executable.`,
          ),
        );
      });
    });
  }

  /**
   * Logs out the current user from Prismatic.
   * @returns {Promise<string>} A promise that resolves to the logout confirmation message
   */
  public async logout(): Promise<string> {
    const { stdout } = await this.executeCommand("logout");

    await this.stateManager.updateGlobalState({
      accessToken: undefined,
      refreshToken: undefined,
    });

    return stdout.trim();
  }

  /**
   * Retrieves information about the currently logged-in user.
   * @returns {Promise<string>} A promise that resolves to the user information
   */
  public async me(): Promise<string> {
    const { stdout } = await this.executeCommand("me");

    return stdout.trim();
  }

  /**
   * Retrieves the access or refresh token for the current user.
   * @param {('access'|'refresh')} [type] - The type of token to retrieve (access or refresh)
   * @returns {Promise<string>} A promise that resolves to the requested token
   */
  public async meToken(type?: "access" | "refresh"): Promise<string> {
    const typeArg = type ? `--type="${type}"` : "";

    const { stdout } = await this.executeCommand(`me:token ${typeArg}`);

    return stdout.trim();
  }

  /**
   * Imports an integration into Prismatic from the current project.
   * @returns {Promise<string>} A promise that resolves to the integration ID
   */
  public async integrationsImport(): Promise<string> {
    const { stdout } = await this.executeCommand("integrations:import", true);

    return stdout.trim();
  }

  /**
   * Monitors the Prismatic configuration file for changes.
   * Sets up a file system watcher to listen for changes in the config file.
   * @param onConfigChange Callback for when config file changes or is created
   * @param onConfigDelete Callback for when config file is deleted
   */
  public monitorPrismConfig(
    onConfigChange: () => Promise<void>,
    onConfigDelete: () => Promise<void>,
  ): void {
    const prismConfigDir = path.dirname(this.prismConfigPath);
    const configFileName = path.basename(this.prismConfigPath);

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(prismConfigDir, configFileName),
    );

    this.watcher.onDidChange(async (uri) => {
      if (uri.fsPath === this.prismConfigPath) {
        await onConfigChange();
      }
    });

    this.watcher.onDidCreate(async (uri) => {
      if (uri.fsPath === this.prismConfigPath) {
        await onConfigChange();
      }
    });

    this.watcher.onDidDelete(async (uri) => {
      if (uri.fsPath === this.prismConfigPath) {
        await onConfigDelete();
      }
    });
  }

  /**
   * Disposes of the PrismCLIManager instance.
   */
  public dispose(): void {
    PrismCLIManager.instance = null;
    this.watcher?.dispose();
  }
}
