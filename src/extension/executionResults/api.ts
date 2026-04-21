import { decode } from "@msgpack/msgpack";
import { isValid } from "date-fns";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLResponse } from "@/types/graphql";
import type {
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

const GET_EXECUTION_RESULTS = `
  query getExecutionResults(
    $cursor: String
    $endedDate: DateTime
    $flowId: ID
    $limit: Int
    $startedDate: DateTime
  ) {
    executionResults(
      after: $cursor
      first: $limit
      flowConfig_Flow: $flowId
      orderBy: { field: STARTED_AT, direction: DESC }
      startedAt_Gte: $startedDate
      startedAt_Lte: $endedDate
    ) {
      nodes {
        id
        invokeType
        startedAt
        resultType
        endedAt
        error
        stepResults(first: 10, orderBy: { field: STARTED_AT, direction: ASC }) {
          nodes {
            id
            startedAt
            endedAt
            stepName
            displayStepName
            hasError
            resultsMetadataUrl
            resultsUrl
          }
        }
      }
    }
  }
`;

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
    } | null)[];
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
      endedAt: node.endedAt,
      error: node.error,
      stepResults,
    });
  }

  return results;
};

const GET_EXECUTION_LOGS = `
  query getExecutionLogs(
    $after: String
    $executionId: ID!
    $startedDate: DateTime
  ) {
    logs(
      after: $after
      executionResult: $executionId
      first: 100
      orderBy: { direction: ASC, field: TIMESTAMP }
      timestamp_Gte: $startedDate
    ) {
      nodes {
        id
        message
        requiredConfigVariableKey
        severity
        stepName
        timestamp
        fromPreprocessFlow
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

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

const GET_STEP_RESULT_META = `
  query GetStepResultMeta(
    $executionId: ID!
    $startedAt: DateTime
    $endedAt: DateTime
  ) {
    stepResults(
      startedAt_Gte: $startedAt
      endedAt_Gte: $endedAt
      executionResult: $executionId
    ) {
      nodes {
        id
        endedAt
        startedAt
        resultsMetadataUrl
        resultsUrl
      }
    }
  }
`;

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
