import type { MessageType } from "@type/messages";
import type { GlobalState, WorkspaceState } from "@type/state";
import { produce } from "immer";
import type * as vscode from "vscode";
import { CONFIG } from "../../config";

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
  public notifyWebviews(message: MessageType) {
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
   * Disposes of the StateManager singleton instance and clears all state.
   */
  public async dispose(): Promise<void> {
    await this.clearAllState();
    StateManager.instance = null;
  }
}
