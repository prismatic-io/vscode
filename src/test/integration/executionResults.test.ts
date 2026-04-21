import * as assert from "node:assert";
import * as vscode from "vscode";
import { activateExtension } from "./helpers/activation";

suite("Execution Results view and commands", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  test("execution results commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "prismatic.executionResults.refresh",
      "prismatic.executionResults.openLogs",
      "prismatic.executionResults.openStep",
    ];
    for (const id of expected) {
      assert.ok(
        commands.includes(id),
        `Expected command '${id}' to be registered`,
      );
    }
  });

  test("prismatic-log language is contributed", async () => {
    const languages = await vscode.languages.getLanguages();
    assert.ok(
      languages.includes("prismatic-log"),
      "Expected 'prismatic-log' language to be contributed",
    );
  });

  test("prismatic-logs: URIs resolve via the content provider", async () => {
    const uri = vscode.Uri.parse("prismatic-logs:/fake-execution-id.log");
    const doc = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(doc.uri.scheme, "prismatic-logs");
    // Either a placeholder or an empty preview — both indicate the provider
    // was consulted without throwing.
    assert.ok(typeof doc.getText() === "string");
  });

  test("prismatic-step: URIs resolve via the content provider", async () => {
    const uri = vscode.Uri.parse(
      "prismatic-step:/fake-exec/fake-step/step.json",
    );
    const doc = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(doc.uri.scheme, "prismatic-step");
    assert.ok(typeof doc.getText() === "string");
  });

  test("refresh command is invokable and does not throw", async () => {
    // Without authentication the service returns early; the command should
    // still resolve cleanly.
    await vscode.commands.executeCommand("prismatic.executionResults.refresh");
  });
});
