import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import * as path from "node:path";

const execAsync = promisify(exec);

export class PrismCLI {
  private static instance: PrismCLI | null = null;
  private prismPath: string;

  private constructor() {
    const extensionPath =
      vscode.extensions.getExtension("prismatic.prismatic-extension")
        ?.extensionPath || "";
    this.prismPath = path.join(extensionPath, "node_modules", ".bin", "prism");
  }

  /**
   * Gets the singleton instance of PrismCLI.
   * @returns {PrismCLI} The singleton instance of PrismCLI
   */
  public static getInstance(): PrismCLI {
    if (!PrismCLI.instance) {
      PrismCLI.instance = new PrismCLI();
    }

    return PrismCLI.instance;
  }

  /**
   * Checks if the Prismatic CLI is properly installed.
   * @returns {Promise<boolean>} A promise that resolves to true if CLI is installed, false otherwise
   */
  private async checkCLIInstallation(): Promise<boolean> {
    try {
      await execAsync(`node "${this.prismPath}" --version`);
      return true;
    } catch {
      return false;
    }
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
    const isInstalled = await this.checkCLIInstallation();

    if (!isInstalled) {
      throw new Error(
        "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed in your project dependencies."
      );
    }

    const cwd = fromWorkspace
      ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      : undefined;

    try {
      const { stdout, stderr } = await execAsync(
        `node "${this.prismPath}" ${command}`,
        { cwd }
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
    return new Promise((resolve, reject) => {
      const loginProcess = spawn("node", [this.prismPath, "login"], {
        stdio: ["pipe", "pipe", "pipe"],
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
          code === 0
            ? resolve(lastMessage)
            : reject(new Error(`Login process exited with code ${code}`));
        }
      });

      loginProcess.on("error", (error) => {
        reject(new Error(`Failed to start login process: ${error.message}`));
      });
    });
  }

  /**
   * Logs out the current user from Prismatic.
   * @returns {Promise<string>} A promise that resolves to the logout confirmation message
   */
  public async logout(): Promise<string> {
    const { stdout } = await this.executeCommand("logout");

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
   * Retrieves the version of the installed Prism CLI.
   * @returns {Promise<string>} A promise that resolves to the CLI version
   */
  public async version(): Promise<string> {
    const { stdout } = await this.executeCommand("--version");

    return stdout.trim();
  }

  /**
   * Imports an integration into Prismatic from the current project.
   * @returns {Promise<string>} A promise that resolves to the integration ID
   */
  public async integrationImport(): Promise<string> {
    const { stdout } = await this.executeCommand("integrations:import", true);

    return stdout.trim();
  }

  /**
   * Disposes of the PrismCLI instance.
   */
  public dispose(): void {
    PrismCLI.instance = null;
  }
}
