import * as vscode from "vscode";
import { StateManager } from "@/utils/stateManager";
import { createPrismaticViewProvider } from "@/views/prismatic/PrismaticViewProvider";
import { createExecutionResultsViewProvider } from "@/views/executionResults/ExecutionResultsViewProvider";
import { createConfigWizardPanel } from "@/views/configWizard/ConfigWizardViewProvider";

// disposables
let prismaticViewProvider: vscode.Disposable | undefined;
let executionResultsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel("Prismatic Debug");

    // force show the output channel. brings it to the front
    outputChannel.show(true);
    outputChannel.appendLine("Starting extension activation...");
    outputChannel.appendLine(
      `Extension activated at: ${new Date().toISOString()}`
    );
    outputChannel.appendLine(`Extension context:
    - extensionPath: ${context.extensionPath}
    - globalStorageUri: ${context.globalStorageUri}
    - logUri: ${context.logUri}
    `);

    outputChannel.appendLine("Initializing state manager...");
    StateManager.initialize(context);

    outputChannel.appendLine("Registering views...");
    prismaticViewProvider = createPrismaticViewProvider(context);
    executionResultsViewProvider = createExecutionResultsViewProvider(context);
    configWizardPanel = createConfigWizardPanel(context);

    outputChannel.appendLine("Adding to subscriptions...");
    context.subscriptions.push(outputChannel);
    context.subscriptions.push(prismaticViewProvider);
    context.subscriptions.push(executionResultsViewProvider);
    context.subscriptions.push(configWizardPanel);

    const testCommand = vscode.commands.registerCommand(
      "prismatic.test",
      () => {
        vscode.window.showInformationMessage("Prismatic extension is active!");
        outputChannel.appendLine("Test command executed");
      }
    );

    context.subscriptions.push(testCommand);

    outputChannel.appendLine("Extension initialization complete!");
  } catch (error) {
    console.error("Activation error:", error);

    if (outputChannel) {
      outputChannel.appendLine(`ERROR during activation: ${error}`);
    }

    // re-throw to make sure VS Code sees the error
    throw error;
  }
}

export function deactivate() {
  try {
    outputChannel?.appendLine(
      `Extension deactivated at: ${new Date().toISOString()}`
    );

    prismaticViewProvider?.dispose();
    executionResultsViewProvider?.dispose();
    configWizardPanel?.dispose();
    StateManager.dispose();
    outputChannel?.dispose();
  } catch (error) {
    console.error("Deactivation error:", error);
  }
}
