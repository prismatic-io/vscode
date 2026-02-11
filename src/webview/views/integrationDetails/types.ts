import type { Flow } from "@/types/flows";

export interface IntegrationDetailsRefreshMessage {
  type: "integrationDetails.refresh";
  payload: string;
}

export interface IntegrationDetailsErrorMessage {
  type: "integrationDetails.error";
  payload: {
    message: string;
    code?: number;
  };
}

export interface IntegrationDetailsAuthenticateMessage {
  type: "integrationDetails.authenticate";
  payload: {
    connectionId: string;
    authorizationUrl: string;
  };
}

export interface IntegrationDetailsFlowsLoadedMessage {
  type: "integrationDetails.flowsLoaded";
  payload: {
    flows: Flow[];
  };
}

export type IntegrationDetailsMessage =
  | IntegrationDetailsRefreshMessage
  | IntegrationDetailsErrorMessage
  | IntegrationDetailsAuthenticateMessage
  | IntegrationDetailsFlowsLoadedMessage;
