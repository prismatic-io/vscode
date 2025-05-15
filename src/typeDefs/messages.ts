import type { WorkspaceState, GlobalState } from "@/typeDefs/state";
import type { ConfigWizardMessage } from "@/views/configWizard/types";
import type { ExecutionResultsMessage } from "@/views/executionResults/typeDefs";
import type { SettingsMessage } from "@/views/settings/typeDefs";

export type MessageHandler = (message: MessageType) => void;

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
