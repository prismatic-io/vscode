import { AuthManager } from "@extension/AuthManager";
import { executeProjectNpmScript } from "@extension/executeProjectNpmScript";
import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";
import { createConfigWizardPanel } from "@webview/views/configWizard/ViewProvider";
import { createExecutionResultsViewProvider } from "@webview/views/executionResults/ViewProvider";
import { CONFIG } from "config";
import * as vscode from "vscode";
import { createActor } from "xstate";
import { syncPrismaticUrl } from "@/extension/syncPrismaticUrl";
import { verifyIntegrationIntegrity } from "@/extension/verifyIntegrationIntegrity";
import {
  type TestIntegrationFlowMachineActorRef,
  testIntegrationFlowMachine,
} from "./lib/integrationsFlowsTest/testIntegrationFlow.machine";

// disposables
let executionResultsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;
let authManager: AuthManager;
let stateManager: StateManager;
let prismCLIManager: PrismCLIManager;
let testIntegrationFlowActor: TestIntegrationFlowMachineActorRef | undefined;

export async function activate(context: vscode.ExtensionContext) {
  try {
    /**
     * enable extension based on the workspace containing .spectral
     * this includes showing commands & views.
     */
    await vscode.commands.executeCommand(
      "setContext",
      "prismatic.workspaceEnabled",
      true,
    );

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
    `,
    );

    /**
     * initialize state manager
     */
    log("INFO", "Initializing State Manager...");
    stateManager = await StateManager.initialize(context);

    /**
     * initialize Prism CLI
     */
    log("INFO", "Initializing Prism CLI...");
    prismCLIManager = await PrismCLIManager.getInstance();

    /**
     * initialize Auth Manager
     */
    log("INFO", "Initializing Auth Manager...");
    authManager = await AuthManager.getInstance();

    /**
     * perform initial auth flow
     */
    await authManager.performInitialAuthFlow();

    /**
     * sync the prismatic url
     */
    await syncPrismaticUrl();

    /**
     * sync the integration id between workspace state and file system
     */
    await verifyIntegrationIntegrity();

    /**
     * register views
     *   - settings
     *   - execution results
     *   - config wizard
     */
    log("INFO", "Registering views...");

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
          const user = await authManager.getCurrentUser();

          log("INFO", `\n${user}`);
        } catch (error) {
          log("ERROR", String(error));
        }
      },
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
          const result = await authManager.login();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
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
          const result = await authManager.logout();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(prismLogoutCommand);

    /**
     * command: PRISM_REFRESH_TOKEN=${globalState.refreshToken} prism me:token
     * This command is used to refresh the access token.
     */
    const prismRefreshTokenCommand = vscode.commands.registerCommand(
      "prismatic.refreshToken",
      async () => {
        try {
          await authManager.refreshAccessToken();

          log("SUCCESS", "Successfully refreshed tokens!", true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(prismRefreshTokenCommand);

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
            true,
          );
        } catch (error) {
          log(
            "ERROR",
            `Error during integration import: ${String(error)}`,
            true,
          );
        }
      },
    );
    context.subscriptions.push(prismIntegrationsImportCommand);

    /**
     * Initialize test integration flow actor
     */
    if (!testIntegrationFlowActor) {
      testIntegrationFlowActor = createActor(testIntegrationFlowMachine, {
        input: {},
      });

      // note: subscribe to state changes for managing running state
      testIntegrationFlowActor.subscribe((snapshot) => {
        vscode.commands.executeCommand(
          "setContext",
          "prismatic.testCommandEnabled",
          !!snapshot.hasTag("idle"),
        );
      });

      // note: start the machine
      testIntegrationFlowActor.start();
    }

    /**
     * This command is used to run a test for the integration.
     */
    const integrationFlowTestCommand = vscode.commands.registerCommand(
      "prismatic.integrations.test",
      async () => {
        outputChannel.show(true);

        log("INFO", "Starting integration test...");

        try {
          if (!(await authManager.isLoggedIn())) {
            throw new Error("User is not logged in. Please login first.");
          }

          const accessToken = await authManager.getAccessToken();
          const workspaceState = await stateManager.getWorkspaceState();
          const globalState = await stateManager.getGlobalState();

          if (!workspaceState?.integrationId) {
            throw new Error(
              "No integration ID found. Please import an integration first.",
            );
          }

          if (!testIntegrationFlowActor) {
            throw new Error("No test integration actor available.");
          }

          // note: send the test event with the integration ID
          testIntegrationFlowActor.send({
            type: "TEST_INTEGRATION",
            integrationId: workspaceState.integrationId,
            flowId: workspaceState.flowId,
            accessToken,
            prismaticUrl: globalState?.prismaticUrl ?? CONFIG.prismaticUrl,
          });
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(integrationFlowTestCommand);

    /**
     * command: env prismatic url
     * This command is used to update the Prismatic URL.
     */
    const prismPrismaticUrlCommand = vscode.commands.registerCommand(
      "prismatic.prismaticUrl",
      async () => {
        const globalState = await stateManager.getGlobalState();
        const prismaticUrl =
          globalState?.prismaticUrl ||
          process.env.PRISMATIC_URL ||
          CONFIG.prismaticUrl;

        // note: show the input box
        const updatedPrismaticUrl = await vscode.window.showInputBox({
          prompt: "Enter Prismatic URL",
          placeHolder: prismaticUrl,
          value: prismaticUrl,
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
          const result = await authManager.login();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
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

    // note: dispose of auth manager
    await authManager.dispose();

    // note: dispose of state manager
    await stateManager.dispose();

    // note: dispose of prism CLI
    prismCLIManager.dispose();

    // note: dispose of test integration flow actor
    testIntegrationFlowActor?.stop();

    // note: dispose of views
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
  showMessage = false,
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
