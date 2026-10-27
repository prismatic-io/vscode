import * as vscode from "vscode";

export const LOGS_SCHEME = "prismatic-logs";
export const STEP_SCHEME = "prismatic-step";

// Batch-scoped logs append `@<batchId>`. Ids are base64, so `@` never
// appears in either one and can safely separate them.
export const buildLogsUri = (
  executionId: string,
  batchId: string | null = null,
): vscode.Uri => {
  const batchSuffix = batchId ? `@${encodeURIComponent(batchId)}` : "";
  return vscode.Uri.parse(
    `${LOGS_SCHEME}:/${encodeURIComponent(executionId)}${batchSuffix}.log`,
  );
};

export interface LogsUriParts {
  executionId: string;
  batchId: string | null;
}

export const parseLogsUri = (uri: vscode.Uri): LogsUriParts | null => {
  if (uri.scheme !== LOGS_SCHEME) return null;
  const match = /^\/([^@]+)(?:@([^@]+))?\.log$/.exec(uri.path);
  if (!match) return null;
  return {
    executionId: decodeURIComponent(match[1]),
    batchId: match[2] ? decodeURIComponent(match[2]) : null,
  };
};

export const buildStepUri = (
  executionId: string,
  stepId: string,
  stepName: string | null,
): vscode.Uri => {
  const fileName = (stepName ?? "step").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return vscode.Uri.parse(
    `${STEP_SCHEME}:/${encodeURIComponent(executionId)}/${encodeURIComponent(stepId)}/${fileName}.json`,
  );
};

export interface StepUriParts {
  executionId: string;
  stepId: string;
}

export const parseStepUri = (uri: vscode.Uri): StepUriParts | null => {
  if (uri.scheme !== STEP_SCHEME) return null;
  const match = /^\/([^/]+)\/([^/]+)\/[^/]+\.json$/.exec(uri.path);
  if (!match) return null;
  return {
    executionId: decodeURIComponent(match[1]),
    stepId: decodeURIComponent(match[2]),
  };
};
