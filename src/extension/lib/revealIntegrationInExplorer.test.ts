import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { revealIntegrationInExplorer } from "./revealIntegrationInExplorer";

describe("revealIntegrationInExplorer", () => {
  it("reveals the folder and expands it", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const fileFactory = vi.spyOn(vscode.Uri, "file");

    await revealIntegrationInExplorer("/ws/integrations/foo");

    expect(fileFactory).toHaveBeenCalledWith("/ws/integrations/foo");
    expect(executeCommand.mock.calls.map(([cmd]) => cmd)).toEqual([
      "revealInExplorer",
      "list.expand",
    ]);
  });
});
