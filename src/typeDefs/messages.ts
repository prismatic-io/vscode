import type { PrismaticMessage } from "@/views/prismatic/types";
import type { ExecutionResultsMessage } from "@/views/executionResults/types";
import type { ConfigWizardMessage } from "@/views/configWizard/types";

// Base message interface for all communication between webview and VS Code
export interface WebviewMessage {
  type: string;
  payload: unknown;
}

// Message type for state changes between webview and VS Code
export interface StateChangeMessage extends WebviewMessage {
  type: "stateChange";
  payload: {
    scope: "global" | "workspace";
    key: string;
    value: unknown;
  };
}

// Type for message handler functions
export type MessageHandler = (message: WebviewMessage) => void;

// Interface for VS Code's webview communication API
export interface WebviewApi {
  postMessage(message: WebviewMessage): void;
}
