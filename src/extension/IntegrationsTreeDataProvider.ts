import path from "node:path";
import * as vscode from "vscode";
import { findSpectralDirectories } from "@/extension/lib/findSpectralDirectories";

/**
 * Represents a .spectral directory as a tree item
 */
export class IntegrationItem extends vscode.TreeItem {
  public readonly integrationPath: string;

  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly spectralPath: string,
    isActive = false,
  ) {
    // Use the parent directory name as the label (the integration name)
    const integrationName = path.basename(path.dirname(spectralPath));
    super(integrationName, vscode.TreeItemCollapsibleState.None);

    // Store integration path (parent of .spectral)
    this.integrationPath = path.dirname(spectralPath);

    // Show relative path from workspace root as description
    const relativePath = path.relative(
      workspaceFolder.uri.fsPath,
      spectralPath,
    );
    this.description = path.dirname(relativePath);

    this.tooltip = spectralPath;
    this.contextValue = "integrationItem";

    // Show green dot for active integration
    this.iconPath = isActive
      ? new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("testing.iconPassed"))
      : undefined;
    // Click to select
    this.command = {
      command: "prismatic.integrations.select",
      title: "Select Integration",
      arguments: [this],
    };
  }
}

/**
 * TreeDataProvider for displaying .spectral directories across workspaces
 */
export class IntegrationsTreeDataProvider
  implements vscode.TreeDataProvider<IntegrationItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    IntegrationItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _activeIntegrationPath: string | undefined;

  /**
   * Set the active integration path and refresh the tree
   */
  setActiveIntegration(integrationPath: string): void {
    this._activeIntegrationPath = integrationPath;
    this.refresh();
  }

  /**
   * Get the active integration path
   */
  getActiveIntegration(): string | undefined {
    return this._activeIntegrationPath;
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
  getTreeItem(element: IntegrationItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children (top-level items only - no expansion)
   */
  getChildren(element?: IntegrationItem): IntegrationItem[] {
    if (element) return []; // No children - flat list

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const integrations: IntegrationItem[] = [];
    for (const folder of workspaceFolders) {
      const spectralPaths = findSpectralDirectories(folder.uri.fsPath);
      for (const spectralPath of spectralPaths) {
        const integrationPath = path.dirname(spectralPath);
        const isActive = integrationPath === this._activeIntegrationPath;
        integrations.push(new IntegrationItem(folder, spectralPath, isActive));
      }
    }
    return integrations;
  }
}
