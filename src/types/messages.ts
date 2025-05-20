import type { WorkspaceState, GlobalState } from "@type/state";
import type { ConfigWizardMessage } from "@webview/views/configWizard/types";
import type { ExecutionResultsMessage } from "@webview/views/executionResults/types";
import type { SettingsMessage } from "@webview/views/settings/types";

export type MessageHandlerManager = (message: MessageType) => void;

export interface StateChangeMessage {
  type: "stateChange";
  payload:
    | {
        scope: "global";
        key: keyof GlobalState;
        value: GlobalState[keyof GlobalState];
        error?: string;
      }
    | {
        scope: "workspace";
        key: keyof WorkspaceState;
        value: WorkspaceState[keyof WorkspaceState];
        error?: string;
      };
}

export interface GetStateMessage {
  type: "getState";
  payload:
    | {
        scope: "global";
        key: keyof GlobalState;
        value?: GlobalState[keyof GlobalState];
        error?: string;
      }
    | {
        scope: "workspace";
        key: keyof WorkspaceState;
        value?: WorkspaceState[keyof WorkspaceState];
        error?: string;
      };
}

export type MessageType =
  | StateChangeMessage
  | GetStateMessage
  | ExecutionResultsMessage
  | SettingsMessage
  | ConfigWizardMessage;

export interface WebviewApi {
  postMessage(message: MessageType): void;
}
