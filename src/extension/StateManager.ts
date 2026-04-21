import type { MessageType } from "@type/messages";
import {
  type GlobalState,
  GlobalStateSchema,
  type WorkspaceState,
  WorkspaceStateSchema,
} from "@type/state";
import * as vscode from "vscode";

const GLOBAL_STATE_KEY = "prismatic-global-state";
const WORKSPACE_STATE_KEY = "prismatic-workspace-state";

export class StateManager {
  private context: vscode.ExtensionContext;
  private webviews: Set<vscode.Webview> = new Set();
  private readonly _onDidChangeWorkspaceState = new vscode.EventEmitter<void>();
  readonly onDidChangeWorkspaceState = this._onDidChangeWorkspaceState.event;
  private readonly _onDidChangeGlobalState = new vscode.EventEmitter<void>();
  readonly onDidChangeGlobalState = this._onDidChangeGlobalState.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    context.subscriptions.push(
      this._onDidChangeWorkspaceState,
      this._onDidChangeGlobalState,
    );
  }

  private get globalState(): vscode.Memento {
    return this.context.globalState;
  }

  private get workspaceState(): vscode.Memento {
    return this.context.workspaceState;
  }

  public registerWebview(webview: vscode.Webview) {
    this.webviews.add(webview);
  }

  public unregisterWebview(webview: vscode.Webview) {
    this.webviews.delete(webview);
  }

  public notifyWebviews(message: MessageType) {
    for (const webview of this.webviews) {
      webview.postMessage(message);
    }
  }

  public async updateGlobalState(
    incomingValue: Partial<GlobalState>,
  ): Promise<void> {
    const currentState = await this.getGlobalState();
    const updatedState = GlobalStateSchema.parse({
      ...currentState,
      ...incomingValue,
    });

    await this.globalState.update(GLOBAL_STATE_KEY, updatedState);

    this.notifyWebviews({
      type: "stateChange",
      payload: { scope: "global", value: updatedState },
    });
    this._onDidChangeGlobalState.fire();
  }

  public async updateWorkspaceState(
    incomingValue: Partial<WorkspaceState>,
  ): Promise<void> {
    const currentState = await this.getWorkspaceState();
    const updatedState = WorkspaceStateSchema.parse({
      ...currentState,
      ...incomingValue,
    });

    await this.workspaceState.update(WORKSPACE_STATE_KEY, updatedState);

    this.notifyWebviews({
      type: "stateChange",
      payload: { scope: "workspace", value: updatedState },
    });
    this._onDidChangeWorkspaceState.fire();
  }

  public async getGlobalState(): Promise<GlobalState> {
    return GlobalStateSchema.parse(
      this.globalState.get(GLOBAL_STATE_KEY) ?? {},
    );
  }

  async getWorkspaceState(): Promise<WorkspaceState> {
    return WorkspaceStateSchema.parse(
      this.workspaceState.get(WORKSPACE_STATE_KEY) ?? {},
    );
  }

  getWorkspaceStateSync(): WorkspaceState {
    return WorkspaceStateSchema.parse(
      this.workspaceState.get(WORKSPACE_STATE_KEY) ?? {},
    );
  }

  public async switchActiveIntegration(integrationPath: string): Promise<void> {
    await this.updateWorkspaceState({
      activeIntegrationPath: integrationPath,
      integrationId: undefined,
      systemInstanceId: undefined,
      flow: undefined,
      headers: undefined,
      payload: undefined,
      debugMode: undefined,
      configState: undefined,
      flows: undefined,
      connections: undefined,
    });
  }

  private async clearAllState(): Promise<void> {
    await this.globalState.update(GLOBAL_STATE_KEY, undefined);
    await this.workspaceState.update(WORKSPACE_STATE_KEY, undefined);
  }

  public async dispose(): Promise<void> {
    await this.clearAllState();
  }
}
