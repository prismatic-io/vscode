export enum InstanceExecutionResultInvokeType {
  CROSS_FLOW = "CROSS_FLOW",
  DEPLOY_FLOW = "DEPLOY_FLOW",
  INTEGRATION_ENDPOINT_TEST = "INTEGRATION_ENDPOINT_TEST",
  INTEGRATION_FLOW_TEST = "INTEGRATION_FLOW_TEST",
  SCHEDULED = "SCHEDULED",
  TEAR_DOWN_FLOW = "TEAR_DOWN_FLOW",
  WEBHOOK = "WEBHOOK",
}

export enum InstanceExecutionResultResultType {
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
  POLLED_NO_CHANGES = "POLLED_NO_CHANGES",
}

export enum LogSeverityLevel {
  DEBUG = "DEBUG",
  ERROR = "ERROR",
  FATAL = "FATAL",
  INFO = "INFO",
  METRIC = "METRIC",
  TRACE = "TRACE",
  WARN = "WARN",
}

export interface StepResult {
  id: string;
  startedAt: string;
  endedAt: string | null;
  stepName: string | null;
  displayStepName: string | null;
  hasError: boolean;
  resultsMetadataUrl: string;
  resultsUrl: string;
}

export interface ExecutionResult {
  id: string;
  invokeType: InstanceExecutionResultInvokeType | null;
  startedAt: string;
  resultType: InstanceExecutionResultResultType | null;
  endedAt: string | null;
  error: string | null;
  stepResults: StepResult[];
  // Batched executions fan out across ExecutionBatches; their step results
  // hang off each batch rather than the execution itself.
  usesBatching: boolean;
  batchProgress: BatchProgress | null;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
}

export enum ExecutionBatchStatus {
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface ExecutionBatch {
  id: string;
  status: ExecutionBatchStatus;
  recordCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ExecutionBatchList {
  batches: ExecutionBatch[];
  totalCount: number;
}

export interface ExecutionLog {
  message: string;
  severity: LogSeverityLevel;
  stepName: string | null;
  timestamp: string;
}

export const isExecutionTerminal = (result: ExecutionResult): boolean =>
  result.endedAt !== null;

export const isBatchTerminal = (batch: ExecutionBatch): boolean =>
  batch.completedAt !== null;
