export interface FlowPayload {
  headers: Record<string, string> | [];
  data: Record<string, unknown> | string;
  contentType: "application/json" | "application/xml" | "application/csv";
}
