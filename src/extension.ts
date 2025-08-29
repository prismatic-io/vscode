import { AuthManager } from "@extension/AuthManager";
import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";
import { createConfigWizardPanel } from "@webview/views/configWizard/ViewProvider";
import { createExecutionResultsViewProvider } from "@webview/views/executionResults/ViewProvider";
import { startServer, stopServer, isServerRunning, getPort } from "@extension/honoServer";
import { CONFIG } from "config";
import * as vscode from "vscode";
import { createActor } from "xstate";
import { executeProjectNpmScript } from "@/extension/lib/executeProjectNpmScript";
import { syncPrismaticUrl } from "@/extension/lib/syncPrismaticUrl";
import { verifyIntegrationIntegrity } from "@/extension/lib/verifyIntegrationIntegrity";
import {
  type TestIntegrationFlowMachineActorRef,
  testIntegrationFlowMachine,
} from "./extension/machines/integrationsFlowsTest/testIntegrationFlow.machine";

// Disposables
let executionResultsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;
let authManager: AuthManager;
let stateManager: StateManager;
let prismCLIManager: PrismCLIManager;
let testIntegrationFlowActor: TestIntegrationFlowMachineActorRef | undefined;

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Make extension context available globally for use in machines
    (globalThis as any).extensionContext = context;
    
    /**
     * Enable extension based on the workspace containing .spectral
     * this includes showing commands & views.
     */
    await vscode.commands.executeCommand(
      "setContext",
      "prismatic.workspaceEnabled",
      true,
    );

    /**
     * Create output channel
     */
    outputChannel = vscode.window.createOutputChannel("Prismatic Debug");
    context.subscriptions.push(outputChannel);

    /**
     * Start extension activation
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
     * Initialize state manager
     */
    log("INFO", "Initializing State Manager...");
    stateManager = await StateManager.initialize(context);

    /**
     * Initialize Prism CLI
     */
    log("INFO", "Initializing Prism CLI...");
    prismCLIManager = await PrismCLIManager.getInstance();

    /**
     * Initialize Auth Manager
     */
    log("INFO", "Initializing Auth Manager...");
    authManager = await AuthManager.getInstance();

    /**
     * Perform initial auth flow
     */
    await authManager.performInitialAuthFlow();

    /**
     * Sync the prismatic url
     */
    await syncPrismaticUrl();

    /**
     * Sync the integration id between workspace state and file system
     */
    await verifyIntegrationIntegrity();

    /**
     * Register views
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
     * start Hono server with port forwarding
     */
    log("INFO", "Starting Hono server...");
    await startServer(context);
    log("SUCCESS", "Hono server started successfully!");

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
          // build the project
          const { stdout: buildStdout, stderr: buildStderr } =
            await executeProjectNpmScript("build");

          if (buildStderr) {
            log("WARN", `Build warnings/errors: ${buildStderr}`);
          }

          // log the build output
          log("INFO", "Starting project build...");
          log("INFO", buildStdout);
          log("SUCCESS", "Project build completed successfully!");
          log("INFO", "Starting integration import...");

          // import the integration
          const integrationId = await prismCLIManager.integrationsImport();

          stateManager.updateWorkspaceState({ integrationId });

          // show the result
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

      // Subscribe to state changes for managing running state
      testIntegrationFlowActor.subscribe((snapshot) => {
        vscode.commands.executeCommand(
          "setContext",
          "prismatic.testCommandEnabled",
          !!snapshot.hasTag("idle"),
        );
      });

      // Start the machine
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

          // send the test event with the integration ID
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

        // show the input box
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

        // Update the URL in state
        await stateManager.updateGlobalState({
          prismaticUrl: updatedPrismaticUrl,
        });

        // Show the result
        log("SUCCESS", "Prismatic URL updated successfully!", true);

        // Re-login and re-initialize tokens
        try {
          const result = await authManager.login();

          log("SUCCESS", result, true);
        } catch (error) {
          log("ERROR", String(error), true);
        }

        // Re-sync the integration id
        await verifyIntegrationIntegrity();
      },
    );
    context.subscriptions.push(prismPrismaticUrlCommand);

    /**
     * command: get server info
     * This command shows information about the running Hono server.
     */
    const getServerInfoCommand = vscode.commands.registerCommand(
      "prismatic.getServerInfo",
      async () => {
        if (isServerRunning()) {
          const port = getPort();
          const uri = context.workspaceState.get<string>("honoServerUri");
          
          const message = `Hono server is running on port ${port}\nURL: ${uri || 'N/A'}`;
          
          const selection = await vscode.window.showInformationMessage(
            message,
            "Open in Browser",
            "Copy URL",
            "Show Endpoints"
          );

          if (selection === "Open in Browser" && uri) {
            vscode.env.openExternal(vscode.Uri.parse(uri));
          } else if (selection === "Copy URL" && uri) {
            vscode.env.clipboard.writeText(uri);
            vscode.window.showInformationMessage("URL copied to clipboard!");
          } else if (selection === "Show Endpoints" && uri) {
            const endpoints = [
              `GET  ${uri}/`,
              `GET  ${uri}/health`,
              `GET  ${uri}/api/workspace`,
              `GET  ${uri}/api/editor`,
              `POST ${uri}/api/command`,
              `GET  ${uri}/api/prismatic/status`,
              `POST ${uri}/api/prismatic/step-result`
            ];
            
            vscode.window.showInformationMessage(
              `Available endpoints:\n${endpoints.join('\n')}`,
              { modal: true }
            );
          }
        } else {
          vscode.window.showWarningMessage("Hono server is not running");
        }
      }
    );
    context.subscriptions.push(getServerInfoCommand);

    /**
     * command: restart server
     * This command restarts the Hono server.
     */
    const restartServerCommand = vscode.commands.registerCommand(
      "prismatic.restartServer",
      async () => {
        log("INFO", "Restarting Hono server...");
        await stopServer();
        
        // Wait a bit for cleanup
        setTimeout(async () => {
          await startServer(context);
          log("SUCCESS", "Hono server restarted successfully!");
          vscode.window.showInformationMessage("Server restarted");
        }, 1000);
      }
    );
    context.subscriptions.push(restartServerCommand);

    log("SUCCESS", "Extension initialization complete!");
  } catch (error) {
    console.error("Activation error:", error);

    if (outputChannel) {
      log("ERROR", `ERROR during activation: ${error}`);
    }

    // Re-throw to make sure VS Code sees the error
    throw error;
  }
}

export async function deactivate() {
  try {
    log("INFO", `Extension deactivated at: ${new Date().toISOString()}`);

    // Dispose of auth manager
    await authManager.dispose();

    // note: stop Hono server
    await stopServer();

    // Dispose of state manager
    await stateManager.dispose();

    // Dispose of prism CLI
    prismCLIManager.dispose();

    // Dispose of test integration flow actor
    testIntegrationFlowActor?.stop();

    // Dispose of views
    executionResultsViewProvider?.dispose();
    configWizardPanel?.dispose();

    // Dispose of output channel
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
