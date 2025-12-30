import path from "node:path";
import * as vscode from "vscode";
import {
  FLOW_DIR,
  FLOW_PAYLOADS_DIR,
  SPECTRAL_DIR,
} from "@/extension/constants";
import { getJsonFiles, pathsToUris } from "@/extension/lib/getFiles";
import type { Flow } from "@/types/flows";

type FlowPayloadTreeItem = FlowItem | PayloadItem;

/**
 * Represents a flow as a tree item (parent node)
 */
export class FlowItem extends vscode.TreeItem {
  constructor(public readonly flow: Flow) {
    super(flow.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `Flow: ${flow.name}\nStable Key: ${flow.stableKey}`;
    this.iconPath = new vscode.ThemeIcon("symbol-event");
    this.contextValue = "flowItem";
  }

  get stableKey(): string {
    return this.flow.stableKey;
  }
}

/**
 * Represents a payload file as a tree item (leaf node)
 */
export class PayloadItem extends vscode.TreeItem {
  constructor(
    public readonly fileName: string,
    public readonly filePath: string,
    public readonly parentFlow: Flow,
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.None);
    this.tooltip = filePath;
    this.iconPath = new vscode.ThemeIcon("file-code");
    this.contextValue = "payloadItem";

    // Open file on click
    this.command = {
      command: "vscode.open",
      title: "Open Payload",
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

/**
 * TreeDataProvider for displaying flow payloads in a hierarchical tree
 */
export class FlowPayloadsTreeDataProvider
  implements vscode.TreeDataProvider<FlowPayloadTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FlowPayloadTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _flows: Flow[] = [];
  private _activeIntegrationPath: string | undefined;

  /**
   * Set the flows list and refresh the tree
   */
  setFlows(flows: Flow[]): void {
    this._flows = flows;
    this.refresh();
  }

  /**
   * Set the active integration path and refresh the tree
   */
  setActiveIntegrationPath(integrationPath: string | undefined): void {
    this._activeIntegrationPath = integrationPath;
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: FlowPayloadTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for a tree item
   */
  async getChildren(
    element?: FlowPayloadTreeItem,
  ): Promise<FlowPayloadTreeItem[]> {
    if (!this._activeIntegrationPath) {
      return [];
    }

    // Root level: return all flows
    if (!element) {
      return this._flows.map((flow) => new FlowItem(flow));
    }

    // Flow level: return payloads
    if (element instanceof FlowItem) {
      return this.getPayloadsForFlow(element.flow);
    }

    return [];
  }

  /**
   * Get payload items for a specific flow
   */
  private async getPayloadsForFlow(flow: Flow): Promise<PayloadItem[]> {
    if (!this._activeIntegrationPath) {
      return [];
    }

    const payloadsDir = path.join(
      this._activeIntegrationPath,
      SPECTRAL_DIR,
      FLOW_DIR,
      flow.stableKey,
      FLOW_PAYLOADS_DIR,
    );

    try {
      const files = await getJsonFiles(pathsToUris([payloadsDir]));
      return files.map(
        (file) => new PayloadItem(file.fileName, file.filePath.fsPath, flow),
      );
    } catch {
      return [];
    }
  }
}
