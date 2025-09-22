import { AuthManager } from "@extension/AuthManager";
import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";
import { IntegrationDiscovery } from "@extension/lib/IntegrationDiscovery";
import { IntegrationTreeDataProvider } from "@extension/views/IntegrationTreeDataProvider";
import { IntegrationDetailsTreeDataProvider } from "@extension/views/IntegrationDetailsTreeDataProvider";
import { IntegrationDecorationProvider } from "@extension/views/IntegrationDecorationProvider";
import { createConfigWizardPanel } from "@webview/views/configWizard/ViewProvider";
import { createExecutionResultsViewProvider } from "@webview/views/executionResults/ViewProvider";
import { CONFIG } from "config";
import * as vscode from "vscode";
import * as path from "path";
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
let integrationTreeDataProvider: IntegrationTreeDataProvider | undefined;
let integrationDetailsTreeDataProvider: IntegrationDetailsTreeDataProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
  try {
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
     * Discover integrations in workspace
     */
    log("INFO", "Discovering integrations in workspace...");
    const integrations = await IntegrationDiscovery.findAllIntegrations();
    log("INFO", `Found ${integrations.length} integration(s) in workspace`);

    /**
     * Load integration data into state
     */
    log("INFO", "Loading integration data...");
    await stateManager.loadIntegrationData();

    /**
     * Register views
     *   - settings
     *   - execution results
     *   - config wizard
     *   - flows sidebar
     */
    log("INFO", "Registering views...");

    executionResultsViewProvider = createExecutionResultsViewProvider(context);
    context.subscriptions.push(executionResultsViewProvider);

    configWizardPanel = createConfigWizardPanel(context);
    context.subscriptions.push(configWizardPanel);

    // Register integration tree data provider (list view)
    integrationTreeDataProvider = new IntegrationTreeDataProvider(stateManager);
    const integrationTreeView = vscode.window.createTreeView(
      "prismatic.integration",
      {
        treeDataProvider: integrationTreeDataProvider,
        showCollapseAll: true,
      },
    );
    context.subscriptions.push(integrationTreeView);

    // Register integration details tree data provider (details view)
    integrationDetailsTreeDataProvider = new IntegrationDetailsTreeDataProvider(stateManager);
    const integrationDetailsTreeView = vscode.window.createTreeView(
      "prismatic.integrationDetails",
      {
        treeDataProvider: integrationDetailsTreeDataProvider,
        showCollapseAll: true,
      },
    );
    context.subscriptions.push(integrationDetailsTreeView);

    // Connect the two tree views - when active integration changes, update details
    integrationTreeDataProvider.onDidChangeActiveIntegration(async (integration) => {
      if (integrationDetailsTreeDataProvider) {
        await integrationDetailsTreeDataProvider.setActiveIntegration(integration);
      }
    });

    // Initialize the active integration details on startup
    setTimeout(async () => {
      const activeIntegration = await stateManager.getActiveIntegration();
      if (activeIntegration && integrationDetailsTreeDataProvider) {
        await integrationDetailsTreeDataProvider.setActiveIntegration(activeIntegration);
      }
    }, 1000);

    // Register the file decoration provider for active integration highlighting
    const decorationProvider = new IntegrationDecorationProvider();
    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(decorationProvider)
    );

    // Create status bar item for active integration
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBarItem.command = "prismatic.integration.quickSwitch";
    statusBarItem.tooltip = "Click to switch integration";

    // Function to update status bar
    const updateStatusBar = async () => {
      const integrations = await IntegrationDiscovery.findAllIntegrations();
      const activeIntegration = await stateManager.getActiveIntegration();

      if (integrations.length === 0) {
        statusBarItem.hide();
      } else if (integrations.length === 1) {
        // Show the single integration (non-clickable)
        statusBarItem.text = `$(package) ${integrations[0].name}`;
        statusBarItem.command = undefined; // No command for single integration
        statusBarItem.tooltip = "Active Integration";
        statusBarItem.show();
      } else {
        // Multiple integrations, enable switcher
        statusBarItem.command = "prismatic.integration.quickSwitch";
        statusBarItem.tooltip = "Click to switch integration";
        if (activeIntegration) {
          statusBarItem.text = `$(package) ${activeIntegration.name}`;
        } else {
          statusBarItem.text = `$(package) No Active Integration`;
        }
        statusBarItem.show();
      }
    };

    // Initial update
    updateStatusBar();
    context.subscriptions.push(statusBarItem);

    // Update status bar when tree refreshes
    integrationTreeDataProvider.onDidChangeTreeData(() => {
      updateStatusBar();
    });

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
     * command: prismatic.integration.refresh
     * This command is used to refresh the integration tree view.
     */
    const integrationRefreshCommand = vscode.commands.registerCommand(
      "prismatic.integration.refresh",
      async () => {
        // Refresh the integration data in state first
        await stateManager.refreshIntegrationData();

        // Then refresh both tree views
        if (integrationTreeDataProvider) {
          integrationTreeDataProvider.refresh();
        }
        if (integrationDetailsTreeDataProvider) {
          integrationDetailsTreeDataProvider.refresh();
        }
      },
    );
    context.subscriptions.push(integrationRefreshCommand);

    /**
     * command: prismatic.flows.testFlow
     * This command is used to test a specific flow.
     */
    const flowsTestCommand = vscode.commands.registerCommand(
      "prismatic.flows.testFlow",
      async (treeItem: any) => {
        // VS Code passes the tree item instance for inline buttons
        if (!treeItem?.flowData) {
          log("ERROR", "No flow data provided", true);
          return;
        }

        const flowData = treeItem.flowData;
        log("INFO", `Testing flow: ${flowData.name} (${flowData.id})`, true);

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

          // Check for local test payload
          let testPayload = flowData.testPayload;
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const payloadFile = vscode.Uri.joinPath(
              workspaceFolder.uri,
              ".spectral",
              "test-payloads",
              flowData.id,
              "default.json",
            );

            try {
              const fileContent =
                await vscode.workspace.fs.readFile(payloadFile);
              testPayload = Buffer.from(fileContent).toString("utf8");
              log(
                "INFO",
                `Using local test payload for flow: ${flowData.name}`,
              );
            } catch {
              // Local payload doesn't exist, use API payload
              if (testPayload) {
                log(
                  "INFO",
                  `Using API test payload for flow: ${flowData.name}`,
                );
              }
            }
          }

          if (!testIntegrationFlowActor) {
            testIntegrationFlowActor = createActor(testIntegrationFlowMachine, {
              input: {},
            });
            testIntegrationFlowActor.start();
          }

          // Update workspace state to set the current flow being tested
          await stateManager.updateWorkspaceState({ flowId: flowData.id });

          // Get integration data from state
          const integration = await stateManager.getIntegration();

          // Send test event with flow-specific data and payload
          testIntegrationFlowActor.send({
            type: "TEST_INTEGRATION",
            integrationId: workspaceState.integrationId,
            flowId: flowData.id,
            accessToken,
            prismaticUrl: globalState?.prismaticUrl ?? CONFIG.prismaticUrl,
            testPayload, // Pass the payload to the test machine
            integration, // Pass the integration data
          });

          // Focus the Prismatic Executions view to show the test results
          await vscode.commands.executeCommand(
            "executionResults.webview.focus",
          );
        } catch (error) {
          log("ERROR", String(error), true);
        }
      },
    );
    context.subscriptions.push(flowsTestCommand);

    /**
     * command: prismatic.flows.copyWebhookUrl
     * This command copies the webhook URL for a flow to the clipboard.
     */
    const flowsCopyWebhookUrlCommand = vscode.commands.registerCommand(
      "prismatic.flows.copyWebhookUrl",
      async (flowData: any) => {
        if (!flowData?.testUrl) {
          vscode.window.showWarningMessage(
            "No webhook URL available for this flow",
          );
          return;
        }

        await vscode.env.clipboard.writeText(flowData.testUrl);
        vscode.window.showInformationMessage(`Webhook URL copied to clipboard`);
      },
    );
    context.subscriptions.push(flowsCopyWebhookUrlCommand);

    /**
     * command: prismatic.flows.openInEditor
     * This command opens the flow definition in the editor.
     */
    const flowsOpenInEditorCommand = vscode.commands.registerCommand(
      "prismatic.flows.openInEditor",
      async (flowData: any) => {
        if (!flowData?.stableKey) {
          log("ERROR", "No flow stableKey provided", true);
          return;
        }

        // Update workspace state to set the current flow being viewed
        if (flowData?.id) {
          await stateManager.updateWorkspaceState({ flowId: flowData.id });
        }

        try {
          // Get active integration path to search in correct directory
          const workspaceState = await stateManager.getWorkspaceState();
          const activeIntegrationPath = workspaceState?.activeIntegrationPath;

          if (!activeIntegrationPath) {
            log("ERROR", "No active integration path found", true);
            vscode.window.showErrorMessage("No active integration selected");
            return;
          }

          // Search for the flow definition in the codebase
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error("No workspace folder found");
          }

          // Build search pattern relative to active integration
          // Handle case where integration is at workspace root
          const relativePath = path.relative(workspaceFolders[0].uri.fsPath, activeIntegrationPath);
          const searchBase = relativePath || '.';

          // Search for ALL TypeScript/JavaScript files in the integration directory
          // Don't assume they're named "flows" - they could be named anything
          const searchPattern = `${searchBase}/**/*.{ts,js}`;

          // Search for any TypeScript/JavaScript files in the active integration
          const flowFiles = await vscode.workspace.findFiles(
            searchPattern,
            "**/node_modules/**"
          );

          // Check if we found any files
          if (flowFiles.length === 0) {
            vscode.window.showWarningMessage(
              `No TypeScript/JavaScript files found in integration: ${searchBase}`
            );
            return;
          }

          // Search each file for the flow stableKey
          for (const file of flowFiles) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();

            // Quick check: Skip files that don't import from @prismatic-io/spectral
            // This speeds up search by eliminating non-flow files
            if (!text.includes('@prismatic-io/spectral')) {
              continue;
            }

            // Look for the stableKey in various patterns
            const patterns = [
              `stableKey: "${flowData.stableKey}"`,
              `stableKey: '${flowData.stableKey}'`,
              `stableKey: \`${flowData.stableKey}\``,
            ];

            for (const pattern of patterns) {
              const index = text.indexOf(pattern);
              if (index !== -1) {
                // Found the flow by stableKey
                const position = document.positionAt(index);
                await vscode.window.showTextDocument(document, {
                  selection: new vscode.Range(position, position),
                });
                return;
              }
            }
          }

          vscode.window.showWarningMessage(
            `Could not find flow definition with stableKey: ${flowData.stableKey} in integration at ${searchBase}`,
          );
        } catch (error) {
          log("ERROR", `Failed to open flow definition: ${error}`, true);
        }
      },
    );
    context.subscriptions.push(flowsOpenInEditorCommand);

    /**
     * command: prismatic.configPages.openInEditor
     * This command opens the config page definition in the editor.
     */
    const configPagesOpenInEditorCommand = vscode.commands.registerCommand(
      "prismatic.configPages.openInEditor",
      async (configPageData: any) => {
        if (!configPageData?.name) {
          log("ERROR", "No config page name provided", true);
          return;
        }

        try {
          // Search for the config page definition in the codebase
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error("No workspace folder found");
          }

          // Search for configPages definition files
          const configFiles = await vscode.workspace.findFiles(
            "**/configPages.{ts,js}",
            "**/node_modules/**",
          );

          if (configFiles.length === 0) {
            // Try alternative patterns
            const altConfigFiles = await vscode.workspace.findFiles(
              "**/*config*.{ts,js}",
              "**/node_modules/**",
            );
            configFiles.push(...altConfigFiles);
          }

          // Search each file for the config page name
          for (const file of configFiles) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();

            // Look for the config page name in various patterns
            const patterns = [
              `["'\`]${configPageData.name}["'\`]:\\s*configPage`,
              `${configPageData.name}:\\s*configPage`,
              `configPage\\(\\{[\\s\\S]*?["'\`]${configPageData.name}["'\`]`,
            ];

            for (const pattern of patterns) {
              const regex = new RegExp(pattern, "i");
              const match = text.match(regex);
              if (match) {
                // Found the config page, open the document
                const position = document.positionAt(text.indexOf(match[0]));
                await vscode.window.showTextDocument(document, {
                  selection: new vscode.Range(position, position),
                });
                return;
              }
            }
          }

          vscode.window.showWarningMessage(
            `Could not find config page definition for "${configPageData.name}"`,
          );
        } catch (error) {
          log("ERROR", `Failed to open config page definition: ${error}`, true);
        }
      },
    );
    context.subscriptions.push(configPagesOpenInEditorCommand);

    /**
     * command: prismatic.flows.testPayload
     * This command allows viewing and editing a flow's test payload.
     */
    const flowsTestPayloadCommand = vscode.commands.registerCommand(
      "prismatic.flows.testPayload",
      async (treeItem: any) => {
        if (!treeItem?.flowData) {
          log("ERROR", "No flow data provided", true);
          return;
        }

        const flowData = treeItem.flowData;
        const flowId = flowData.id;
        const flowName = flowData.name;

        try {
          // Determine the payload file path
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            throw new Error("No workspace folder found");
          }

          const payloadDir = vscode.Uri.joinPath(
            workspaceFolder.uri,
            ".spectral",
            "test-payloads",
            flowId,
          );
          const payloadFile = vscode.Uri.joinPath(payloadDir, "default.json");

          // Ensure the directory exists
          await vscode.workspace.fs.createDirectory(payloadDir);

          // Check if local payload exists, if not create it
          let payloadContent = flowData.testPayload || "{}";
          let fileExists = false;

          try {
            const fileContent = await vscode.workspace.fs.readFile(payloadFile);
            payloadContent = Buffer.from(fileContent).toString("utf8");
            fileExists = true;
          } catch {
            // File doesn't exist, we'll create it
          }

          // Try to format as JSON
          try {
            const parsed = JSON.parse(payloadContent);
            payloadContent = JSON.stringify(parsed, null, 2);
          } catch {
            // Not valid JSON, use empty object
            payloadContent = "{}";
          }

          // Create the file if it doesn't exist
          if (!fileExists) {
            await vscode.workspace.fs.writeFile(
              payloadFile,
              Buffer.from(payloadContent, "utf8"),
            );
          }

          // Open the actual file
          const doc = await vscode.workspace.openTextDocument(payloadFile);
          await vscode.window.showTextDocument(doc);

          // Register a save listener for this document
          const saveDisposable = vscode.workspace.onDidSaveTextDocument(
            async (savedDoc) => {
              if (savedDoc.uri.toString() === payloadFile.toString()) {
                try {
                  const content = savedDoc.getText();

                  // Call the stub for future GraphQL implementation
                  const workspaceState = await stateManager.getWorkspaceState();
                  if (workspaceState?.integrationId) {
                    await updateTestPayload(
                      flowId,
                      workspaceState.integrationId,
                      content,
                    );
                  }

                  vscode.window.showInformationMessage(
                    `Test payload saved for flow: ${flowName}`,
                  );

                  // Refresh both tree views
                  if (integrationTreeDataProvider) {
                    integrationTreeDataProvider.refresh();
                  }
                  if (integrationDetailsTreeDataProvider) {
                    integrationDetailsTreeDataProvider.refresh();
                  }
                } catch (error) {
                  log(
                    "ERROR",
                    `Failed to process test payload save: ${error}`,
                    true,
                  );
                }
              }
            },
          );

          // Clean up the listener when the document is closed
          const closeDisposable = vscode.workspace.onDidCloseTextDocument(
            (closedDoc) => {
              if (closedDoc.uri.toString() === payloadFile.toString()) {
                saveDisposable.dispose();
                closeDisposable.dispose();
              }
            },
          );
        } catch (error) {
          log("ERROR", `Failed to open test payload: ${error}`, true);
        }
      },
    );
    context.subscriptions.push(flowsTestPayloadCommand);

    /**
     * Stub function to update test payload via GraphQL
     * TODO: Implement actual GraphQL mutation
     */
    async function updateTestPayload(
      flowId: string,
      integrationId: string,
      payload: string,
    ) {
      // TODO: Implement GraphQL mutation to persist payload to Prismatic
      log(
        "INFO",
        `Will sync payload for flow ${flowId} in integration ${integrationId}`,
      );
      log("INFO", `Payload: ${payload.substring(0, 100)}...`);
    }

    /**
     * command: prismatic.flows.viewDetails
     * This command shows detailed information about a flow.
     */
    const flowsViewDetailsCommand = vscode.commands.registerCommand(
      "prismatic.flows.viewDetails",
      async (flowData: any) => {
        if (!flowData) {
          log("ERROR", "No flow data provided", true);
          return;
        }

        const details = [];
        details.push(`**Flow: ${flowData.name}**`);
        details.push("");

        if (flowData.description) {
          details.push(`**Description:** ${flowData.description}`);
        }

        details.push(`**ID:** ${flowData.id}`);

        if (flowData.isSynchronous !== undefined) {
          details.push(
            `**Type:** ${flowData.isSynchronous ? "Synchronous" : "Asynchronous"}`,
          );
        }

        if (flowData.testUrl) {
          details.push(`**Webhook URL:** ${flowData.testUrl}`);
        }

        if (flowData.usesFifoQueue !== undefined) {
          details.push(
            `**FIFO Queue:** ${flowData.usesFifoQueue ? "Yes" : "No"}`,
          );
        }

        if (flowData.testPayload) {
          details.push("");
          details.push("**Test Payload:**");
          details.push("```json");
          try {
            const formatted = JSON.stringify(
              JSON.parse(flowData.testPayload),
              null,
              2,
            );
            details.push(formatted);
          } catch {
            details.push(flowData.testPayload);
          }
          details.push("```");
        }

        // Create a webview panel to show the details
        const panel = vscode.window.createWebviewPanel(
          "flowDetails",
          `Flow: ${flowData.name}`,
          vscode.ViewColumn.Beside,
          { enableScripts: false },
        );

        const markdown = details.join("\n");
        const md = (await vscode.commands.executeCommand(
          "markdown.api.render",
          markdown,
        )) as string;

        panel.webview.html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { padding: 20px; font-family: var(--vscode-font-family); }
                code { background-color: var(--vscode-textCodeBlock-background); }
                pre { overflow-x: auto; }
              </style>
          </head>
          <body>
              ${md}
          </body>
          </html>
        `;
      },
    );
    context.subscriptions.push(flowsViewDetailsCommand);

    /**
     * command: prismatic.integration.openInBrowser
     * This command opens the integration in the Prismatic web UI.
     */
    const integrationOpenInBrowserCommand = vscode.commands.registerCommand(
      "prismatic.integration.openInBrowser",
      async (integrationData?: any) => {
        // If no data provided (called from view title), get from state
        if (!integrationData) {
          const workspaceState = await stateManager.getWorkspaceState();
          const globalState = await stateManager.getGlobalState();

          if (!workspaceState?.integrationId || !globalState?.prismaticUrl) {
            log("ERROR", "No integration ID or Prismatic URL available", true);
            return;
          }

          integrationData = {
            id: workspaceState.integrationId,
            prismaticUrl: globalState.prismaticUrl || CONFIG.prismaticUrl,
          };
        }

        if (!integrationData?.id || !integrationData?.prismaticUrl) {
          log("ERROR", "No integration ID or Prismatic URL provided", true);
          return;
        }

        const url = `${integrationData.prismaticUrl}/integrations/${integrationData.id}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        log("INFO", `Opening integration in browser: ${url}`);
      },
    );
    context.subscriptions.push(integrationOpenInBrowserCommand);

    /**
     * command: prism integrations:init
     * This command is used to initialize a new integration.
     */
    const prismIntegrationsInitCommand = vscode.commands.registerCommand(
      "prismatic.integrations.init",
      async () => {
        outputChannel.show(true);

        log("INFO", "Starting new integration initialization...");

        try {
          // Prompt for integration name
          const integrationName = await vscode.window.showInputBox({
            prompt: "Enter a name for your new integration",
            placeHolder: "My Integration",
            validateInput: (value) => {
              if (!value || value.trim() === "") {
                return "Integration name is required";
              }
              if (value.length < 3) {
                return "Integration name must be at least 3 characters";
              }
              return null;
            },
          });

          if (!integrationName) {
            log("INFO", "Integration initialization cancelled by user");
            return;
          }

          log("INFO", `Initializing new integration: ${integrationName}`);

          // Initialize the integration
          const output = await prismCLIManager.integrationsInit(integrationName);

          log("INFO", output);
          log("SUCCESS", `Integration "${integrationName}" initialized successfully!`);

          // Open the integration's index.ts file
          try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
              const indexPath = vscode.Uri.joinPath(
                workspaceFolder.uri,
                "src",
                "index.ts"
              );
              const doc = await vscode.workspace.openTextDocument(indexPath);
              await vscode.window.showTextDocument(doc);
              log("INFO", "Opened src/index.ts for editing");
            }
          } catch (error) {
            log("WARN", `Could not open src/index.ts: ${error}`);
          }

          // Show success message with option to import
          const importNow = await vscode.window.showInformationMessage(
            `Integration "${integrationName}" has been initialized successfully!`,
            "Import to Prismatic"
          );

          if (importNow === "Import to Prismatic") {
            await vscode.commands.executeCommand("prismatic.integrations.import");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log("ERROR", `Failed to initialize integration: ${errorMessage}`);
          vscode.window.showErrorMessage(
            `Failed to initialize integration: ${errorMessage}`
          );
        }
      },
    );
    context.subscriptions.push(prismIntegrationsInitCommand);

    /**
     * command: prism integrations:import
     * This command is used to import the integration into Prismatic.
     * Can accept an optional integration parameter or uses the active integration.
     */
    const prismIntegrationsImportCommand = vscode.commands.registerCommand(
      "prismatic.integrations.import",
      async (integration?: any) => {
        try {
          // Get the active integration if not provided
          if (!integration) {
            integration = await stateManager.getActiveIntegration();
          }

          if (!integration) {
            vscode.window.showWarningMessage("No active integration to import");
            return;
          }

          outputChannel.show(true);
          log("INFO", `Starting import for integration: ${integration.name}`);

          try {
            // Build the project in the integration directory
            const { stdout: buildStdout, stderr: buildStderr } =
              await executeProjectNpmScript("build", integration.path);

            if (buildStderr) {
              log("WARN", `Build warnings/errors: ${buildStderr}`);
            }

            log("INFO", "Starting project build...");
            log("INFO", buildStdout);
            log("SUCCESS", "Project build completed successfully!");
            log("INFO", "Starting integration import...");

            // Import the integration with the specific path
            const integrationId = await prismCLIManager.integrationsImport(integration.path);

            // Clear cache to refresh discovery
            IntegrationDiscovery.clearCache();

            // Re-fetch the updated integration with new properties (hasPrismJson, integrationId)
            const updatedIntegration = await IntegrationDiscovery.getIntegrationByPath(integration.path);

            // Update workspace state using centralized method
            if (updatedIntegration) {
              await stateManager.setActiveIntegration(updatedIntegration);
            }

            // Refresh integration data after import
            await stateManager.refreshIntegrationData();

            // Refresh both tree views
            if (integrationTreeDataProvider) {
              integrationTreeDataProvider.refresh();
            }
            if (integrationDetailsTreeDataProvider && updatedIntegration) {
              // Critical: Set the updated integration so details view loads new data
              await integrationDetailsTreeDataProvider.setActiveIntegration(updatedIntegration);
            }

            log(
              "SUCCESS",
              `Integration "${integration.name}" imported successfully! ID: ${integrationId}`,
              true,
            );
          } catch (buildError) {
            const errorMessage = buildError instanceof Error ? buildError.message : String(buildError);
            throw new Error(`Failed to build or import integration: ${errorMessage}`);
          }
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
     * command: prismatic.integration.switchTo
     * This command switches the active integration to the selected one.
     */
    const integrationSwitchToCommand = vscode.commands.registerCommand(
      "prismatic.integration.switchTo",
      async (treeItem?: any) => {
        try {
          // Get the integration info from the tree item
          const integrationInfo = treeItem?.integration;
          if (!integrationInfo) {
            log("ERROR", "No integration info provided", true);
            return;
          }

          // Set as active integration using centralized method
          await stateManager.setActiveIntegration(integrationInfo);

          // Clear the integration discovery cache
          IntegrationDiscovery.clearCache();

          // Update the active integration in the tree provider
          if (integrationTreeDataProvider) {
            await integrationTreeDataProvider.setActiveIntegration(integrationInfo);
          }

          log("SUCCESS", `Switched to integration: ${integrationInfo.name}`);
          vscode.window.showInformationMessage(
            `Switched to integration: ${integrationInfo.name}`
          );

          // Update status bar
          updateStatusBar();
        } catch (error) {
          log("ERROR", `Failed to switch integration: ${error}`, true);
        }
      },
    );
    context.subscriptions.push(integrationSwitchToCommand);

    /**
     * command: prismatic.integration.quickSwitch
     * This command shows a quick pick to switch between integrations.
     */
    const integrationQuickSwitchCommand = vscode.commands.registerCommand(
      "prismatic.integration.quickSwitch",
      async () => {
        try {
          // Get all integrations
          const integrations = await IntegrationDiscovery.findAllIntegrations();

          if (integrations.length === 0) {
            vscode.window.showInformationMessage("No integrations found in workspace");
            return;
          }

          if (integrations.length === 1) {
            vscode.window.showInformationMessage("Only one integration found in workspace");
            return;
          }

          // Get current active integration
          const activeIntegration = await stateManager.getActiveIntegration();

          // Create quick pick items
          const items = integrations.map(integration => ({
            label: integration.name,
            description: integration.relativePath,
            detail: [
              integration.hasPrismJson ? "✅ Imported" : "⚠️ Not imported",
              integration.path === activeIntegration?.path ? "(active)" : ""
            ].filter(Boolean).join(" "),
            integration
          }));

          // Show quick pick
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Select an integration to switch to",
            title: "Switch Integration"
          });

          if (selected) {
            // Switch to the selected integration using centralized method
            await stateManager.setActiveIntegration(selected.integration);

            // Clear the cache to force refresh
            IntegrationDiscovery.clearCache();

            // Update the active integration in the tree provider
            if (integrationTreeDataProvider) {
              await integrationTreeDataProvider.setActiveIntegration(selected.integration);
            }

            log("SUCCESS", `Switched to integration: ${selected.integration.name}`);
            vscode.window.showInformationMessage(
              `Switched to integration: ${selected.integration.name}`
            );

            // Update status bar
            updateStatusBar();
          }
        } catch (error) {
          log("ERROR", `Failed to quick switch integration: ${error}`, true);
        }
      },
    );
    context.subscriptions.push(integrationQuickSwitchCommand);


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

          // Get flows from state instead of fetching
          let integration = await stateManager.getIntegration();
          if (!integration) {
            // If not in state, try to load it
            await stateManager.loadIntegrationData();
            integration = await stateManager.getIntegration();
            if (!integration) {
              throw new Error("Failed to load integration data");
            }
          }

          const flows = integration?.systemInstance?.flowConfigs?.nodes?.map(
            (node) => node.flow
          ) || [];

          if (flows.length === 0) {
            throw new Error("No flows found for this integration");
          }

          // Let user select a flow
          let selectedFlow;
          if (flows.length === 1) {
            selectedFlow = flows[0];
          } else {
            const flowItems = flows.map((flow: any) => ({
              label: flow.name,
              description: flow.id,
              flow: flow,
            }));

            const selected = await vscode.window.showQuickPick(flowItems, {
              placeHolder: "Select a flow to test",
              title: "Test Integration Flow",
            });

            if (!selected) {
              log("INFO", "Flow selection cancelled");
              return;
            }

            selectedFlow = selected.flow;
          }

          // Update workspace state with selected flow
          await stateManager.updateWorkspaceState({ flowId: selectedFlow.id });

          // Check for local test payload in .spectral/test-payloads/{flowId}/default.json
          let testPayload = undefined;
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const payloadFile = vscode.Uri.joinPath(
              workspaceFolder.uri,
              ".spectral",
              "test-payloads",
              selectedFlow.id,
              "default.json",
            );

            try {
              const fileContent =
                await vscode.workspace.fs.readFile(payloadFile);
              testPayload = Buffer.from(fileContent).toString("utf8");
              log(
                "INFO",
                `Using local test payload from .spectral/test-payloads/${selectedFlow.id}/default.json`,
              );
            } catch {
              // No local payload, use the API payload from selectedFlow
              if (selectedFlow.testPayload) {
                testPayload = selectedFlow.testPayload;
                log(
                  "INFO",
                  `Using API test payload for flow: ${selectedFlow.name}`,
                );
              }
            }
          }

          // send the test event with the integration ID and data
          testIntegrationFlowActor.send({
            type: "TEST_INTEGRATION",
            integrationId: workspaceState.integrationId,
            flowId: selectedFlow.id,
            accessToken,
            prismaticUrl: globalState?.prismaticUrl ?? CONFIG.prismaticUrl,
            testPayload,
            integration, // Pass the integration data
          });

          // Focus the Prismatic Executions view to show the test results
          await vscode.commands.executeCommand(
            "executionResults.webview.focus",
          );
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

    // Add file system watcher for .spectral directories
    const spectralWatcher = vscode.workspace.createFileSystemWatcher(
      "**/.spectral/**",
      false, // Don't ignore creates
      true,  // Ignore changes (we only care about creates/deletes)
      false  // Don't ignore deletes
    );

    // When .spectral folders are created or deleted, refresh the tree
    spectralWatcher.onDidCreate(async (uri) => {
      log("INFO", `Detected new .spectral directory: ${uri.fsPath}`);

      // Clear cache to force re-discovery
      IntegrationDiscovery.clearCache();

      // Refresh both tree views
      if (integrationTreeDataProvider) {
        integrationTreeDataProvider.refresh();
      }
      if (integrationDetailsTreeDataProvider) {
        integrationDetailsTreeDataProvider.refresh();
      }

      // Update status bar
      updateStatusBar();
    });

    spectralWatcher.onDidDelete(async (uri) => {
      log("INFO", `Detected deleted .spectral directory: ${uri.fsPath}`);

      // Clear cache to force re-discovery
      IntegrationDiscovery.clearCache();

      // Refresh both tree views
      if (integrationTreeDataProvider) {
        integrationTreeDataProvider.refresh();
      }
      if (integrationDetailsTreeDataProvider) {
        integrationDetailsTreeDataProvider.refresh();
      }

      // Update status bar
      updateStatusBar();
    });

    context.subscriptions.push(spectralWatcher);

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
