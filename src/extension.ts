import { AuthManager } from "@extension/AuthManager";
import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";
import { StatusBarManager } from "@extension/StatusBarManager";
import { createConfigWizardPanel } from "@webview/views/configWizard/ViewProvider";
import { createExecutionResultsViewProvider } from "@webview/views/executionResults/ViewProvider";
import { createIntegrationDetailsViewProvider } from "@webview/views/integrationDetails/ViewProvider";
import { CONFIG } from "config";
import * as vscode from "vscode";
import { createActor } from "xstate";
import { enableWorkspace } from "@/extension/lib/enableWorkspace";
import { executeProjectNpmScript } from "@/extension/lib/executeProjectNpmScript";
import { syncPrismaticUrl } from "@/extension/lib/syncPrismaticUrl";
import { verifyIntegrationIntegrity } from "@/extension/lib/verifyIntegrationIntegrity";
import path from "node:path";
import { createFlowPayload } from "./extension/lib/flows/createFlowPayload";
import { selectProjectFlowPayload } from "./extension/lib/flows/selectProjectFlowPayload";
import {
  FlowItem,
  FlowPayloadsTreeDataProvider,
} from "./extension/FlowPayloadsTreeDataProvider";
import type { Flow } from "./types/flows";
import {
  IntegrationItem,
  IntegrationsTreeDataProvider,
} from "./extension/IntegrationsTreeDataProvider";
import {
  type TestIntegrationFlowMachineActorRef,
  testIntegrationFlowMachine,
} from "./extension/machines/integrationsFlowsTest/testIntegrationFlow.machine";

