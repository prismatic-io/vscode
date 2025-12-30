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

export type IntegrationDetailsMessage =
  | IntegrationDetailsRefreshMessage
  | IntegrationDetailsErrorMessage;
