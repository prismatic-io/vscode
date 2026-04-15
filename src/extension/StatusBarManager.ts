import path from "node:path";
import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";

export class StatusBarManager {
  private userStatusBarItem: vscode.StatusBarItem;
  private integrationStatusBarItem: vscode.StatusBarItem;
  private authManager: AuthManager;
  private stateManager: StateManager;

  constructor(
    authManager: AuthManager,
    stateManager: StateManager,
    context: vscode.ExtensionContext,
  ) {
    this.authManager = authManager;
    this.stateManager = stateManager;

    // Create User/Org status bar item (left side, priority 0 = far left)
    this.userStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.userStatus",
      vscode.StatusBarAlignment.Left,
      0,
    );
    this.userStatusBarItem.name = "Prismatic User";
    this.userStatusBarItem.command = "prismatic.switchTenant";

    // Create Active Integration status bar item (left side, priority -1 = right of user item)
    this.integrationStatusBarItem = vscode.window.createStatusBarItem(
      "prismatic.integrationStatus",
      vscode.StatusBarAlignment.Left,
      -1,
    );
    this.integrationStatusBarItem.name = "Prismatic Integration";
    this.integrationStatusBarItem.command = "prismatic.integrations.select";

    context.subscriptions.push(
      this,
      authManager.onDidChangeAuth(() => {
        void this.updateUserStatusBar();
      }),
    );

    void this.updateUserStatusBar();
    void this.updateIntegrationStatusBar();
  }

  /**
   * Updates the user/organization status bar item.
   */
  public async updateUserStatusBar(): Promise<void> {
    try {
      const userInfo = await this.authManager.getCurrentUser();

      this.userStatusBarItem.text = `$(prismatic-logo) ${userInfo.organization || "Logged in"}`;
      this.userStatusBarItem.tooltip = new vscode.MarkdownString(
        `**Prismatic User**\n\n` +
          `- **Name:** ${userInfo.name}\n` +
          `- **Email:** ${userInfo.email}\n` +
          `- **Organization:** ${userInfo.organization}\n` +
          `- **Endpoint:** ${userInfo.endpointUrl}`,
      );
      this.userStatusBarItem.show();
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

  public dispose(): void {
    this.userStatusBarItem.dispose();
    this.integrationStatusBarItem.dispose();
  }
}
