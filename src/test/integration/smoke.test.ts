import * as assert from "node:assert";
import * as vscode from "vscode";
import { activateExtension, EXTENSION_ID } from "./helpers/activation";

suite("Extension smoke", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  test("extension is active", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    assert.strictEqual(ext.isActive, true);
  });
});
