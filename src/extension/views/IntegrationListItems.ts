import * as vscode from "vscode";
import * as path from "path";
import type { SpectralFolderInfo } from "@/extension/lib/IntegrationDiscovery";

/**
 * Tree item for an individual integration in the list
 */
export class IntegrationListItem extends vscode.TreeItem {
  constructor(
    public readonly integration: SpectralFolderInfo,
    public readonly isActive: boolean,
  ) {
    const displayName = integration.name;
    super(displayName, vscode.TreeItemCollapsibleState.None);

    // Set context based on import status
    this.contextValue = integration.hasPrismJson
      ? "integrationImported"
      : "integrationNotImported";

    // Visual indicators for active state
    if (isActive) {
      // Active integration with filled circle
      this.label = `● ${displayName}`;
      this.description = `${integration.relativePath}`;

      // Set a unique resourceUri to enable FileDecorationProvider
      this.resourceUri = vscode.Uri.parse(
        `prismatic-active://integration/${encodeURIComponent(integration.name)}`,
      );
    } else {
      // Inactive integration with empty circle
      this.label = `○ ${displayName}`;
      const importStatus = !integration.hasPrismJson ? " (not imported)" : "";
      this.description = `${integration.relativePath}${importStatus}`;
    }

    // Set icon based on import and active status
    if (integration.hasPrismJson) {
      this.iconPath = new vscode.ThemeIcon(
        "package",
        isActive ? new vscode.ThemeColor("charts.green") : undefined,
      );
    } else {
      this.iconPath = new vscode.ThemeIcon(
        "folder",
        new vscode.ThemeColor("list.warningForeground"),
      );
    }

    // Rich tooltip with markdown
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`### ${integration.name}\n\n`);
    tooltip.appendMarkdown(`**Path:** \`${integration.relativePath}\`\n\n`);
    tooltip.appendMarkdown(
      `**Status:** ${integration.hasPrismJson ? "✅ Imported to Prismatic" : "⚠️ Not imported"}\n\n`,
    );

    if (integration.integrationId) {
      tooltip.appendMarkdown(
        `**Integration ID:** \`${integration.integrationId}\`\n\n`,
      );
    }

    if (isActive) {
      tooltip.appendMarkdown(`---\n\n**🟢 Currently Active**\n\n`);
      tooltip.appendMarkdown(`All commands will operate on this integration.`);
    } else {
      tooltip.appendMarkdown(`---\n\n*Click to switch to this integration*`);
    }

    tooltip.isTrusted = true;
    this.tooltip = tooltip;

    // Command to switch on click (will be implemented in Phase 3)
    this.command = {
      command: "prismatic.integration.switchTo",
      title: "Switch to Integration",
      arguments: [this],
    };
  }
}

/**
 * Type union for all tree nodes
 */
export type IntegrationTreeNode = IntegrationListItem;
