import * as vscode from "vscode";
import { StateManager } from "@extension/StateManager";
import { log } from "@/extension";
import { type SpectralFolderInfo } from "@/extension/lib/IntegrationDiscovery";
import {
  StatusTreeItem,
  FlowsSectionTreeItem,
  FlowTreeItem,
  ConfigPagesSectionTreeItem,
  ConfigPageTreeItem
} from "./IntegrationTreeDataProvider";

// Tree node type for details view
type DetailsTreeNode =
  | StatusTreeItem
  | FlowsSectionTreeItem
  | FlowTreeItem
  | ConfigPagesSectionTreeItem
  | ConfigPageTreeItem;

export class IntegrationDetailsTreeDataProvider
  implements vscode.TreeDataProvider<DetailsTreeNode>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    DetailsTreeNode | undefined | null | void
  > = new vscode.EventEmitter<DetailsTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    DetailsTreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private activeIntegration: SpectralFolderInfo | undefined;

  constructor(private stateManager: StateManager) {}

  refresh(): void {
    log(
      "INFO",
      "[IntegrationDetailsTreeDataProvider] Refreshing integration details view",
    );
    this._onDidChangeTreeData.fire();
  }

  async setActiveIntegration(integration: SpectralFolderInfo | undefined): Promise<void> {
    this.activeIntegration = integration;

    if (integration?.hasPrismJson && integration.integrationId) {
      // Load the integration data into state
      await this.stateManager.loadIntegrationData();
      const workspaceState = await this.stateManager.getWorkspaceState();
      const integrationData = workspaceState?.integration;

      if (integrationData) {
        const flowCount = integrationData.systemInstance?.flowConfigs?.nodes?.length || 0;
        log(
          "INFO",
          `[IntegrationDetailsTreeDataProvider] Loaded integration "${integrationData.name}" with ${flowCount} flows`
        );
      }
    }

    this.refresh();
  }

  getTreeItem(element: DetailsTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DetailsTreeNode): Promise<DetailsTreeNode[]> {
    // Get current state data
    const workspaceState = await this.stateManager.getWorkspaceState();
    const integrationData = workspaceState?.integration;
    const flows = integrationData?.systemInstance?.flowConfigs?.nodes?.map(
      node => node.flow
    ) || [];
    const configPages = integrationData?.configPages || [];

    // Handle child nodes
    if (element) {
      if (element instanceof ConfigPagesSectionTreeItem) {
        // Return individual config page nodes
        return configPages.map(
          (page) =>
            new ConfigPageTreeItem(
              page.name,
              page,
              vscode.TreeItemCollapsibleState.None,
            ),
        );
      } else if (element instanceof FlowsSectionTreeItem) {
        // Return individual flow nodes
        return flows.map(
          (flow) =>
            new FlowTreeItem(
              flow.name,
              flow,
              vscode.TreeItemCollapsibleState.None,
            ),
        );
      }
      // Other nodes have no children
      return [];
    }

    // Root level - show details for active integration
    if (!this.activeIntegration) {
      return [];
    }

    if (!this.activeIntegration.hasPrismJson) {
      // Show import required message - use StatusTreeItem to show the import required message
      const item = new StatusTreeItem("NOT_IMPORTED");
      return [item];
    }

    if (!integrationData) {
      // Still loading or no data - use StatusTreeItem for this as well
      const item = new StatusTreeItem("NO_DATA");
      return [item];
    }

    // Build the details tree
    const children: DetailsTreeNode[] = [];

    // Add status node
    if (integrationData.systemInstance?.configState) {
      children.push(
        new StatusTreeItem(integrationData.systemInstance.configState)
      );
    }

    // Add config pages section
    if (configPages.length > 0) {
      children.push(
        new ConfigPagesSectionTreeItem(configPages.length)
      );
    }

    // Add flows section
    if (flows.length > 0) {
      children.push(new FlowsSectionTreeItem(flows.length));
    }

    return children;
  }
}