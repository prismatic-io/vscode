import { StateManager } from "@extension/StateManager";
import { getActiveIntegrationPath } from "@/extension/lib/getActiveIntegrationPath";
import type { ExecutablePath } from "@/extension/lib/resolveExecutable";
import { resolvePrismExecutable } from "@/extension/lib/resolveExecutable";
import { runExecutable } from "@/extension/lib/runCommand";

export class PrismCLIManager {
  private static instance: PrismCLIManager | null = null;
  private stateManager: StateManager;
  private prismExecutable: ExecutablePath;

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
      const prismExecutable = await resolvePrismExecutable();

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
   * @param command - The command to execute
   * @param options - Optional settings for execution
   * @returns A promise that resolves to an object containing stdout and stderr
   */
  public async executeCommand(
    command: string,
    options?: { fromWorkspace?: boolean; accessToken?: string },
  ): Promise<{ stdout: string; stderr: string }> {
    const globalState = await this.stateManager.getGlobalState();

    if (!globalState?.prismaticUrl) {
      throw new Error(
        "Prismatic URL is not set. Please set it using the 'Prismatic URL' command.",
      );
    }

    const cwd = options?.fromWorkspace ? getActiveIntegrationPath() : undefined;

    // Exclude DEBUG to prevent debug noise from CNI projects
    const { DEBUG: _, ...execEnv } = process.env;

    try {
      return await runExecutable(this.prismExecutable, [command], {
        cwd,
        env: {
          ...execEnv,
          PRISMATIC_URL: globalState.prismaticUrl,
          ...(options?.accessToken && {
            PRISM_ACCESS_TOKEN: options.accessToken,
          }),
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to execute Prismatic CLI command: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Imports an integration into Prismatic from the current project.
   * @param accessToken - The access token to authenticate the CLI command
   * @returns A promise that resolves to the integration ID
   */
  public async integrationsImport(accessToken: string): Promise<string> {
    const { stdout } = await this.executeCommand("integrations:import", {
      fromWorkspace: true,
      accessToken,
    });

    return stdout.trim();
  }

  /**
   * Disposes of the PrismCLIManager instance.
   */
  public dispose(): void {
    PrismCLIManager.instance = null;
  }
}
