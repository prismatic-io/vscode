import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { SPECTRAL_DIR } from "@/extension/constants";

/**
 * Represents a .spectral directory as a tree item
 */
export class IntegrationItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly spectralPath: string,
  ) {
    // Use the parent directory name as the label (the integration name)
    const integrationName = path.basename(path.dirname(spectralPath));
    super(integrationName, vscode.TreeItemCollapsibleState.None);

    // Show relative path from workspace root as description
    const relativePath = path.relative(workspaceFolder.uri.fsPath, spectralPath);
    this.description = path.dirname(relativePath);

    this.tooltip = spectralPath;
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "integrationItem";
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
      const spectralPaths = this.findSpectralDirectories(folder.uri.fsPath);
      for (const spectralPath of spectralPaths) {
        integrations.push(new IntegrationItem(folder, spectralPath));
      }
    }
    return integrations;
  }

  /**
   * Recursively find all .spectral directories within a root path
   */
  private findSpectralDirectories(
    rootPath: string,
    maxDepth = 5,
  ): string[] {
    const results: string[] = [];
    this.searchForSpectral(rootPath, results, 0, maxDepth);
    return results;
  }

  /**
   * Recursive helper to search for .spectral directories
   */
  private searchForSpectral(
    currentPath: string,
    results: string[],
    currentDepth: number,
    maxDepth: number,
  ): void {
    if (currentDepth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip common directories that won't contain integrations
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === ".git" ||
          entry.name === ".vscode"
        ) {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);

        if (entry.name === SPECTRAL_DIR) {
          results.push(fullPath);
          // Don't recurse into .spectral directories
        } else {
          // Recurse into subdirectories
          this.searchForSpectral(fullPath, results, currentDepth + 1, maxDepth);
        }
      }
    } catch {
      // Ignore permission errors or other access issues
    }
  }
}
