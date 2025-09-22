import * as vscode from "vscode";
import { StateManager } from "@extension/StateManager";
import { log } from "@/extension";
import type { IntegrationData, FlowData, ConfigPageData } from "@type/state";
import {
  IntegrationDiscovery,
  type SpectralFolderInfo,
} from "@/extension/lib/IntegrationDiscovery";
import {
  IntegrationListItem,
  type IntegrationTreeNode,
} from "./IntegrationListItems";

// Base tree node type for integrations list
type TreeNode = IntegrationTreeNode;

// Integration root node
export class IntegrationTreeItem extends vscode.TreeItem {
  constructor(
    public readonly integrationData: IntegrationData,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.Expanded,
  ) {
    super(integrationData.name || "Integration", collapsibleState);
    this.contextValue = "integration";

    // Build tooltip
    const tooltipParts = [this.label as string];
    if (this.integrationData.description) {
      tooltipParts.push(this.integrationData.description);
    }
    if (this.integrationData.versionNumber) {
      tooltipParts.push(`Version: ${this.integrationData.versionNumber}`);
    }
    if (this.integrationData.category) {
      tooltipParts.push(`Category: ${this.integrationData.category}`);
    }
    this.tooltip = tooltipParts.join("\n");

    // Add description
    if (this.integrationData.versionNumber) {
      this.description = `${this.integrationData.versionNumber}`;
    }

    // Icon
    this.iconPath = new vscode.ThemeIcon("package");
  }
}

// Status information node
export class StatusTreeItem extends vscode.TreeItem {
  constructor(
    public readonly configState: string,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    // Determine label based on config state
    let label: string;
    if (configState === "NOT_IMPORTED") {
      label = "Import Required";
    } else if (configState === "NO_DATA") {
      label = "No integration data";
    } else {
      const isConfigured = configState === "FULLY_CONFIGURED";
      label = isConfigured ? "Status: Configured" : "Status: Not Configured";
    }

    super(label, collapsibleState);
    this.contextValue = "status";

    // Handle special cases for IntegrationDetailsTreeDataProvider
    if (configState === "NOT_IMPORTED") {
      this.description = "Import to Prismatic to enable features";
      this.tooltip = "Click to import this integration to Prismatic";
      this.iconPath = new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("list.warningForeground"),
      );
      this.command = {
        command: "prismatic.integrations.import",
        title: "Import Integration",
        arguments: [],
      };
    } else if (configState === "NO_DATA") {
      this.description = "Select an imported integration";
      this.tooltip = "No integration data available";
      this.iconPath = new vscode.ThemeIcon("info");
    } else {
      // Regular status handling
      const isConfigured = configState === "FULLY_CONFIGURED";
      this.tooltip = isConfigured
        ? "Integration is fully configured and ready to test"
        : "Integration needs configuration";

      // Use different icons based on status
      this.iconPath = new vscode.ThemeIcon(
        isConfigured ? "pass-filled" : "warning",
        isConfigured
          ? new vscode.ThemeColor("testing.iconPassed")
          : new vscode.ThemeColor("list.warningForeground"),
      );
    }
  }
}

// Config Pages section container
export class ConfigPagesSectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly pageCount: number,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.Expanded,
  ) {
    super(`Config Pages (${pageCount})`, collapsibleState);
    this.contextValue = "configPages-section";
    this.tooltip = `${pageCount} config page${pageCount !== 1 ? "s" : ""} available`;
    this.iconPath = new vscode.ThemeIcon("settings-gear");
  }
}

// Individual config page node
export class ConfigPageTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly configPageData: ConfigPageData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.contextValue = "configPage";

    // Build tooltip with element information
    const tooltipParts = [this.label];
    if (
      this.configPageData.elements &&
      this.configPageData.elements.length > 0
    ) {
      tooltipParts.push(
        `Elements: ${this.configPageData.elements.map((e) => e.value).join(", ")}`,
      );
    }
    this.tooltip = tooltipParts.join("\n");

    // Add description showing number of elements
    if (this.configPageData.elements) {
      this.description = `${this.configPageData.elements.length} element${this.configPageData.elements.length !== 1 ? "s" : ""}`;
    }

    // Use settings icon
    this.iconPath = new vscode.ThemeIcon("settings");

    // // Set click command to open config page definition in editor
    this.command = {
      command: "prismatic.configPages.openInEditor",
      title: "Open Config Page Definition",
      arguments: [this.configPageData],
    };
  }
  // Make configPageData accessible for commands
  get pageName() {
    return this.configPageData.name;
  }
}

// Flows section container
export class FlowsSectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly flowCount: number,
    public readonly collapsibleState = vscode.TreeItemCollapsibleState.Expanded,
  ) {
    super(`Flows (${flowCount})`, collapsibleState);
    this.contextValue = "flows-section";
    this.tooltip = `${flowCount} flow${flowCount !== 1 ? "s" : ""} available`;
    this.iconPath = new vscode.ThemeIcon("globe");
  }
}

