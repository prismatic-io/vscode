export interface ExecutionResultsErrorMessage {
  type: "executionResults.error";
  payload: {
    message: string;
    code?: number;
  };
}

export interface ExecutionResultsRefetchMessage {
  type: "executionResults.refetch";
  payload: string;
}

export type ExecutionResultsMessage =
  | ExecutionResultsErrorMessage
  | ExecutionResultsRefetchMessage;

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

export interface StepResultMeta {
  id: string;
  resultsMetadataUrl: string;
  resultsUrl: string;
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

export interface StepLogsAndOutputsCache {
  output: { data: unknown; message: string | null } | null;
  logs: ExecutionLogs | null;
}

export interface ExecutionResult {
  id: string;
  invokeType: InstanceExecutionResultInvokeType | null;
  startedAt: string;
  resultType: InstanceExecutionResultResultType | null;
  endedAt: string | null;
  error: string | null;
  stepResults: StepResult[];
}

export type ExecutionResults = (Omit<ExecutionResult, "stepResults"> & {
  stepResults: StepResult[];
})[];

export interface ExecutionLog {
  id: string;
  message: string;
  requiredConfigVariableKey: string | null;
  severity: LogSeverityLevel;
  stepName: string | null;
  timestamp: string;
  fromPreprocessFlow: boolean | null;
}

export type ExecutionLogs = ExecutionLog[];

export type SvgProps = {
  color?: string;
  size?: string | number;
} & React.SVGProps<SVGElement>;
