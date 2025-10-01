import type { FlowPayload } from "@/types/flows";

export const SPECTRAL_DIR = ".spectral";

export const FLOW_DIR = "flows";

export const FLOW_PAYLOADS_DIR = "payloads";

export const DEFAULT_PAYLOAD: FlowPayload = {
  headers: {
    "prismatic-debug": "false",
  },
  data: {},
  contentType: "application/json",
};
