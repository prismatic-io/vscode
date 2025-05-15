export interface ExecutionResultsState {
  dummy: string;
  filters: {
    type: string;
  };
}

export interface ExecutionResultsExampleMessage {
  type: "executionResults.example";
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
  | ExecutionResultsExampleMessage
  | ExecutionResultsErrorMessage;
