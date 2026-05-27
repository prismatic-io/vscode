import { decode } from "@msgpack/msgpack";
import { isValid } from "date-fns";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLResponse } from "@/types/graphql";
import CANCEL_BATCH_EXECUTION_PROCESSING from "./cancelBatchExecutionProcessing.graphql";
import GET_BATCH_DETAIL from "./getBatchDetail.graphql";
import GET_BATCH_SNAPSHOT from "./getBatchSnapshot.graphql";
import GET_EXECUTION_LOGS from "./getExecutionLogs.graphql";
import GET_EXECUTION_RESULTS from "./getExecutionResults.graphql";
import GET_STEP_RESULT_META from "./getStepResultMeta.graphql";
import type {
  BatchExecutionSnapshot,
  BatchNodeStatus,
  BatchProgress,
  ConcurrencyLimitSource,
  ExecutionBatchesResult,
  ExecutionBatchNode,
  ExecutionLog,
  ExecutionResult,
  InstanceExecutionResultInvokeType,
  InstanceExecutionResultResultType,
  LogSeverityLevel,
  StepResult,
} from "./types";

export const MAX_STEP_OUTPUT_PREVIEW_SIZE = 1048576;

export interface ApiCredentials {
  accessToken: string;
  prismaticUrl: string;
}

type GraphQLBatchProgress = {
  discovered: number | null;
  total: number | null;
  queued: number | null;
  running: number | null;
  completed: number | null;
  failed: number | null;
  canceled: number | null;
  discoveryComplete: boolean | null;
  concurrencyLimit: number | null;
  concurrencyLimitSource: ConcurrencyLimitSource | null;
};

type GraphQLBatchedExecutionFields = {
  status: string | null;
  usesBatching: boolean | null;
  cancelRequestedAt: string | null;
  canceledBy: { id: string; email: string | null } | null;
  registeredBatchCount: number | null;
  triggerResolverBatchSize: number | null;
  batchProgress: GraphQLBatchProgress | null;
};

type GetExecutionResultsQuery = {
  executionResults: {
    nodes: ({
      id: string;
      invokeType: InstanceExecutionResultInvokeType | null;
      startedAt: string;
      resultType: InstanceExecutionResultResultType | null;
      endedAt: string | null;
      error: string | null;
      stepResults: {
        nodes: ({
          id: string;
          startedAt: string;
          endedAt: string | null;
          stepName: string | null;
          displayStepName: string | null;
          hasError: boolean;
          resultsMetadataUrl: string;
          resultsUrl: string;
        } | null)[];
      };
    } & Partial<GraphQLBatchedExecutionFields> | null)[];
  };
};

const adaptBatchProgress = (
  raw: GraphQLBatchProgress | null | undefined,
): BatchProgress | null => {
  if (!raw) return null;
  return {
    discovered: raw.discovered ?? 0,
    discoveryComplete: raw.discoveryComplete ?? false,
    completed: raw.completed ?? 0,
    failed: raw.failed ?? 0,
    canceled: raw.canceled ?? 0,
    queued: raw.queued ?? 0,
    running: raw.running ?? 0,
    total: raw.total ?? 0,
    concurrencyLimit: raw.concurrencyLimit ?? null,
    concurrencyLimitSource: raw.concurrencyLimitSource ?? null,
  };
};

export interface FetchExecutionResultsInput extends ApiCredentials {
  flowId: string;
  startedDate: string;
  endedDate: string;
  limit: number;
}

