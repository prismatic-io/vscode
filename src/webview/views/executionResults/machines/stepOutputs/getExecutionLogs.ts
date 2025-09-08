import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLVariables } from "@/types/graphql";
import type {
  ExecutionLogs,
  LogSeverityLevel,
} from "@/webview/views/executionResults/types";

type GetExecutionLogsQuery = {
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
};

interface GetExecutionLogsVariables {
  after: string | null;
  executionId: string;
  startDate: string;
}

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

export interface GetExecutionLogsOutput {
  logs: ExecutionLogs;
}

interface GetExecutionLogsInput {
  cursor: string | null;
  executionId: string;
  startDate: string;
}

export const getExecutionLogs = fromPromise<
  GetExecutionLogsOutput,
  GraphQLVariables<GetExecutionLogsInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  const output: ExecutionLogs = [];
  let hasNextPage = true;
  let after = input.cursor;

  do {
    const response = await fetcher<
      GetExecutionLogsQuery,
      GraphQLVariables<GetExecutionLogsVariables>
    >(GET_EXECUTION_LOGS, {
      accessToken: input.accessToken,
      after,
      executionId: input.executionId,
      prismaticUrl: input.prismaticUrl,
      startDate: input.startDate,
    });

    if (response.errors?.length) {
      throw new Error(response.errors[0].message);
    }

    const logs: ExecutionLogs = response.data.logs.nodes.filter(
      Boolean,
    ) as ExecutionLogs;

    output.push(...logs);

    after = response.data.logs.pageInfo.endCursor;
    hasNextPage = response.data.logs.pageInfo.hasNextPage;
  } while (hasNextPage);

  return {
    logs: output,
  };
});
