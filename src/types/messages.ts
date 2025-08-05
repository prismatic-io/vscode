import type { WorkspaceState, GlobalState } from "@type/state";
import type { ConfigWizardMessage } from "@webview/views/configWizard/types";
import type { ExecutionResultsMessage } from "@webview/views/executionResults/types";
import type { ExampleMessage } from "@/webview/views/_example/types";

export type MessageHandlerManager = (message: MessageType) => void;

export interface StateChangeMessage {
  type: "stateChange";
  payload:
    | {
        scope: "global";
        value: Partial<GlobalState>;
        error?: string;
      }
    | {
        scope: "workspace";
        value: Partial<WorkspaceState>;
        error?: string;
      };
}

export interface GetStateMessage {
  type: "getState";
  payload:
    | {
        scope: "global";
        value?: GlobalState;
        error?: string;
      }
    | {
        scope: "workspace";
        value?: WorkspaceState;
        error?: string;
      };
}

export type MessageType =
  | StateChangeMessage
  | GetStateMessage
  | ExecutionResultsMessage
  | ExampleMessage
  | ConfigWizardMessage;

export interface WebviewApi {
  postMessage(message: MessageType): void;
}
