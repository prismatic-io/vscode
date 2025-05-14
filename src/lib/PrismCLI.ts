import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import * as path from "node:path";

const execAsync = promisify(exec);

export class PrismCLI {
  private static instance: PrismCLI;
  private prismPath: string;

  private constructor() {
    const extensionPath =
      vscode.extensions.getExtension("prismatic.prismatic-extension")
        ?.extensionPath || "";
    this.prismPath = path.join(extensionPath, "node_modules", ".bin", "prism");
  }

  public static getInstance(): PrismCLI {
    if (!PrismCLI.instance) {
      PrismCLI.instance = new PrismCLI();
    }

    return PrismCLI.instance;
  }

  private async checkCLIInstallation(): Promise<boolean> {
    try {
      await execAsync(`node "${this.prismPath}" --version`);
      return true;
    } catch {
      return false;
    }
  }

  public async executeCommand(
    command: string
  ): Promise<{ stdout: string; stderr: string }> {
    const isInstalled = await this.checkCLIInstallation();

    if (!isInstalled) {
      throw new Error(
        "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed in your project dependencies."
      );
    }

    try {
      const { stdout, stderr } = await execAsync(
        `node "${this.prismPath}" ${command}`
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

  public async isLoggedIn(): Promise<boolean> {
    try {
      const result = await this.me();

      return !result.includes("Error: You are not logged");
    } catch {
      return false;
    }
  }

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

  public async logout(): Promise<string> {
    const { stdout } = await this.executeCommand("logout");

    return stdout.trim();
  }

  public async me(): Promise<string> {
    const { stdout } = await this.executeCommand("me");

    return stdout.trim();
  }

  public async meToken(type?: "access" | "refresh"): Promise<string> {
    const typeArg = type ? `--type="${type}"` : "";

    const { stdout } = await this.executeCommand(`me:token ${typeArg}`);

    return stdout.trim();
  }

  public async version(): Promise<string> {
    const { stdout } = await this.executeCommand("--version");

    return stdout.trim();
  }
}
