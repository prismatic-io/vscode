import type { GlobalState, WorkspaceState } from "@type/state";
import type { ConfigWizardMessage } from "@webview/views/configWizard/types";
import type { IntegrationDetailsMessage } from "@webview/views/integrationDetails/types";

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

export interface RequestAccessTokenMessage {
  type: "requestAccessToken";
  payload: undefined;
}

export interface RequestLoginMessage {
  type: "requestLogin";
  payload: undefined;
}

export interface AccessTokenMessage {
  type: "accessToken";
  payload: { token: string | null };
}

export interface AuthStateChangedMessage {
  type: "authStateChanged";
  payload: undefined;
}

export type MessageType =
  | StateChangeMessage
  | GetStateMessage
  | RequestAccessTokenMessage
  | RequestLoginMessage
  | AccessTokenMessage
  | AuthStateChangedMessage
  | ConfigWizardMessage
  | IntegrationDetailsMessage;

export interface WebviewApi {
  postMessage(message: MessageType): void;
}