export const fetchExecutionResults = async (
  input: FetchExecutionResultsInput,
): Promise<ExecutionResult[]> => {
  const response = await fetcher<GetExecutionResultsQuery, typeof input>(
    GET_EXECUTION_RESULTS,
    input,
  );

  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }

  const results: ExecutionResult[] = [];
  for (const node of response.data.executionResults?.nodes ?? []) {
    if (!node) continue;

    const stepResults: StepResult[] = [];
    for (const step of node.stepResults?.nodes ?? []) {
      if (!step) continue;
      stepResults.push(step);
    }

    results.push({
      id: node.id,
      invokeType: node.invokeType,
      startedAt: node.startedAt,
      resultType: node.resultType,
      status: node.status ?? null,
      endedAt: node.endedAt,
      error: node.error,
      stepResults,
      usesBatching: node.usesBatching ?? null,
      batchProgress: adaptBatchProgress(node.batchProgress),
      cancelRequestedAt: node.cancelRequestedAt ?? null,
      canceledBy: node.canceledBy ?? null,
      registeredBatchCount: node.registeredBatchCount ?? null,
      triggerResolverBatchSize: node.triggerResolverBatchSize ?? null,
    });
  }

  return results;
};

// Batched execution support ---------------------------------------------

type GetBatchSnapshotQuery = {
  executionResult:
    | (GraphQLBatchedExecutionFields & {
        id: string;
      })
    | null;
};

export interface FetchBatchSnapshotInput extends ApiCredentials {
  executionId: string;
}

export const fetchBatchSnapshot = async (
  input: FetchBatchSnapshotInput,
): Promise<BatchExecutionSnapshot | null> => {
  const response = await fetcher<
    GetBatchSnapshotQuery,
    { id: string } & ApiCredentials
  >(GET_BATCH_SNAPSHOT, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    id: input.executionId,
  });

  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }

  const node = response.data.executionResult;
  if (!node) return null;

  return {
    id: node.id,
    usesBatching: node.usesBatching ?? null,
    status: node.status ?? null,
    cancelRequestedAt: node.cancelRequestedAt ?? null,
    canceledBy: node.canceledBy ?? null,
    registeredBatchCount: node.registeredBatchCount ?? null,
    triggerResolverBatchSize: node.triggerResolverBatchSize ?? null,
    batchProgress: adaptBatchProgress(node.batchProgress),
  };
};

type RawBatchNode = {
  id: string;
  key: string | null;
  displayKey: string | null;
  status: string;
  role: "PROCESSING" | "DISCOVERY" | string;
  recordCount: number | null;
  stepCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  discoveredBy: { id: string } | null;
};

type GetBatchDetailQuery = {
  executionResult: {
    id: string;
    executionBatches: {
      totalCount: number;
      nodes: (RawBatchNode | null)[];
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    } | null;
  } | null;
};

const GLOBAL_ID_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

export const shortIdFromGlobalId = (globalId: string): string => {
  try {
    const decoded = atob(globalId);
    const parts = decoded.split(":");
    const last = parts[parts.length - 1];
    if (last) return last.replace(/-/g, "").slice(-6);
  } catch {
    // not a base64-encoded global id
  }
  if (GLOBAL_ID_PATTERN.test(globalId)) {
    return globalId.replace(/-/g, "").slice(-6);
  }
  return globalId.slice(-6);
};

export const toBatchNodeStatus = (
  apiStatus: string,
  startedAt: string | null,
  completedAt: string | null,
): BatchNodeStatus => {
  const upper = apiStatus.toUpperCase();
  if (upper === "COMPLETED") return "success";
  if (upper === "FAILED") return "fail";
  if (completedAt) return "success";
  if (startedAt) return "running";
  return "queued";
};

export const adaptBatchNode = (
  node: RawBatchNode,
  index: number,
): ExecutionBatchNode => {
  const recordCount = node.recordCount ?? 1;
  const stepCount = node.stepCount ?? 0;
  const ordinalLabel = `batch-${String(index + 1).padStart(4, "0")}`;
  const displayKey =
    node.displayKey && node.displayKey.length > 0
      ? node.displayKey
      : node.key && node.key.length > 0
        ? node.key
        : node.id
          ? shortIdFromGlobalId(node.id)
          : ordinalLabel;
  return {
    id: node.id,
    displayKey,
    role: node.role === "DISCOVERY" ? "discovery" : "processing",
    status: toBatchNodeStatus(node.status, node.startedAt, node.completedAt),
    recordCount,
    stepCount,
    errorMessage: node.errorMessage,
    startedAt: node.startedAt,
    completedAt: node.completedAt,
    label: recordCount === 1 ? "1 record" : `${recordCount} records`,
  };
};

