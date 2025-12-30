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

export type IntegrationDetailsMessage =
  | IntegrationDetailsRefreshMessage
  | IntegrationDetailsErrorMessage
  | IntegrationDetailsAuthenticateMessage;