// Disposables
let executionResultsViewProvider: vscode.Disposable | undefined;
let integrationDetailsViewProvider: vscode.Disposable | undefined;
let configWizardPanel: vscode.Disposable | undefined;
let outputChannel: vscode.OutputChannel;
let authManager: AuthManager;
let stateManager: StateManager;
let prismCLIManager: PrismCLIManager;
let testIntegrationFlowActor: TestIntegrationFlowMachineActorRef | undefined;
let integrationsTreeDataProvider: IntegrationsTreeDataProvider | undefined;
let flowPayloadsTreeDataProvider: FlowPayloadsTreeDataProvider | undefined;
let statusBarManager: StatusBarManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  try {
    /**
     * Enable extension based on the workspace containing SPECTRAL_DIR
     * this includes showing commands & views.
     */
    const isWorkspaceEnabled = await enableWorkspace();

    // Early exit if not a Prismatic workspace
    if (!isWorkspaceEnabled) {
      return;
    }

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
     * Initialize Status Bar Manager
     */
    log("INFO", "Initializing Status Bar Manager...");
    statusBarManager = await StatusBarManager.initialize(
      authManager,
      stateManager,
      context,
    );

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
     *   - integrations (Activity Bar sidebar)
     *   - execution results
     *   - config wizard
     */
    log("INFO", "Registering views...");

    // Register Integrations TreeView (Activity Bar sidebar)
    integrationsTreeDataProvider = new IntegrationsTreeDataProvider();
    const integrationsTreeView = vscode.window.createTreeView(
      "prismatic.integrationsView",
      {
        treeDataProvider: integrationsTreeDataProvider,
        showCollapseAll: false,
      },
    );
    context.subscriptions.push(integrationsTreeView);

    // Watch for workspace folder changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        integrationsTreeDataProvider?.refresh();
      }),
    );

    // Watch for .spectral directory changes
    const spectralWatcher = vscode.workspace.createFileSystemWatcher(
      "**/.spectral",
      false,
      true,
      false,
    );
    spectralWatcher.onDidCreate(() => {
      integrationsTreeDataProvider?.refresh();
      enableWorkspace();
    });
    spectralWatcher.onDidDelete(() => {
      integrationsTreeDataProvider?.refresh();
      enableWorkspace();
    });
    context.subscriptions.push(spectralWatcher);

    // Register Flow Payloads TreeView
    flowPayloadsTreeDataProvider = new FlowPayloadsTreeDataProvider();
    const flowPayloadsTreeView = vscode.window.createTreeView(
      "prismatic.flowPayloadsView",
      {
        treeDataProvider: flowPayloadsTreeDataProvider,
        showCollapseAll: true,
      },
    );
    context.subscriptions.push(flowPayloadsTreeView);

    // Auto-select first integration if none active, or restore previous selection
    const currentWorkspaceState = await stateManager.getWorkspaceState();
    if (!currentWorkspaceState?.activeIntegrationPath) {
      const integrations = integrationsTreeDataProvider.getChildren();
      if (integrations.length > 0) {
        await stateManager.updateWorkspaceState({
          activeIntegrationPath: integrations[0].integrationPath,
        });
        integrationsTreeDataProvider.setActiveIntegration(
          integrations[0].integrationPath,
        );
        flowPayloadsTreeDataProvider.setActiveIntegrationPath(
          integrations[0].integrationPath,
        );
        log(
          "INFO",
          `Auto-selected integration: ${path.basename(integrations[0].integrationPath)}`,
        );
      }
    } else {
      // Restore previous selection in tree view
      integrationsTreeDataProvider.setActiveIntegration(
        currentWorkspaceState.activeIntegrationPath,
      );
      flowPayloadsTreeDataProvider.setActiveIntegrationPath(
        currentWorkspaceState.activeIntegrationPath,
      );
    }

    executionResultsViewProvider = createExecutionResultsViewProvider(context);
    context.subscriptions.push(executionResultsViewProvider);

    integrationDetailsViewProvider =
      createIntegrationDetailsViewProvider(context);
    context.subscriptions.push(integrationDetailsViewProvider);

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

          log("INFO", `\n${user}\n`);
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

          // Update status bar after successful login
          await statusBarManager?.updateUserStatusBar();

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

          // Update status bar after logout
          await statusBarManager?.updateUserStatusBar();

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
     * This command is used to open the integration in browser.
     */
    const integrationOpenInBrowserCommand = vscode.commands.registerCommand(
      "prismatic.integrations.openInBrowser",
      async () => {
        log("INFO", "Starting integration open in browser...");

        try {
          const workspaceState = await stateManager.getWorkspaceState();
          const globalState = await stateManager.getGlobalState();

          if (!workspaceState?.integrationId) {
            throw new Error(
              "No integration ID found. Please import an integration first.",
            );
          }

          const prismaticUrl = globalState?.prismaticUrl ?? CONFIG.prismaticUrl;

          if (!prismaticUrl) {
            throw new Error(
              "No Prismatic URL found. Please set the Prismatic URL first.",
            );
          }

          // open the integration in browser
          vscode.env.openExternal(
            vscode.Uri.parse(
              `${prismaticUrl}/integrations/${workspaceState.integrationId}/`,
            ),
          );

          log("SUCCESS", "Integration opened in browser successfully!", true);
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(integrationOpenInBrowserCommand);

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
        log("INFO", "Starting integration test...");

        try {
          if (!(await authManager.isLoggedIn())) {
            throw new Error("User is not logged in. Please login first.");
          }

          const accessToken = await authManager.getAccessToken();
          const globalState = await stateManager.getGlobalState();
          const workspaceState = await stateManager.getWorkspaceState();

          if (!workspaceState?.integrationId) {
            throw new Error(
              "No integration ID found. Please import an integration first.",
            );
          }

          if (!testIntegrationFlowActor) {
            throw new Error("No test integration actor available.");
          }

          if (!workspaceState.flow) {
            throw new Error("No flow selected. Please select a flow first.");
          }

          const selectedFlowPayload = await selectProjectFlowPayload(
            workspaceState.flow.stableKey,
          );

          testIntegrationFlowActor.send({
            type: "TEST_INTEGRATION",
            integrationId: workspaceState.integrationId,
            flowId: workspaceState.flow.id,
            accessToken,
            prismaticUrl: globalState?.prismaticUrl ?? CONFIG.prismaticUrl,
            ...(selectedFlowPayload
              ? {
                  payload: JSON.stringify(selectedFlowPayload.data, null, 2),
                  contentType: selectedFlowPayload.contentType,
                  headers: JSON.stringify(selectedFlowPayload.headers),
                }
              : {}),
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

          // Update status bar after re-login with new URL
          await statusBarManager?.updateUserStatusBar();

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
     * command: prismatic.executionResults.refetch
     * This command is used to trigger a refetch of execution results in the webview.
     */
    const executionResultsRefetchCommand = vscode.commands.registerCommand(
      "prismatic.executionResults.refetch",
      async () => {
        stateManager.notifyWebviews({
          type: "executionResults.refetch",
          payload: new Date().toISOString(),
        });
      },
    );
    context.subscriptions.push(executionResultsRefetchCommand);

    /**
     * command: prismatic.integrationDetails.refresh
     * This command is used to trigger a refresh of integration details in the webview.
     */
    const integrationDetailsRefreshCommand = vscode.commands.registerCommand(
      "prismatic.integrationDetails.refresh",
      async () => {
        stateManager.notifyWebviews({
          type: "integrationDetails.refresh",
          payload: new Date().toISOString(),
        });
      },
    );
    context.subscriptions.push(integrationDetailsRefreshCommand);

    /**
     * command: prismatic.flows.createPayload
     * This command is used to create a new payload file for the selected flow.
     */
    const flowPayloadCreateCommand = vscode.commands.registerCommand(
      "prismatic.flows.createPayload",
      async () => {
        log("INFO", "Starting payload creation...");

        try {
          const workspaceState = await stateManager.getWorkspaceState();

          if (!workspaceState?.flow) {
            throw new Error("No flow selected. Please select a flow first.");
          }

          if (!workspaceState?.activeIntegrationPath) {
            throw new Error(
              "No active integration. Please select an integration first.",
            );
          }

          const filePath = await createFlowPayload(
            workspaceState.flow.stableKey,
            workspaceState.activeIntegrationPath,
          );

          if (filePath) {
            log(
              "SUCCESS",
              `Payload created successfully for flow: ${workspaceState.flow.name}`,
              true,
            );
            // Refresh the flow payloads tree view
            flowPayloadsTreeDataProvider?.refresh();
          }
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(flowPayloadCreateCommand);

    /**
     * command: prismatic.integrations.select
     * This command is used to select an active integration from the tree.
     */
    const selectIntegrationCommand = vscode.commands.registerCommand(
      "prismatic.integrations.select",
      async (item?: IntegrationItem) => {
        if (!item) {
          log("WARN", "No integration item provided for selection");
          return;
        }

        log("INFO", `Selecting integration: ${item.integrationPath}`);

        try {
          // Switch active integration (resets state)
          await stateManager.switchActiveIntegration(item.integrationPath);

          // Update tree view to show new selection
          integrationsTreeDataProvider?.setActiveIntegration(
            item.integrationPath,
          );

          // Update flow payloads tree view with new integration path
          flowPayloadsTreeDataProvider?.setActiveIntegrationPath(
            item.integrationPath,
          );

          // Update status bar with new integration
          await statusBarManager?.updateIntegrationStatusBar();

          // Clear flows when switching integrations (will be repopulated by webview)
          flowPayloadsTreeDataProvider?.setFlows([]);

          // Re-verify integration integrity for the new path
          await verifyIntegrationIntegrity();

          log(
            "SUCCESS",
            `Switched to: ${path.basename(item.integrationPath)}`,
            true,
          );
        } catch (error) {
          log("ERROR", `Failed to select integration: ${String(error)}`, true);
        }
      },
    );
    context.subscriptions.push(selectIntegrationCommand);

    /**
     * command: prismatic.integrations.switch
     * This command shows a quick pick to switch the active integration.
     */
    const switchIntegrationCommand = vscode.commands.registerCommand(
      "prismatic.integrations.switch",
      async () => {
        try {
          // Get all integrations from the tree data provider
          const integrations = integrationsTreeDataProvider?.getChildren() ?? [];

          if (integrations.length === 0) {
            log("WARN", "No integrations found in workspace", true);
            return;
          }

          // Build quick pick items
          const items = integrations.map((integration) => ({
            label: integration.label as string,
            description: integration.description as string,
            integration,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Select an integration to switch to",
            title: "Switch Active Integration",
          });

          if (!selected) {
            return; // User cancelled
          }

          // Switch to the selected integration (reuse existing logic)
          await stateManager.switchActiveIntegration(
            selected.integration.integrationPath,
          );

          integrationsTreeDataProvider?.setActiveIntegration(
            selected.integration.integrationPath,
          );

          flowPayloadsTreeDataProvider?.setActiveIntegrationPath(
            selected.integration.integrationPath,
          );

          await statusBarManager?.updateIntegrationStatusBar();

          flowPayloadsTreeDataProvider?.setFlows([]);

          await verifyIntegrationIntegrity();

          log(
            "SUCCESS",
            `Switched to: ${path.basename(selected.integration.integrationPath)}`,
            true,
          );
        } catch (error) {
          log("ERROR", `Failed to switch integration: ${String(error)}`, true);
        }
      },
    );
    context.subscriptions.push(switchIntegrationCommand);

    /**
     * command: prismatic.integrations.revealInExplorer
     * This command is used to reveal the integration directory in the file explorer.
     */
    const revealInExplorerCommand = vscode.commands.registerCommand(
      "prismatic.integrations.revealInExplorer",
      async (item?: IntegrationItem) => {
        if (!item) {
          log("WARN", "No integration item provided for reveal");
          return;
        }

        try {
          const uri = vscode.Uri.file(item.integrationPath);
          await vscode.commands.executeCommand("revealInExplorer", uri);
        } catch (error) {
          log("ERROR", `Failed to reveal in explorer: ${String(error)}`, true);
        }
      },
    );
    context.subscriptions.push(revealInExplorerCommand);

    /**
     * command: prismatic.flowPayloads.setFlows
     * This command is used to set the flows in the flow payloads tree view.
     * Called from the webview when flows are loaded.
     */
    const setFlowsCommand = vscode.commands.registerCommand(
      "prismatic.flowPayloads.setFlows",
      (flows: Flow[]) => {
        flowPayloadsTreeDataProvider?.setFlows(flows);
      },
    );
    context.subscriptions.push(setFlowsCommand);

    /**
     * command: prismatic.flowPayloads.createPayload
     * This command is used to create a new payload file for a specific flow.
     * Called from the "+" button on flow items in the Test Payloads tree view.
     */
    const createPayloadFromFlowCommand = vscode.commands.registerCommand(
      "prismatic.flowPayloads.createPayload",
      async (item?: FlowItem) => {
        log("INFO", "Starting payload creation from flow item...");

        try {
          const workspaceState = await stateManager.getWorkspaceState();

          if (!workspaceState?.activeIntegrationPath) {
            throw new Error(
              "No active integration. Please select an integration first.",
            );
          }

          if (!item) {
            throw new Error("No flow item provided.");
          }

          const filePath = await createFlowPayload(
            item.stableKey,
            workspaceState.activeIntegrationPath,
          );

          if (filePath) {
            log(
              "SUCCESS",
              `Payload created successfully for flow: ${item.flow.name}`,
              true,
            );
            flowPayloadsTreeDataProvider?.refresh();
          }
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(createPayloadFromFlowCommand);

    /**
     * command: prismatic.flowPayloads.testFlow
     * This command is used to test a specific flow from the Test Payloads tree view.
     * Called from the play button on flow items.
     */
    const testFlowFromTreeCommand = vscode.commands.registerCommand(
      "prismatic.flowPayloads.testFlow",
      async (item?: FlowItem) => {
        if (!item) {
          log("WARN", "No flow item provided for testing");
          return;
        }

        log("INFO", `Testing flow: ${item.flow.name}`);

        // Set this flow as the active flow in workspace state
        await stateManager.updateWorkspaceState({ flow: item.flow });

        // Execute the existing test command
        await vscode.commands.executeCommand("prismatic.integrations.test");

        // Focus the execution results panel
        vscode.commands.executeCommand("executionResults.webview.focus");
      },
    );
    context.subscriptions.push(testFlowFromTreeCommand);

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

    // Dispose of state manager
    await stateManager.dispose();

    // Dispose of prism CLI
    prismCLIManager.dispose();

    // Dispose of status bar manager
    statusBarManager?.dispose();

    // Dispose of test integration flow actor
    testIntegrationFlowActor?.stop();

    // Dispose of views
    executionResultsViewProvider?.dispose();
    integrationDetailsViewProvider?.dispose();
    configWizardPanel?.dispose();

    // Dispose of output channel
    outputChannel?.dispose();
  } catch (error) {
    console.error("Deactivation error:", error);
  }
}

export const log = (
  level: "SUCCESS" | "WARN" | "ERROR" | "INFO" | "DEBUG",
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
            : level === "DEBUG"
              ? "🐛"
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