export interface FetchBatchDetailInput extends ApiCredentials {
  executionId: string;
  after?: string | null;
  status?: string | null;
  role?: string | null;
  discoveredBy?: string | null;
}

export const fetchBatchDetail = async (
  input: FetchBatchDetailInput,
): Promise<ExecutionBatchesResult> => {
  const response = await fetcher<
    GetBatchDetailQuery,
    {
      id: string;
      after: string | null;
      status: string | null;
      role: string | null;
      discoveredBy: string | null;
    } & ApiCredentials
  >(GET_BATCH_DETAIL, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    id: input.executionId,
    after: input.after ?? null,
    status: input.status ?? null,
    role: input.role ?? null,
    discoveredBy: input.discoveredBy ?? null,
  });

  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }

  const connection = response.data.executionResult?.executionBatches;
  if (!connection) {
    return { nodes: [], endCursor: null, hasNextPage: false, totalCount: 0 };
  }

  const adapted: ExecutionBatchNode[] = [];
  let i = 0;
  for (const raw of connection.nodes) {
    if (!raw) continue;
    adapted.push(adaptBatchNode(raw, i));
    i++;
  }

  return {
    nodes: adapted,
    endCursor: connection.pageInfo.endCursor ?? null,
    hasNextPage: connection.pageInfo.hasNextPage ?? false,
    totalCount: connection.totalCount ?? 0,
  };
};

type CancelBatchExecutionMutation = {
  cancelBatchExecutionProcessing: {
    errors: { field: string; messages: string[] }[] | null;
    instanceExecutionResult: {
      id: string;
      status: string | null;
      cancelRequestedAt: string | null;
      canceledBy: { id: string } | null;
    } | null;
  } | null;
};

export interface CancelBatchExecutionInput extends ApiCredentials {
  executionId: string;
}

export const cancelBatchExecution = async (
  input: CancelBatchExecutionInput,
): Promise<{ id: string }> => {
  const response = await fetcher<
    CancelBatchExecutionMutation,
    { executionId: string } & ApiCredentials
  >(CANCEL_BATCH_EXECUTION_PROCESSING, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    executionId: input.executionId,
  });

  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }

  const payload = response.data.cancelBatchExecutionProcessing;
  const errors = payload?.errors ?? [];
  if (errors.length > 0) {
    const first = errors[0];
    const message = first.messages.join("; ");
    throw new Error(message || `Cancel failed (field: ${first.field})`);
  }

  const result = payload?.instanceExecutionResult;
  if (!result) {
    throw new Error("Cancel mutation returned no execution result");
  }
  return { id: result.id };
};

