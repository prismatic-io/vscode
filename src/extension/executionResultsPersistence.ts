import * as path from "path";
import { fetcher } from "@/lib/fetcher";
import { FileSystemUtils } from "./fileSystemUtils";
import { log } from "@/extension";
import type { GraphQLVariables } from "@/types/graphql";
import type {
  ExecutionResult,
  StepResult,
  ExecutionLogs,
  LogSeverityLevel,
  InstanceExecutionResultInvokeType,
  InstanceExecutionResultResultType,
} from "@/webview/views/executionResults/types";

interface ExecutionDetailsQuery {
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
}

interface ExecutionLogsQuery {
  logs: {
    nodes: ({
      id: string;
      message: string;
      requiredConfigVariableKey: string | null;
      severity: LogSeverityLevel;
      stepName: string | null;
      timestamp: string;
      fromPreprocessFlow: boolean | null;
    } | null)[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

const GET_EXECUTION_DETAILS = `
  query GetExecutionDetails($executionId: ID!) {
    executionResults(first: 1, id: $executionId) {
      nodes {
        id
        invokeType
        startedAt
        resultType
        endedAt
        error
        stepResults(first: 100, orderBy: { field: STARTED_AT, direction: ASC }) {
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

const GET_EXECUTION_LOGS = `
  query getExecutionLogs(
    $after: String
    $executionId: ID!
    $startDate: DateTime
  ) {
    logs(
      after: $after
      executionResult: $executionId
      first: 100
      orderBy: { direction: ASC, field: TIMESTAMP }
      timestamp_Gte: $startDate
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

interface StepOutputsResult {
  data: unknown;
  message: string | null;
}

export class ExecutionResultsPersistence {
  static async saveExecutionResults(
    executionId: string,
    accessToken: string,
    prismaticUrl: string
  ): Promise<void> {
    try {
      log("INFO", `Saving execution results for execution: ${executionId}`);

      // Create execution directory
      const executionDir = await FileSystemUtils.createExecutionDirectory(executionId);

      // Fetch execution details
      const executionDetails = await this.fetchExecutionDetails(
        executionId,
        accessToken,
        prismaticUrl
      );

      if (!executionDetails) {
        throw new Error("Execution not found");
      }

      // Fetch execution logs
      const executionLogs = await this.fetchExecutionLogs(
        executionId,
        executionDetails.startedAt,
        accessToken,
        prismaticUrl
      );

      // Save execution metadata
      await this.saveExecutionMetadata(executionDir, executionDetails, executionLogs);

      // Save each step's results
      for (const stepResult of executionDetails.stepResults) {
        await this.saveStepResults(executionDir, stepResult, executionLogs, accessToken, prismaticUrl);
      }
      log("SUCCESS", `Execution results saved to ${executionDir}`);
    } catch (error) {
      console.error("Error in saveExecutionResults:", error);
      log("ERROR", `Failed to save execution results: ${error}`);
    }
  }

  private static async fetchExecutionDetails(
    executionId: string,
    accessToken: string,
    prismaticUrl: string
  ): Promise<ExecutionResult | null> {
    const response = await fetcher<ExecutionDetailsQuery, GraphQLVariables<{ executionId: string }>>(
      GET_EXECUTION_DETAILS,
      {
        executionId,
        accessToken,
        prismaticUrl,
      }
    );

    if (response.errors) {
      throw new Error(response.errors[0].message);
    }

    const executionResult = response.data.executionResults.nodes[0];
    if (!executionResult) {
      return null;
    }

    const stepResults = executionResult.stepResults.nodes.filter(Boolean) as StepResult[];

    return {
      ...executionResult,
      stepResults,
    };
  }

  private static async fetchExecutionLogs(
    executionId: string,
    startDate: string,
    accessToken: string,
    prismaticUrl: string
  ): Promise<ExecutionLogs> {
    const logs: ExecutionLogs = [];
    let hasNextPage = true;
    let after: string | null = null;

    do {
      const response: any = await fetcher<ExecutionLogsQuery, GraphQLVariables<{
        after: string | null;
        executionId: string;
        startDate: string;
      }>>(
        GET_EXECUTION_LOGS,
        {
          after,
          executionId,
          startDate,
          accessToken,
          prismaticUrl,
        }
      );

      if (response.errors?.length) {
        throw new Error(response.errors[0].message);
      }

      const pageLogs = response.data.logs.nodes.filter(Boolean) as ExecutionLogs;
      logs.push(...pageLogs);

      after = response.data.logs.pageInfo.endCursor;
      hasNextPage = response.data.logs.pageInfo.hasNextPage;
    } while (hasNextPage);

    return logs;
  }

  private static async saveExecutionMetadata(
    executionDir: string,
    executionDetails: ExecutionResult,
    logs: ExecutionLogs
  ): Promise<void> {
    const metadata = {
      execution: {
        id: executionDetails.id,
        invokeType: executionDetails.invokeType,
        startedAt: executionDetails.startedAt,
        endedAt: executionDetails.endedAt,
        resultType: executionDetails.resultType,
        error: executionDetails.error,
      },
      stepCount: executionDetails.stepResults.length,
      logCount: logs.length,
      savedAt: new Date().toISOString(),
    };

    const metadataPath = path.join(executionDir, "execution-metadata.json");
    await FileSystemUtils.writeJsonFile(metadataPath, metadata);
  }

  private static async saveStepResults(
    executionDir: string,
    stepResult: StepResult,
    logs: ExecutionLogs,
    accessToken: string,
    prismaticUrl: string
  ): Promise<void> {
    const stepName = stepResult.stepName || stepResult.displayStepName || stepResult.id;
    const fileName = FileSystemUtils.getStepFileName(stepName);
    const filePath = path.join(executionDir, fileName);

    // Get step-specific logs
    const stepLogs = logs.filter(log => log.stepName === stepResult.stepName);

    // Fetch step outputs
    let stepOutputs: StepOutputsResult = {
      data: null,
      message: "No outputs available"
    };

    try {
      stepOutputs = await this.fetchStepOutputs(stepResult.resultsUrl, stepResult.resultsMetadataUrl);
    } catch (error) {
      log("WARN", `Failed to fetch outputs for step ${stepName}: ${error}`);
      stepOutputs.message = `Failed to fetch outputs: ${error}`;
    }

    const stepData = {
      step: {
        id: stepResult.id,
        name: stepResult.stepName,
        displayName: stepResult.displayStepName,
        startedAt: stepResult.startedAt,
        endedAt: stepResult.endedAt,
        hasError: stepResult.hasError,
        resultsMetadataUrl: stepResult.resultsMetadataUrl,
        resultsUrl: stepResult.resultsUrl,
      },
      outputs: stepOutputs,
      logs: stepLogs,
    };

    await FileSystemUtils.writeJsonFile(filePath, stepData);
  }

  private static async fetchStepOutputs(resultsUrl: string, resultsMetadataUrl: string): Promise<StepOutputsResult> {
    const MAX_PREVIEW_SIZE = 1048576;

    // Check content size first
    const metaDataResults = await fetch(resultsMetadataUrl, {
      method: "HEAD",
    });

    if (!metaDataResults.ok) {
      return {
        data: "<Unable to load preview>",
        message: `Step outputs head request failed. Received status: ${metaDataResults.status}`,
      };
    }

    const contentLengthBase = metaDataResults.headers.get("content-length");
    const contentLength = Number(contentLengthBase);

    if (!contentLengthBase || !contentLength) {
      return {
        data: "<Unable to load preview>",
        message: `Step outputs head request received invalid content-length header: ${contentLengthBase}`,
      };
    }

    if (contentLength > MAX_PREVIEW_SIZE) {
      return {
        data: `<data (${contentLength} bytes)>`,
        message: `Step outputs content too large (${contentLength} bytes > ${MAX_PREVIEW_SIZE})`,
      };
    }

    // Fetch the actual results
    const results = await fetch(resultsUrl, {
      method: "GET",
    });

    if (!results.ok) {
      return {
        data: "<Unable to load preview>",
        message: `Step outputs get request failed. Received status: ${results.status}`,
      };
    }

    const resultsJson = await results.json();

    return {
      data: "data" in resultsJson ? resultsJson.data : resultsJson,
      message: null,
    };
  }
}