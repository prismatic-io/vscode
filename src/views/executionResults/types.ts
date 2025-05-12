export interface ExecutionResultsDummyMessage {
  type: "executionResults.dummy";
  payload: string;
}

export interface ExecutionResultsErrorMessage {
  type: "executionResults.error";
  payload: {
    message: string;
    code?: number;
  };
}

export type ExecutionResultsMessage =
  | ExecutionResultsDummyMessage
  | ExecutionResultsErrorMessage;