// Individual flow node
export class FlowTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly flowData: FlowData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.contextValue = "flow";

    // Build tooltip with available information
    const tooltipParts = [this.label];
    if (this.flowData.description) {
      tooltipParts.push(this.flowData.description);
    }
    if (this.flowData.testUrl) {
      tooltipParts.push(`Webhook: ${this.flowData.testUrl}`);
    }
    if (this.flowData.isSynchronous !== undefined) {
      tooltipParts.push(
        this.flowData.isSynchronous ? "Synchronous" : "Asynchronous",
      );
    }
    this.tooltip = tooltipParts.join("\n");

    // Add description field for additional context in tree
    if (this.flowData.description) {
      this.description = this.flowData.description;
    }

    // Use Prismatic icon as placeholder
    this.iconPath = new vscode.ThemeIcon("zap");

    // Set click command to open flow definition in editor
    this.command = {
      command: "prismatic.flows.openInEditor",
      title: "Open Flow Definition",
      arguments: [this.flowData],
    };
  }

  // Make flowData accessible for commands
  get flowId() {
    return this.flowData.id;
  }
  get flowName() {
    return this.flowData.name;
  }
  get testUrl() {
    return this.flowData.testUrl;
  }
  get testPayload() {
    return this.flowData.testPayload;
  }
  get isSynchronous() {
    return this.flowData.isSynchronous;
  }
  get usesFifoQueue() {
    return this.flowData.usesFifoQueue;
  }
}

export class IntegrationTreeDataProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  public activeIntegrationEmitter = new vscode.EventEmitter<
    SpectralFolderInfo | undefined
  >();
  readonly onDidChangeActiveIntegration = this.activeIntegrationEmitter.event;

  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | null | void
  > = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private isLoading = false;
  private integrations: SpectralFolderInfo[] = [];
  private activeIntegration: SpectralFolderInfo | undefined;

  constructor(private stateManager: StateManager) {}

  async setActiveIntegration(
    integration: SpectralFolderInfo | undefined,
  ): Promise<void> {
    this.activeIntegration = integration;
    await this.stateManager.setActiveIntegration(integration);
    this.activeIntegrationEmitter.fire(integration);
    this.refresh();
  }

  refresh(): void {
    log(
      "INFO",
      "[IntegrationTreeDataProvider] Refreshing integration tree view",
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Handle child nodes - IntegrationListItems have no children
    if (element) {
      return [];
    }

    // Root level - discover all integrations
    if (this.isLoading) {
      return [];
    }

    try {
      this.isLoading = true;

      // Discover all integrations in the workspace
      log("INFO", "[IntegrationTreeDataProvider] Discovering integrations...");
      this.integrations = await IntegrationDiscovery.findAllIntegrations();
      this.activeIntegration = await this.stateManager.getActiveIntegration();

      log(
        "INFO",
        `[IntegrationTreeDataProvider] Found ${this.integrations.length} integration(s)`,
      );

      // Set context variables for UI control
      await vscode.commands.executeCommand(
        "setContext",
        "prismatic.hasIntegrations",
        this.integrations.length > 0,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "prismatic.multipleIntegrations",
        this.integrations.length > 1,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "prismatic.hasActiveIntegration",
        !!this.activeIntegration,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "prismatic.activeIntegrationImported",
        this.activeIntegration?.hasPrismJson || false,
      );

      const globalState = await this.stateManager.getGlobalState();
      log(
        "INFO",
        `[IntegrationTreeDataProvider] Global state (without tokens): ${JSON.stringify(
          {
            prismaticUrl: globalState?.prismaticUrl,
            hasAccessToken: !!globalState?.accessToken,
            hasRefreshToken: !!globalState?.refreshToken,
          },
          null,
          2,
        )}`,
      );

      // Check if user is logged in
      if (!globalState?.accessToken || !globalState?.prismaticUrl) {
        // Return empty when not logged in
        return [];
      }

      // No integrations found
      if (this.integrations.length === 0) {
        log(
          "INFO",
          "[IntegrationTreeDataProvider] No integrations found in workspace",
        );
        // Return empty to show welcome view
        return [];
      }

      // Build the tree structure - show integrations directly without group
      return this.integrations.map(
        (integration) =>
          new IntegrationListItem(
            integration,
            integration.path === this.activeIntegration?.path,
          ),
      );
    } catch (error) {
      log(
        "ERROR",
        `[IntegrationTreeDataProvider] Failed to fetch integration: ${error}`,
      );
      log(
        "ERROR",
        `[IntegrationTreeDataProvider] Error details: ${JSON.stringify(error, null, 2)}`,
      );
      log(
        "ERROR",
        `[IntegrationTreeDataProvider] Stack trace: ${error instanceof Error ? error.stack : "N/A"}`,
      );
      // Return empty on error
      return [];
    } finally {
      this.isLoading = false;
    }
  }
}
