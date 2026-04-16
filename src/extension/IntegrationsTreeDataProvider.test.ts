import { describe, expect, it, vi } from "vitest";

vi.mock(import("vscode"), () => {
  class TreeItem {
    label: string;
    collapsibleState: number;
    description?: string;
    tooltip?: string;
    contextValue?: string;
    iconPath?: unknown;
    command?: unknown;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }
  class ThemeIcon {
    id: string;
    color?: unknown;
    constructor(id: string, color?: unknown) {
      this.id = id;
      this.color = color;
    }
  }
  class ThemeColor {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  }
  class EventEmitter {
    event = () => ({ dispose: () => {} });
    fire() {}
  }
  return {
    TreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon,
    ThemeColor,
    EventEmitter,
    workspace: { workspaceFolders: undefined },
  };
});

vi.mock(import("@/extension/lib/findSpectralDirectories"), () => ({
  findSpectralDirectories: () => [],
}));

import type * as vscode from "vscode";
import { IntegrationItem } from "./IntegrationsTreeDataProvider";

const makeFolder = (fsPath: string): vscode.WorkspaceFolder =>
  ({
    uri: { fsPath } as vscode.Uri,
    name: "fixture",
    index: 0,
  }) as vscode.WorkspaceFolder;

describe("IntegrationItem", () => {
  const folder = makeFolder("/ws");
  const spectralPath = "/ws/integrations/foo/.spectral";

  it("reports integrationItem contextValue when not active", () => {
    const item = new IntegrationItem(folder, spectralPath, false);
    expect(item.contextValue).toBe("integrationItem");
    expect(item.iconPath).toBeUndefined();
  });

  it("reports integrationItem.active contextValue and icon when active", () => {
    const item = new IntegrationItem(folder, spectralPath, true);
    expect(item.contextValue).toBe("integrationItem.active");
    expect(item.iconPath).toBeDefined();
  });

  it("wires left-click to the select command with itself as argument", () => {
    const item = new IntegrationItem(folder, spectralPath);
    const command = item.command as {
      command: string;
      arguments: unknown[];
    };
    expect(command.command).toBe("prismatic.integrations.select");
    expect(command.arguments[0]).toBe(item);
  });
});
