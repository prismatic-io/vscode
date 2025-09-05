import { promisify } from "node:util";
import { exec, spawn } from "node:child_process";
import * as vscode from "vscode";
import { findPrismPath } from "@/extension/findPrismPath";
import { StateManager } from "@extension/StateManager";

const execAsync = promisify(exec);

export class PrismCLIManager {
  private static instance: PrismCLIManager | null = null;
  private prismPath: string;
  private stateManager: StateManager;

  private constructor(prismPath: string) {
    this.prismPath = prismPath;
    this.stateManager = StateManager.getInstance();
  }

  /**
   * Gets the singleton instance of PrismCLIManager.
   * @returns {Promise<PrismCLIManager>} A promise that resolves to the singleton instance of PrismCLIManager
   */
  public static async getInstance(): Promise<PrismCLIManager> {
    if (!PrismCLIManager.instance) {
      const prismPath = await PrismCLIManager.initializePrismPath();
      PrismCLIManager.instance = new PrismCLIManager(prismPath);
    }

    return PrismCLIManager.instance;
  }

  /**
   * Initializes the Prismatic CLI path.
   * @returns {Promise<string>} A promise that resolves to the Prismatic CLI path
   */
  static async initializePrismPath(): Promise<string> {
    const prismPath = await findPrismPath();

    if (!prismPath) {
      throw new Error(
        "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed on your system. Run 'npm install -g @prismatic-io/prism' to install it."
      );
    }

    return prismPath;
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
    fromWorkspace = false
  ): Promise<{ stdout: string; stderr: string }> {
    const globalState = await this.stateManager.getGlobalState();

    if (!globalState?.prismaticUrl) {
      throw new Error(
        "Prismatic URL is not set. Please set it using the 'Prismatic URL' command."
      );
    }

    const cwd = fromWorkspace
      ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      : undefined;

    try {
      const { stdout, stderr } = await execAsync(
        `"${this.prismPath}" ${command}`,
        {
          cwd,
          env: {
            ...process.env,
            PRISMATIC_URL: globalState.prismaticUrl,
            // note: explicitly override DEBUG to prevent Node's require from dumping debug data when CNI projects set DEBUG=true via dotenv
            DEBUG: "false",
          },
        }
      );

      return { stdout, stderr };
    } catch (error) {
      throw new Error(
        `Failed to execute Prismatic CLI command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Checks if the user is currently logged in to Prismatic.
   * @returns {Promise<boolean>} A promise that resolves to true if logged in, false otherwise
   */
  public async isLoggedIn(): Promise<boolean> {
    try {
      const result = await this.me();

      return !result.includes("Error: You are not logged");
    } catch {
      return false;
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
      const loginProcess = spawn(this.prismPath, ["login"], {
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
            "Press any key to open prismatic.io in your default browser"
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
            reject(
              new Error(
                "Prismatic CLI was found but could not be executed (exit code 126). Please check that it is installed correctly and is executable."
              )
            );
          } else if (code === 127) {
            reject(
              new Error(
                "Prismatic CLI was not found (exit code 127). Please ensure @prismatic-io/prism is installed and in your PATH."
              )
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
            `Failed to start login process: ${error.message}\nPlease ensure @prismatic-io/prism is installed and executable.`
          )
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
   * Disposes of the PrismCLIManager instance.
   */
  public dispose(): void {
    PrismCLIManager.instance = null;
  }
}
