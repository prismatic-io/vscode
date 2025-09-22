import type { MessageType } from "@type/messages";
import type { GlobalState, WorkspaceState, IntegrationData } from "@type/state";
import { produce } from "immer";
import type * as vscode from "vscode";
import { CONFIG } from "../../config";
import { log } from "@/extension";
import {
  IntegrationDiscovery,
  type SpectralFolderInfo,
} from "@/extension/lib/IntegrationDiscovery";

const GLOBAL_STATE_KEY = "prismatic-global-state";

const DEFAULT_GLOBAL_STATE: GlobalState = {
  accessToken: undefined,
  refreshToken: undefined,
  prismaticUrl: process.env.PRISMATIC_URL || CONFIG.prismaticUrl,
};

const WORKSPACE_STATE_KEY = "prismatic-workspace-state";

const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  debugMode: undefined,
  headers: undefined,
  payload: undefined,
  integrationId: undefined,
  systemInstanceId: undefined,
  flowId: undefined,
  integration: undefined,
  activeIntegrationPath: undefined,
  discoveredIntegrations: undefined,
};

export class StateManager {
  private static instance: StateManager | null = null;
  private context: vscode.ExtensionContext;
  private webviews: Set<vscode.Webview> = new Set();

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initializes the StateManager singleton instance.
   * @param context - The VS Code extension context
   * @returns The initialized StateManager instance
   */
  static async initialize(
    context: vscode.ExtensionContext,
  ): Promise<StateManager> {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager(context);
      await StateManager.instance.initializeDefaultState();
    }

