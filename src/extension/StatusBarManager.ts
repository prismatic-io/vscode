import path from "node:path";
import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";

export interface PrismUserInfo {
  name: string;
  email: string;
  organization: string;
  endpointUrl: string;
}

export class StatusBarManager {
  private static instance: StatusBarManager | null = null;

  private userStatusBarItem: vscode.StatusBarItem;
  private integrationStatusBarItem: vscode.StatusBarItem;
  private authManager: AuthManager;
  private stateManager: StateManager;

  private constructor(authManager: AuthManager, stateManager: StateManager) {
    this.authManager = authManager;
    this.stateManager = stateManager;

    // Create User/Org status bar item (left side, priority 0 = far left)
    this.userStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.userStatus",
      vscode.StatusBarAlignment.Left,
      0,
    );
    this.userStatusBarItem.name = "Prismatic User";
    this.userStatusBarItem.command = "prismatic.me";

    // Create Active Integration status bar item (left side, priority -1 = right of user item)
    this.integrationStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.integrationStatus",
      vscode.StatusBarAlignment.Left,
      -1,
    );
    this.integrationStatusBarItem.name = "Prismatic Integration";
    this.integrationStatusBarItem.command = "prismatic.integrations.select";
  }

  /**
   * Initializes and returns the singleton StatusBarManager instance.
   */
  public static async initialize(
    authManager: AuthManager,
    stateManager: StateManager,
    context: vscode.ExtensionContext,
  ): Promise<StatusBarManager> {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager(
        authManager,
        stateManager,
      );

      // Register for disposal
      context.subscriptions.push(
        StatusBarManager.instance.userStatusBarItem,
        StatusBarManager.instance.integrationStatusBarItem,
      );

      // Initial update
      await StatusBarManager.instance.updateUserStatusBar();
      await StatusBarManager.instance.updateIntegrationStatusBar();
    }
    return StatusBarManager.instance;
  }

  /**
   * Gets the singleton instance.
   */
  public static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      throw new Error(
        "StatusBarManager not initialized. Call initialize() first.",
      );
    }
    return StatusBarManager.instance;
  }

  /**
   * Parses the output of `prism me` command.
   * Expected format:
   *   Name: Jake Hagle
   *   Email: jake@example.com
   *   Organization: Prismatic Internal
   *   Endpoint URL: https://app.prismatic.io
   */
  private parsePrismMeOutput(output: string): PrismUserInfo | null {
    try {
      const lines = output.trim().split("\n");
      const info: Partial<PrismUserInfo> = {};

      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        switch (key.trim().toLowerCase()) {
          case "name":
            info.name = value;
            break;
          case "email":
            info.email = value;
            break;
          case "organization":
            info.organization = value;
            break;
          case "endpoint url":
            info.endpointUrl = value;
            break;
        }
      }

      if (info.email && info.organization) {
        return info as PrismUserInfo;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Updates the user/organization status bar item.
   */
  public async updateUserStatusBar(): Promise<void> {
    try {
      const meOutput = await this.authManager.getCurrentUser();
      const userInfo = this.parsePrismMeOutput(meOutput);

      if (userInfo) {
        this.userStatusBarItem.text = `$(prismatic-logo) ${userInfo.organization}`;
        this.userStatusBarItem.tooltip = new vscode.MarkdownString(
          `**Prismatic User**\n\n` +
            `- **Name:** ${userInfo.name}\n` +
            `- **Email:** ${userInfo.email}\n` +
            `- **Organization:** ${userInfo.organization}\n` +
            `- **Endpoint:** ${userInfo.endpointUrl}`,
        );
        this.userStatusBarItem.show();
      } else {
        // Fallback if parsing fails
        this.userStatusBarItem.text = "$(prismatic-logo) Logged in";
        this.userStatusBarItem.tooltip = "Prismatic: Logged in";
        this.userStatusBarItem.show();
      }
    } catch {
      // On error (e.g., not logged in), show "Not logged in"
      this.userStatusBarItem.text = "$(prismatic-logo) Not logged in";
      this.userStatusBarItem.tooltip =
        "Prismatic: Not logged in. Use 'Prismatic: Login' command.";
      this.userStatusBarItem.show();
    }
  }

  /**
   * Updates the active integration status bar item.
   */
  public async updateIntegrationStatusBar(): Promise<void> {
    try {
      const workspaceState = await this.stateManager.getWorkspaceState();
      const activeIntegrationPath = workspaceState?.activeIntegrationPath;

      if (activeIntegrationPath) {
        const integrationName = path.basename(activeIntegrationPath);
        this.integrationStatusBarItem.text = `$(prismatic-logo) ${integrationName}`;
        this.integrationStatusBarItem.tooltip = new vscode.MarkdownString(
          `**Active Integration**\n\n` +
            `- **Name:** ${integrationName}\n` +
            `- **Path:** ${activeIntegrationPath}`,
        );
        this.integrationStatusBarItem.show();
      } else {
        this.integrationStatusBarItem.text = "$(prismatic-logo) No integration";
        this.integrationStatusBarItem.tooltip =
          "Prismatic: No integration selected";
        this.integrationStatusBarItem.show();
      }
    } catch {
      this.integrationStatusBarItem.text = "$(prismatic-logo) No integration";
      this.integrationStatusBarItem.tooltip =
        "Prismatic: Error fetching integration info";
      this.integrationStatusBarItem.show();
    }
  }

  /**
   * Hides both status bar items.
   */
  public hide(): void {
    this.userStatusBarItem.hide();
    this.integrationStatusBarItem.hide();
  }

  /**
   * Shows both status bar items.
   */
  public show(): void {
    this.userStatusBarItem.show();
    this.integrationStatusBarItem.show();
  }

  /**
   * Disposes of the StatusBarManager.
   */
  public dispose(): void {
    this.userStatusBarItem.dispose();
    this.integrationStatusBarItem.dispose();
    StatusBarManager.instance = null;
  }
}
