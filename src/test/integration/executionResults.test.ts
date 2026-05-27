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
      "prismatic.executionResults.cancelBatch",
      "prismatic.executionResults.loadMoreBatches",
      "prismatic.executionResults.openBatchLogs",
      "prismatic.executionResults.openBatchStep",
      "prismatic.executionResults.copyBatchId",
      "prismatic.executionResults.openBatchInBrowser",
      "prismatic.executionResults.openBatchSummary",
      "prismatic.executionResults.subscribeBatched",
      "prismatic.executionResults.revealBatchedParent",
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

  test("cancelBatch shows a modal confirmation and aborts on dismissal", async () => {
    // Stub showWarningMessage to capture invocation and return "Keep Running"
    // so the cancel mutation is never reached. We assert the dialog path
    // without needing a real backend or authenticated session.
    const original = vscode.window.showWarningMessage;
    const calls: Array<{ message: string; items: string[] }> = [];
    (vscode.window as { showWarningMessage: typeof original }).showWarningMessage = ((
      message: string,
      ..._args: unknown[]
    ) => {
      // Second positional arg is options, then items.
      const items = _args
        .slice(1)
        .filter((v): v is string => typeof v === "string");
      calls.push({ message, items });
      return Promise.resolve("Keep Running");
    }) as unknown as typeof original;

    try {
      await vscode.commands.executeCommand(
        "prismatic.executionResults.cancelBatch",
        "fake-execution-id",
      );
    } finally {
      (vscode.window as { showWarningMessage: typeof original }).showWarningMessage =
        original;
    }

    assert.strictEqual(calls.length, 1, "expected a single confirmation");
    assert.ok(
      calls[0].message.toLowerCase().includes("cancel batch processing"),
      `unexpected confirmation message: ${calls[0].message}`,
    );
    assert.ok(calls[0].items.includes("Cancel Batch"));
    assert.ok(calls[0].items.includes("Keep Running"));
  });
});
