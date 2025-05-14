import type * as vscode from "vscode";
import type { GlobalState, WorkspaceState } from "@typeDefs/state";
import type { MessageType } from "@typeDefs/messages";

const DEFAULT_GLOBAL_STATE: GlobalState = {
  accessToken: undefined,
  refreshToken: undefined,
};

const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  configWizard: {
    dummy: "",
  },
  executionResults: {
    dummy: "",
    filters: {
      type: "",
    },
  },
  settings: {
    dummy: "",
    debugMode: false,
    headers: {},
    payload: "",
  },
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
    context: vscode.ExtensionContext
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
    for (const [keyBase, value] of Object.entries(DEFAULT_GLOBAL_STATE)) {
      const key = keyBase as keyof GlobalState;

      if ((await this.getGlobalState(key)) === undefined) {
        await this.updateGlobalState(key, value);
      }
    }

    for (const [keyBase, value] of Object.entries(DEFAULT_WORKSPACE_STATE)) {
      const key = keyBase as keyof WorkspaceState;

      if ((await this.getWorkspaceState(key)) === undefined) {
        await this.updateWorkspaceState(key, value);
      }
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
  registerWebview(webview: vscode.Webview) {
    this.webviews.add(webview);
  }

  /**
   * Un-registers a webview from receiving state change notifications.
   * @param webview - The webview to unregister
   */
  unregisterWebview(webview: vscode.Webview) {
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
   * Updates a value in the global state and notifies all webviews.
   * @param key - The key to update in the global state
   * @param value - The new value to set
   */
  async updateGlobalState<K extends keyof GlobalState>(
    key: K,
    value: GlobalState[K]
  ): Promise<void> {
    await this.globalState.update(key, value);

    this.notifyWebviews({
      type: "stateChange",
      payload: {
        scope: "global",
        key,
        value,
      },
    });
  }

  /**
   * Updates a value in the workspace state and notifies all webviews.
   * @param key - The key to update in the workspace state
   * @param value - The new value to set
   */
  async updateWorkspaceState<K extends keyof WorkspaceState>(
    key: K,
    value: WorkspaceState[K]
  ): Promise<void> {
    await this.workspaceState.update(key, value);

    this.notifyWebviews({
      type: "stateChange",
      payload: {
        scope: "workspace",
        key,
        value,
      },
    });
  }

  /**
   * Retrieves a value from the global state.
   * @param key - The key to retrieve from the global state
   * @template K - The type of the key in GlobalState
   * @returns The value associated with the key, or undefined if not found
   */
  async getGlobalState<K extends keyof GlobalState>(
    key: K
  ): Promise<GlobalState[K] | undefined> {
    return this.globalState.get<GlobalState[K]>(key);
  }

  /**
   * Retrieves a value from the workspace state.
   * @param key - The key to retrieve from the workspace state
   * @template K - The type of the key in WorkspaceState
   * @returns The value associated with the key, or undefined if not found
   */
  async getWorkspaceState<K extends keyof WorkspaceState>(
    key: K
  ): Promise<WorkspaceState[K] | undefined> {
    return this.workspaceState.get<WorkspaceState[K]>(key);
  }

  /**
   * Clears all state from both global and workspace storage.
   */
  private async clearAllState(): Promise<void> {
    for (const key of Object.keys(DEFAULT_GLOBAL_STATE)) {
      await this.globalState.update(key, undefined);
    }

    for (const key of Object.keys(DEFAULT_WORKSPACE_STATE)) {
      await this.workspaceState.update(key, undefined);
    }
  }

  /**
   * Disposes of the StateManager singleton instance and clears all state.
   */
  async dispose(): Promise<void> {
    await this.clearAllState();
    StateManager.instance = null;
  }
}
