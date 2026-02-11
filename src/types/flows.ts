export interface FlowPayload {
  headers: Record<string, string> | [];
  data: Record<string, unknown> | string;
  contentType: "application/json" | "application/xml" | "application/csv";
}

export interface Flow {
  id: string;
  name: string;
  stableKey: string;
  isSynchronous: boolean;
  usesFifoQueue: boolean;
  endpointSecurityType: string;
  testUrl: string;
}