type GetExecutionLogsQuery = {
  logs: {
    nodes: (ExecutionLog | null)[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
};

export interface FetchExecutionLogsInput extends ApiCredentials {
  executionId: string;
  startedDate: string;
}

interface LogsPageVariables extends FetchExecutionLogsInput {
  after: string | null;
}

export const fetchExecutionLogs = async (
  input: FetchExecutionLogsInput,
): Promise<ExecutionLog[]> => {
  const out: ExecutionLog[] = [];
  let after: string | null = null;

  while (true) {
    const response: GraphQLResponse<GetExecutionLogsQuery> = await fetcher<
      GetExecutionLogsQuery,
      LogsPageVariables
    >(GET_EXECUTION_LOGS, { ...input, after });

    if (response.errors?.length) {
      throw new Error(response.errors[0].message);
    }

    for (const node of response.data.logs.nodes) {
      if (!node) continue;
      out.push(node);
    }

    if (!response.data.logs.pageInfo.hasNextPage) break;
    after = response.data.logs.pageInfo.endCursor;
  }

  return out;
};

type GetStepResultMetaQuery = {
  stepResults: {
    nodes: ({
      id: string;
      resultsMetadataUrl: string;
      resultsUrl: string;
    } | null)[];
  };
};

export interface FetchStepResultMetaInput extends ApiCredentials {
  executionId: string;
  stepId: string;
  startedAt: string;
  endedAt: string | null;
}

export interface StepResultMeta {
  id: string;
  resultsMetadataUrl: string;
  resultsUrl: string;
}

export const fetchStepResultMeta = async (
  input: FetchStepResultMetaInput,
): Promise<StepResultMeta | null> => {
  const response = await fetcher<GetStepResultMetaQuery, typeof input>(
    GET_STEP_RESULT_META,
    input,
  );

  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }

  const match = response.data.stepResults.nodes.find(
    (node) => node?.id === input.stepId,
  );

  return match
    ? {
        id: match.id,
        resultsMetadataUrl: match.resultsMetadataUrl,
        resultsUrl: match.resultsUrl,
      }
    : null;
};

export interface StepOutput {
  data: unknown;
  message: string | null;
}

export interface FetchStepOutputInput {
  resultsMetadataUrl: string;
  resultsUrl: string;
  responseType?: "json" | "msgpack";
}

export const fetchStepOutput = async (
  input: FetchStepOutputInput,
): Promise<StepOutput> => {
  const metaResponse = await fetch(input.resultsMetadataUrl, {
    method: "HEAD",
  });

  if (metaResponse.status === 403) {
    throw new Error("Access to step outputs is forbidden (403)");
  }

  if (!metaResponse.ok) {
    return {
      data: "<Unable to load preview>",
      message: `HEAD request failed (${metaResponse.status})`,
    };
  }

  const rawContentLength = metaResponse.headers.get("content-length");
  const contentLength = Number(rawContentLength);

  if (!rawContentLength || !contentLength) {
    return {
      data: "<Unable to load preview>",
      message: `Invalid content-length header: ${rawContentLength}`,
    };
  }

  if (contentLength > MAX_STEP_OUTPUT_PREVIEW_SIZE) {
    return {
      data: `<data (${contentLength} bytes)>`,
      message: `Output exceeds ${MAX_STEP_OUTPUT_PREVIEW_SIZE} byte preview limit (${contentLength} bytes)`,
    };
  }

  const response = await fetch(input.resultsUrl, { method: "GET" });

  if (response.status === 403) {
    throw new Error("Access to step outputs is forbidden (403)");
  }

  if (!response.ok) {
    return {
      data: "<Unable to load preview>",
      message: `GET request failed (${response.status})`,
    };
  }

  const decoded =
    input.responseType === "json"
      ? await response.json()
      : decode(new Uint8Array(await response.arrayBuffer()));

  const normalized = transformStepOutput(decoded);

  return {
    data:
      normalized instanceof Object && "data" in normalized
        ? (normalized as { data: unknown }).data
        : normalized,
    message: null,
  };
};

interface DeserializedValue {
  data: unknown;
  contentType?: string;
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const dataUri = (bytes: Uint8Array, contentType: string): string =>
  `data:${contentType};base64,${toBase64(bytes)}`;

export const transformStepOutput = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(transformStepOutput);
  }

  if (value instanceof Object && "data" in value) {
    const { data, contentType } = value as DeserializedValue;

    if (data instanceof Uint8Array) {
      return contentType?.startsWith("image")
        ? dataUri(data, contentType)
        : `<data (${data.byteLength} bytes)>`;
    }
  }

  if (value instanceof Object) {
    if (isValid(value)) {
      return (value as Date).toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, transformStepOutput(v)]),
    );
  }

  return value;
};

export type { LogSeverityLevel };
