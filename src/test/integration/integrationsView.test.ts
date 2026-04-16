import * as assert from "node:assert";
import * as vscode from "vscode";
import { activateExtension } from "./helpers/activation";

suite("Integrations view commands", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  test("per-item commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "prismatic.integrations.select",
      "prismatic.integrations.revealInExplorer",
      "prismatic.integrations.openInBrowser",
      "prismatic.integrations.import",
      "prismatic.integrations.test",
      "prismatic.integrationDetails.refresh",
      "prismatic.configWizard",
    ];
    for (const id of expected) {
      assert.ok(
        commands.includes(id),
        `Expected command '${id}' to be registered`,
      );
    }
  });
});