    return StateManager.instance;
  }

  /**
   * Initializes the default state for both global and workspace state.
   * This ensures all required state fields have initial values.
   */
  private async initializeDefaultState(): Promise<void> {
    if ((await this.getGlobalState()) === undefined) {
      await this.updateGlobalState(DEFAULT_GLOBAL_STATE);
    }

    if ((await this.getWorkspaceState()) === undefined) {
      await this.updateWorkspaceState(DEFAULT_WORKSPACE_STATE);
    }
  }

  /**
   * Gets the singleton instance of StateManager.
   * @throws {Error} If StateManager has not been initialized
   * @returns The StateManager instance
   */
  static getInstance(): StateManager {
    if (!StateManager.instance) {
      throw new Error("StateManager not initialized. Call initialize() first.");
    }

    return StateManager.instance;
  }

  /**
   * Gets the global state storage object.
   * @returns The global state storage object
   */
  private get globalState(): vscode.Memento {
    return this.context.globalState;
  }

  /**
   * Gets the workspace state storage object.
   * @returns The workspace state storage object
   */
  private get workspaceState(): vscode.Memento {
    return this.context.workspaceState;
  }

  /**
   * Registers a webview to receive state change notifications.
   * @param webview - The webview to register
   */
  public registerWebview(webview: vscode.Webview) {
    this.webviews.add(webview);
  }

  /**
   * Un-registers a webview from receiving state change notifications.
   * @param webview - The webview to unregister
   */
  public unregisterWebview(webview: vscode.Webview) {
    this.webviews.delete(webview);
  }

  /**
   * Notifies all registered webviews of a state change.
   * @param message - The message to send to all webviews
   */
  private notifyWebviews(message: MessageType) {
    for (const webview of this.webviews) {
      webview.postMessage(message);
    }
  }

  /**
   * Creates a new state by merging the current state with the new value.
   * @param currentState - The current state value
   * @param value - The new value to merge with the current state
   * @returns The new state
   */
  private createNewState<T>(currentState: T, incomingValue: Partial<T> | T): T {
    if (
      typeof incomingValue === "object" &&
      incomingValue !== null &&
      typeof currentState === "object" &&
      currentState !== null
    ) {
      return produce(currentState, (draft) => {
        for (const [key, val] of Object.entries(incomingValue)) {
          (draft as Record<string, unknown>)[key] = val;
        }
      });
    }

    return incomingValue as T;
  }

  /**
   * Updates a value in the global state and notifies all webviews.
   * @param key - The key to update in the global state
   * @param value - The new value to set
   */
  public async updateGlobalState(
    incomingValue: Partial<GlobalState>,
  ): Promise<void> {
    const currentState = (await this.getGlobalState()) ?? DEFAULT_GLOBAL_STATE;
    const updatedState = this.createNewState(currentState, incomingValue);

    await this.globalState.update(GLOBAL_STATE_KEY, updatedState);

    this.notifyWebviews({
      type: "stateChange",
      payload: {
        scope: "global",
        value: updatedState,
      },
    });
  }

  /**
   * Updates a value in the workspace state and notifies all webviews.
   * @param key - The key to update in the workspace state
   * @param value - The new value to set
   */
  public async updateWorkspaceState(
    incomingValue: Partial<WorkspaceState>,
  ): Promise<void> {
    const currentState =
      (await this.getWorkspaceState()) ?? DEFAULT_WORKSPACE_STATE;
    const updatedState = this.createNewState(currentState, incomingValue);

    await this.workspaceState.update(WORKSPACE_STATE_KEY, updatedState);

    this.notifyWebviews({
      type: "stateChange",
      payload: {
        scope: "workspace",
        value: updatedState,
      },
    });
  }

  /**
   * Retrieves a value from the global state.
   * @returns The value associated with the key, or undefined if not found
   */
  public async getGlobalState(): Promise<GlobalState | undefined> {
    return this.globalState.get<GlobalState>(GLOBAL_STATE_KEY);
  }

  /**
   * Retrieves a value from the workspace state.
   * @returns The value associated with the key, or undefined if not found
   */
  async getWorkspaceState(): Promise<WorkspaceState | undefined> {
    return this.workspaceState.get<WorkspaceState>(WORKSPACE_STATE_KEY);
  }

  /**
   * Clears all state from both global and workspace storage.
   */
  private async clearAllState(): Promise<void> {
    await this.globalState.update(GLOBAL_STATE_KEY, undefined);
    await this.workspaceState.update(WORKSPACE_STATE_KEY, undefined);
  }

  /**
   * Loads integration data from the API and stores it in workspace state.
   * @returns The loaded integration data or null if not found
   */
  public async loadIntegrationData(): Promise<IntegrationData | null> {
    try {
      const workspaceState = await this.getWorkspaceState();
      const globalState = await this.getGlobalState();

      if (!workspaceState?.integrationId) {
        log("INFO", "[StateManager] No integration ID found, skipping load");
        return null;
      }

      if (!globalState?.accessToken || !globalState?.prismaticUrl) {
        log(
          "WARN",
          "[StateManager] Missing auth credentials, cannot load integration",
        );
        return null;
      }

      log(
        "INFO",
        `[StateManager] Loading integration data for ID: ${workspaceState.integrationId}`,
      );

      // Fetch integration data using the same query as TreeDataProvider
      const { fetcher } = await import("@/shared/fetcher");

      const GET_INTEGRATION = `
        query GetIntegration($integrationId: ID!) {
          integration(id: $integrationId) {
            category
            versionNumber
            labels
            description
            name
            configPages
            systemInstance {
              id
              configState
              flowConfigs {
                nodes {
                  flow {
                    id
                    name
                    stableKey
                    isSynchronous
                    description
                    usesFifoQueue
                    schemas
                    testUrl
                    testPayload
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetcher<
        {
          integration: {
            name: string;
            description?: string;
            versionNumber?: string;
            category?: string;
            labels?: string[];
            configPages?: string;
            systemInstance: {
              id: string;
              configState: string;
              flowConfigs: {
                nodes: Array<{
                  flow: {
                    id: string;
                    name: string;
                    stableKey: string;
                    isSynchronous?: boolean;
                    description?: string;
                    usesFifoQueue?: boolean;
                    schemas?: any;
                    testUrl?: string;
                    testPayload?: string;
                  };
                }>;
              };
            };
          };
        },
        { accessToken: string; prismaticUrl: string; integrationId: string }
      >(GET_INTEGRATION, {
        accessToken: globalState.accessToken,
        prismaticUrl: globalState.prismaticUrl,
        integrationId: workspaceState.integrationId,
      });

      if (response.errors || !response.data?.integration) {
        log(
          "ERROR",
          `[StateManager] Failed to load integration: ${response.errors?.[0]?.message || "Not found"}`,
        );
        return null;
      }

      const integration = response.data.integration;

      // Parse configPages JSON string
      let configPages = undefined;
      if (integration.configPages) {
        try {
          configPages = JSON.parse(integration.configPages);
        } catch (error) {
          log("WARN", `[StateManager] Failed to parse configPages: ${error}`);
        }
      }

      const integrationData: IntegrationData = {
        id: workspaceState.integrationId,
        name: integration.name,
        description: integration.description,
        versionNumber: integration.versionNumber,
        category: integration.category,
        labels: integration.labels,
        configPages: configPages,
        systemInstance: integration.systemInstance,
      };

      // Store in workspace state
      await this.updateWorkspaceState({
        integration: integrationData,
        systemInstanceId: integration.systemInstance?.id,
      });

      return integrationData;
    } catch (error) {
      log("ERROR", `[StateManager] Error loading integration data: ${error}`);
      return null;
    }
  }

  /**
   * Refreshes the integration data by fetching from the API again.
   * @returns The refreshed integration data or null if not found
   */
  public async refreshIntegrationData(): Promise<IntegrationData | null> {
    log("INFO", "[StateManager] Refreshing integration data");
    return this.loadIntegrationData();
  }

  /**
   * Gets the current integration data from workspace state.
   * @returns The cached integration data or undefined if not loaded
   */
  public async getIntegration(): Promise<IntegrationData | undefined> {
    const workspaceState = await this.getWorkspaceState();
    return workspaceState?.integration;
  }

  /**
   * Sets the active integration and ensures all related state is synchronized.
   * This is the single source of truth for active integration management.
   * @param integration - The integration to set as active, or undefined to clear
   */
  public async setActiveIntegration(
    integration: SpectralFolderInfo | undefined,
  ): Promise<void> {
    log(
      "INFO",
      `[StateManager] Setting active integration: ${integration?.name || "none"}`,
    );

    if (!integration) {
      // Clear active integration
      await this.updateWorkspaceState({
        integrationId: undefined,
        systemInstanceId: undefined,
        flowId: undefined,
        integration: undefined,
        activeIntegrationPath: undefined,
      });
      return;
    }

    // Validate the integration has necessary data
    if (!integration.hasPrismJson || !integration.integrationId) {
      log(
        "WARN",
        `[StateManager] Cannot set integration without prism.json or integrationId: ${integration.name}`,
      );
      // Still update the path so UI can show import prompt
      await this.updateWorkspaceState({
        activeIntegrationPath: integration.path,
        integrationId: undefined,
        systemInstanceId: undefined,
        flowId: undefined,
        integration: undefined,
      });
      return;
    }

    // Update workspace state with new active integration
    await this.updateWorkspaceState({
      activeIntegrationPath: integration.path,
      integrationId: integration.integrationId,
    });

    // Load the full integration data from API
    await this.loadIntegrationData();

    // Validate consistency after loading
    await this.validateIntegrationConsistency();
  }

  /**
   * Gets the current active integration based on workspace state.
   * @returns The active integration or undefined if none is active
   */
  public async getActiveIntegration(): Promise<SpectralFolderInfo | undefined> {
    const workspaceState = await this.getWorkspaceState();
    if (!workspaceState?.activeIntegrationPath) {
      return undefined;
    }

    // Find the integration by path
    const integrations = await IntegrationDiscovery.findAllIntegrations();
    const activeIntegration = integrations.find(
      (i) => i.path === workspaceState.activeIntegrationPath,
    );

    if (!activeIntegration) {
      log(
        "WARN",
        `[StateManager] Active integration path not found: ${workspaceState.activeIntegrationPath}`,
      );
      // Clear invalid state
      await this.updateWorkspaceState({
        activeIntegrationPath: undefined,
        integrationId: undefined,
        integration: undefined,
      });
      return undefined;
    }

    return activeIntegration;
  }

  /**
   * Validates that the current integration state is consistent.
   * Checks that integrationId, activeIntegrationPath, and loaded data all match.
   */
  private async validateIntegrationConsistency(): Promise<void> {
    const workspaceState = await this.getWorkspaceState();
    if (!workspaceState) {
      return;
    }

    const { integrationId, activeIntegrationPath, integration } =
      workspaceState;

    // No active integration is valid
    if (!integrationId && !activeIntegrationPath && !integration) {
      return;
    }

    // All three should be present or absent together
    const hasId = !!integrationId;
    const hasPath = !!activeIntegrationPath;
    const hasData = !!integration;

    if (hasId !== hasPath || hasId !== hasData) {
      log(
        "ERROR",
        `[StateManager] Integration state inconsistency detected:
        - integrationId: ${hasId ? integrationId : "missing"}
        - activeIntegrationPath: ${hasPath ? activeIntegrationPath : "missing"}
        - integration data: ${hasData ? "loaded" : "missing"}`,
      );

      // If we have a path, try to restore consistency
      if (hasPath) {
        const activeIntegration = await this.getActiveIntegration();
        if (activeIntegration) {
          await this.setActiveIntegration(activeIntegration);
        }
      } else {
        // Clear all integration state
        await this.setActiveIntegration(undefined);
      }
    }

    // Validate that loaded integration data matches the ID
    if (integration && integrationId && integration.id !== integrationId) {
      log(
        "ERROR",
        `[StateManager] Integration ID mismatch:
        - Expected: ${integrationId}
        - Loaded: ${integration.id}`,
      );
      // Reload the correct data
      await this.loadIntegrationData();
    }
  }

  /**
   * Synchronizes the integration state with the file system.
   * Called when file system changes are detected.
   */
  public async syncIntegrationState(): Promise<void> {
    log(
      "INFO",
      "[StateManager] Synchronizing integration state with file system",
    );

    const activeIntegration = await this.getActiveIntegration();
    if (activeIntegration) {
      // Re-set to ensure consistency
      await this.setActiveIntegration(activeIntegration);
    }
  }

  /**
   * Disposes of the StateManager singleton instance and clears all state.
   */
  public async dispose(): Promise<void> {
    await this.clearAllState();
    StateManager.instance = null;
  }
}
