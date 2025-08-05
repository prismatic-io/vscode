import * as vscode from "vscode";
import { StateManager } from "@extension/StateManager";
import { createExampleViewProvider } from "@webview/views/_example/ViewProvider";
import { createExecutionResultsViewProvider } from "@webview/views/executionResults/ViewProvider";
import { createConfigWizardPanel } from "@webview/views/configWizard/ViewProvider";
import { PrismCLIManager } from "@extension/PrismCLIManager";
import { TokenManager } from "@extension/TokenManager";
import { executeProjectNpmScript } from "@extension/executeProjectNpmScript";
import { CONFIG } from "config";

// disposables
let exampleViewProvider: vscode.Disposable | undefined;
let executionResultsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;
let tokenManager: TokenManager;
let stateManager: StateManager;
let prismCLIManager: PrismCLIManager;

export async function activate(context: vscode.ExtensionContext) {
  try {
    /**
     * create output channel
     */
    outputChannel = vscode.window.createOutputChannel("Prismatic Debug");
    context.subscriptions.push(outputChannel);

    /**
     * start extension activation
     */
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

    /**
     * initialize state manager
     */
    log("INFO", "Initializing State Manager...");
    stateManager = await StateManager.initialize(context);

    /**
     * initialize Token Manager
     */
    log("INFO", "Initializing Token Manager...");
    tokenManager = await TokenManager.getInstance();

    /**
     * initialize Prism CLI
     */
    log("INFO", "Initializing Prism CLI...");
    prismCLIManager = await PrismCLIManager.getInstance();

    /**
     * check if user is logged in
     *   - if not, show login prompt
     *   - if yes, check if tokens are valid
     *     - if not, show token refresh prompt
     */
    try {
      if (!(await prismCLIManager.isLoggedIn())) {
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
        await prismCLIManager.login();
        log("SUCCESS", "Successfully logged in!");
      }

      if (!(await tokenManager.hasTokens())) {
        log("INFO", "Initializing tokens...");
        await tokenManager.initializeTokens();
        log("SUCCESS", "Successfully initialized tokens!");
      }
    } catch (error) {
      log("ERROR", String(error), true);
    }

    /**
     * register views
     *   - settings
     *   - execution results
     *   - config wizard
     */
    log("INFO", "Registering views...");

    exampleViewProvider = createExampleViewProvider(context);
    context.subscriptions.push(exampleViewProvider);

    executionResultsViewProvider = createExecutionResultsViewProvider(context);
    context.subscriptions.push(executionResultsViewProvider);

    configWizardPanel = createConfigWizardPanel(context);
    context.subscriptions.push(configWizardPanel);

    /**
     * command: prism me
     * This command is used to get the current user's information.
     */
    const prismMeCommand = vscode.commands.registerCommand(
      "prismatic.me",
      async () => {
        outputChannel.show(true);

        try {
          const user = await prismCLIManager.me();

          log("INFO", `\n${user}`);
        } catch (error) {
          log("ERROR", String(error));
        }
      }
    );
    context.subscriptions.push(prismMeCommand);

    /**
     * command: prism login
     * This command is used to login to Prismatic.
     */
    const prismLoginCommand = vscode.commands.registerCommand(
      "prismatic.login",
      async () => {
        try {
          const result = await prismCLIManager.login();
          await tokenManager.initializeTokens();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      }
    );
    context.subscriptions.push(prismLoginCommand);

    /**
     * command: prism logout
     * This command is used to logout from Prismatic.
     */
    const prismLogoutCommand = vscode.commands.registerCommand(
      "prismatic.logout",
      async () => {
        try {
          const result = await prismCLIManager.logout();
          await tokenManager.clearTokens();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      }
    );
    context.subscriptions.push(prismLogoutCommand);

    /**
     * command: prism me:token
     * This command is used to refresh the access token.
     */
    const prismMeTokenCommand = vscode.commands.registerCommand(
      "prismatic.me:token",
      async () => {
        try {
          await tokenManager.refreshAccessToken();

          log("SUCCESS", "Successfully refreshed tokens!", true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      }
    );
    context.subscriptions.push(prismMeTokenCommand);

    /**
     * command: prism integrations:import
     * This command is used to import the integration into Prismatic.
     */
    const prismIntegrationsImportCommand = vscode.commands.registerCommand(
      "prismatic.integrations.import",
      async () => {
        outputChannel.show(true);

        log("INFO", "Starting integration build and import process...");

        try {
          // note: build the project
          const { stdout: buildStdout, stderr: buildStderr } =
            await executeProjectNpmScript("build");

          if (buildStderr) {
            log("WARN", `Build warnings/errors: ${buildStderr}`);
          }

          // note: log the build output
          log("INFO", "Starting project build...");
          log("INFO", buildStdout);
          log("SUCCESS", "Project build completed successfully!");
          log("INFO", "Starting integration import...");

          // note: import the integration
          const integrationId = await prismCLIManager.integrationsImport();

          stateManager.updateWorkspaceState({ integrationId });

          // note: show the result
          log(
            "SUCCESS",
            `Integration imported successfully! ID: ${integrationId}`,
            true
          );
        } catch (error) {
          log(
            "ERROR",
            `Error during integration import: ${String(error)}`,
            true
          );
        }
      }
    );
    context.subscriptions.push(prismIntegrationsImportCommand);

    /**
     * command: env prismatic url
     * This command is used to update the Prismatic URL.
     */
    const prismPrismaticUrlCommand = vscode.commands.registerCommand(
      "prismatic.prismaticUrl",
      async () => {
        const globalState = await stateManager.getGlobalState();

        // note: show the input box
        const updatedPrismaticUrl = await vscode.window.showInputBox({
          prompt: "Enter Prismatic URL",
          placeHolder: globalState?.prismaticUrl || CONFIG.prismaticUrl,
          value: globalState?.prismaticUrl || CONFIG.prismaticUrl,
          validateInput: (value) => {
            try {
              new URL(value);
              return null;
            } catch {
              return "Please enter a valid URL";
            }
          },
        });

        if (
          !updatedPrismaticUrl ||
          updatedPrismaticUrl === globalState?.prismaticUrl
        ) {
          return;
        }

        // note: update the URL in state
        await stateManager.updateGlobalState({
          prismaticUrl: updatedPrismaticUrl,
        });

        // note: show the result
        log("SUCCESS", "Prismatic URL updated successfully!", true);

        // note: re-login and re-initialize tokens
        try {
          const result = await prismCLIManager.login();
          await tokenManager.initializeTokens();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      }
    );
    context.subscriptions.push(prismPrismaticUrlCommand);

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
    prismCLIManager.dispose();

    // note: dispose of views
    exampleViewProvider?.dispose();
    executionResultsViewProvider?.dispose();
    configWizardPanel?.dispose();

    // note: dispose of output channel
    outputChannel?.dispose();
  } catch (error) {
    console.error("Deactivation error:", error);
  }
}

export const log = (
  level: "SUCCESS" | "WARN" | "ERROR" | "INFO",
  message: string,
  showMessage = false
) => {
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

  if (showMessage) {
    if (level === "WARN") {
      vscode.window.showWarningMessage(message);
    } else if (level === "ERROR") {
      vscode.window.showErrorMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }
};
