import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(async () => undefined),
  fileFactory: vi.fn((p: string) => ({ fsPath: p, scheme: "file" })),
}));

vi.mock(import("vscode"), () => ({
  commands: { executeCommand: mocks.executeCommand },
  Uri: { file: mocks.fileFactory },
}));

import { revealIntegrationInExplorer } from "./revealIntegrationInExplorer";

describe("revealIntegrationInExplorer", () => {
  it("reveals the folder and expands it", async () => {
    await revealIntegrationInExplorer("/ws/integrations/foo");

    expect(mocks.fileFactory).toHaveBeenCalledWith("/ws/integrations/foo");
    expect(mocks.executeCommand.mock.calls.map(([cmd]) => cmd)).toEqual([
      "revealInExplorer",
      "list.expand",
    ]);
  });
});
