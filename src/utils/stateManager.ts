import type * as vscode from "vscode";
import type { ExtensionState } from "@typeDefs/state";

class StateManager {
  private static instance: StateManager | null = null;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static initialize(context: vscode.ExtensionContext): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager(context);
    }

    return StateManager.instance;
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      throw new Error("StateManager not initialized. Call initialize() first.");
    }

    return StateManager.instance;
  }

  static dispose(): void {
    StateManager.instance = null;
  }

  private get globalState(): vscode.Memento {
    return this.context.globalState;
  }

  private get workspaceState(): vscode.Memento {
    return this.context.workspaceState;
  }

  async updateGlobalState<T>(key: string, value: T): Promise<void> {
    await this.globalState.update(key, value);
  }

  async updateWorkspaceState<T>(key: string, value: T): Promise<void> {
    await this.workspaceState.update(key, value);
  }

  async getGlobalState<T>(key: string): Promise<T | undefined> {
    return this.globalState.get<T>(key);
  }

  async getWorkspaceState<T>(key: string): Promise<T | undefined> {
    return this.workspaceState.get<T>(key);
  }
}

export { StateManager };
