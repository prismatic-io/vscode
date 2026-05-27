import type {
  BatchExecutionSnapshot,
  ExecutionBatchNode,
} from "@/extension/executionResults/types";

export interface BatchProgressSetExecutionMessage {
  type: "batchProgress.setExecution";
  payload: { executionId: string };
}

export interface BatchProgressUpdateMessage {
  type: "batchProgress.update";
  payload: {
    executionId: string;
    snapshot: BatchExecutionSnapshot | null;
    batches: ExecutionBatchNode[];
    totalCount: number;
    hasMore: boolean;
    loading: boolean;
  };
}

export interface BatchProgressRequestUpdateMessage {
  type: "batchProgress.requestUpdate";
  payload: { executionId: string };
}

export interface BatchProgressLoadMoreMessage {
  type: "batchProgress.loadMore";
  payload: { executionId: string };
}

export interface BatchProgressCancelMessage {
  type: "batchProgress.cancel";
  payload: { executionId: string };
}

export interface BatchProgressOpenBatchLogsMessage {
  type: "batchProgress.openBatchLogs";
  payload: { executionId: string; batchExecutionId: string };
}

export type BatchProgressMessage =
  | BatchProgressSetExecutionMessage
  | BatchProgressUpdateMessage
  | BatchProgressRequestUpdateMessage
  | BatchProgressLoadMoreMessage
  | BatchProgressCancelMessage
  | BatchProgressOpenBatchLogsMessage;
