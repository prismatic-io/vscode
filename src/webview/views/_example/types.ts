export interface ExamplePayloadMessage {
  type: "example.payload";
  payload: string;
}

export interface ExampleErrorMessage {
  type: "example.error";
  payload: {
    message: string;
    code?: number;
  };
}

export type ExampleMessage = ExamplePayloadMessage | ExampleErrorMessage;
