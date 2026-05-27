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

export type ExecutionBatchStatus = "COMPLETED" | "FAILED";
export type ExecutionBatchRole = "PROCESSING" | "DISCOVERY";

export type BatchNodeStatus =
  | "success"
  | "fail"
  | "running"
  | "queued"
  | "partial";

export type ConcurrencyLimitSource = "TENANT" | "CUSTOMER" | "FIFO";

export interface BatchProgress {
  discovered: number;
  discoveryComplete: boolean;
  completed: number;
  failed: number;
  canceled: number;
  queued: number;
  running: number;
  total: number;
  concurrencyLimit: number | null;
  concurrencyLimitSource: ConcurrencyLimitSource | null;
}

export type BatchMode = "sequential" | "parallel";
export type BatchOutputMode = "singular" | "batch";
export type BatchDataPattern =
  | "data-in-trigger"
  | "rolling-discovery"
  | "instance-sync";

export interface ResolvedBatchConfig {
  mode: BatchMode;
  outputMode: BatchOutputMode;
  triggerResolverBatchSize: number | null;
  dataPattern: BatchDataPattern;
}

export interface BatchPageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface BatchRecord {
  id: string;
  label: string;
  status: BatchNodeStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface ExecutionBatchNode {
  id: string;
  displayKey: string;
  role: "processing" | "discovery";
  status: BatchNodeStatus;
  recordCount: number;
  stepCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  label: string;
  records?: BatchRecord[];
}

export interface BatchExecutionSnapshot {
  id: string;
  usesBatching: boolean | null;
  status: string | null;
  cancelRequestedAt: string | null;
  canceledBy: { id: string; email: string | null } | null;
  registeredBatchCount: number | null;
  triggerResolverBatchSize: number | null;
  batchProgress: BatchProgress | null;
}

export interface ExecutionBatchesResult {
  nodes: ExecutionBatchNode[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
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
  status: string | null;
  endedAt: string | null;
  error: string | null;
  stepResults: StepResult[];
  usesBatching: boolean | null;
  batchProgress: BatchProgress | null;
  cancelRequestedAt: string | null;
  canceledBy: { id: string; email: string | null } | null;
  registeredBatchCount: number | null;
  triggerResolverBatchSize: number | null;
}

export interface ExecutionLog {
  message: string;
  severity: LogSeverityLevel;
  stepName: string | null;
  timestamp: string;
}

export const isExecutionTerminal = (result: ExecutionResult): boolean =>
  result.endedAt !== null;

export const isExecutionBatched = (result: ExecutionResult): boolean =>
  Boolean(result.usesBatching) || result.batchProgress !== null;
