import * as vscode from "vscode";
import { StateManager } from "@/lib/StateManager";
import { createSettingsViewProvider } from "@/views/settings/ViewProvider";
import { createExecutionResultsViewProvider } from "@/views/executionResults/ViewProvider";
import { createConfigWizardPanel } from "@/views/configWizard/ViewProvider";
import { PrismCLI } from "@/lib/PrismCLI";
import { TokenManager } from "@/lib/TokenManager";
import { executeProjectNpmScript } from "@/lib/executeProjectNpmScript";

// disposables
let settingsViewProvider: vscode.Disposable | undefined;
let executionResultsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;
let tokenManager: TokenManager;
let stateManager: StateManager;
let prismCLI: PrismCLI;

export async function activate(context: vscode.ExtensionContext) {
  try {
    // note: create output channel
    outputChannel = vscode.window.createOutputChannel("Prismatic Debug");
    context.subscriptions.push(outputChannel);

    // note: start extension activation
    log("INFO", "Starting extension activation...");
    log("SUCCESS", `Extension activated at: ${new Date().toISOString()}`);
    log(
      "INFO",
      `Extension context:
    - extensionPath: ${context.extensionPath}
    - globalStorageUri: ${context.globalStorageUri}
    - logUri: ${context.logUri}
    `
    );

    // note: initialize state manager
    log("INFO", "Initializing State Manager...");
    stateManager = await StateManager.initialize(context);

    // note: initialize Token Manager
    log("INFO", "Initializing Token Manager...");
    tokenManager = TokenManager.getInstance();

    // note: initialize Prism CLI
    log("INFO", "Initializing Prism CLI...");
    prismCLI = PrismCLI.getInstance();

    try {
      if (!(await prismCLI.isLoggedIn())) {
        const loginAction = "Login to Prismatic";
        const response = await vscode.window.showInformationMessage(
          "You need to login to Prismatic to continue.",
          { modal: true },
          loginAction
        );

        if (response !== loginAction) {
          throw new Error("Login required to continue");
        }

        log("INFO", "Logging in...");
        await prismCLI.login();
        log("SUCCESS", "Successfully logged in!");
      }

      if (!(await tokenManager.hasTokens())) {
        log("INFO", "Initializing tokens...");
        await tokenManager.initializeTokens();
        log("SUCCESS", "Successfully initialized tokens!");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log("ERROR", `Failed to initialize Prismatic: ${errorMessage}`);

      if (errorMessage.includes("not properly installed")) {
        vscode.window.showErrorMessage(
          "Prismatic CLI is not properly installed. Please ensure @prismatic-io/prism is installed in your project dependencies."
        );
      }

      if (errorMessage.includes("Login required")) {
        vscode.window.showErrorMessage(
          "Login to Prismatic is required to use this extension."
        );
      }
    }

    // note: register views
    log("INFO", "Registering views...");

    settingsViewProvider = createSettingsViewProvider(context);
    context.subscriptions.push(settingsViewProvider);

    executionResultsViewProvider = createExecutionResultsViewProvider(context);
    context.subscriptions.push(executionResultsViewProvider);

    configWizardPanel = createConfigWizardPanel(context);
    context.subscriptions.push(configWizardPanel);

    // command: prism me
    const prismMeCommand = vscode.commands.registerCommand(
      "prismatic.me",
      async () => {
        try {
          const user = await prismCLI.me();

          vscode.window.showInformationMessage(user);
          log("INFO", `\n${user}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          vscode.window.showErrorMessage(errorMessage);
          log("ERROR", errorMessage);
        }
      }
    );
    context.subscriptions.push(prismMeCommand);

    // command: prism login
    const prismLoginCommand = vscode.commands.registerCommand(
      "prismatic.login",
      async () => {
        try {
          const result = await prismCLI.login();
          await tokenManager.initializeTokens();

          vscode.window.showInformationMessage(result);
          log("SUCCESS", result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          vscode.window.showErrorMessage(errorMessage);
          log("ERROR", errorMessage);
        }
      }
    );
    context.subscriptions.push(prismLoginCommand);

    // command: prism logout
    const prismLogoutCommand = vscode.commands.registerCommand(
      "prismatic.logout",
      async () => {
        try {
          const result = await prismCLI.logout();
          await tokenManager.clearTokens();

          vscode.window.showInformationMessage(result);
          log("SUCCESS", result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          vscode.window.showErrorMessage(errorMessage);
          log("ERROR", errorMessage);
        }
      }
    );
    context.subscriptions.push(prismLogoutCommand);

    // command: prism me token
    const prismMeTokenCommand = vscode.commands.registerCommand(
      "prismatic.me:token",
      async () => {
        try {
          await tokenManager.refreshAccessToken();

          vscode.window.showInformationMessage(
            "Successfully refreshed tokens!"
          );
          log("SUCCESS", "Successfully refreshed tokens!");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          vscode.window.showErrorMessage(errorMessage);
          log("ERROR", errorMessage);
        }
      }
    );
    context.subscriptions.push(prismMeTokenCommand);

    // command: prism integration import
    const prismIntegrationImportCommand = vscode.commands.registerCommand(
      "prismatic.integration.import",
      async () => {
        log("INFO", "Starting integration import process...");

        try {
          // note: build the project
          const { stdout: buildStdout, stderr: buildStderr } =
            await executeProjectNpmScript("build");

          if (buildStderr) {
            log("WARN", `Build warnings/errors: ${buildStderr}`);
          }

          // note: log the build output
          log("INFO", buildStdout);
          log("SUCCESS", "Project build completed successfully!");

          // note: import the integration
          const integrationId = await prismCLI.integrationImport();

          stateManager.updateWorkspaceState("settings", { integrationId });

          // note: show the result
          vscode.window.showInformationMessage(
            `Integration imported successfully! ID: ${integrationId}`
          );
          log(
            "SUCCESS",
            `Integration imported successfully! ID: ${integrationId}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          log("ERROR", `Error during integration import: ${errorMessage}`);
          vscode.window.showErrorMessage(
            `Failed to import integration: ${errorMessage}`
          );
        }
      }
    );
    context.subscriptions.push(prismIntegrationImportCommand);

    log("SUCCESS", "Extension initialization complete!");
  } catch (error) {
    console.error("Activation error:", error);

    if (outputChannel) {
      log("ERROR", `ERROR during activation: ${error}`);
    }

    // note: re-throw to make sure VS Code sees the error
    throw error;
  }
}

export async function deactivate() {
  try {
    log("INFO", `Extension deactivated at: ${new Date().toISOString()}`);

    // note: dispose of token manager
    await tokenManager.dispose();

    // note: dispose of state manager
    await stateManager.dispose();

    // note: dispose of prism CLI
    prismCLI.dispose();

    // note: dispose of views
    settingsViewProvider?.dispose();
    executionResultsViewProvider?.dispose();
    configWizardPanel?.dispose();

    // note: dispose of output channel
    outputChannel?.dispose();
  } catch (error) {
    console.error("Deactivation error:", error);
  }
}

const log = (level: "SUCCESS" | "WARN" | "ERROR" | "INFO", message: string) => {
  const timestamp = new Date().toISOString();
  const emoji =
    level === "SUCCESS"
      ? "✅"
      : level === "WARN"
      ? "⚠️"
      : level === "ERROR"
      ? "❌"
      : level === "INFO"
      ? "ℹ️"
      : "";

  outputChannel.appendLine(`[${timestamp}] ${emoji} [${level}] ${message}`);
};
