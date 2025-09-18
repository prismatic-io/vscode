import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLVariables } from "@/types/graphql";
import type {
  ExecutionResults,
  InstanceExecutionResultInvokeType,
  InstanceExecutionResultResultType,
  StepResult,
} from "@/webview/views/executionResults/types";

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

interface GetExecutionResultsVariables {
  limit: number;
  flowId: string | null;
  startedDate: string;
  endedDate: string;
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
        stepResults(first: 2, orderBy: { field: STARTED_AT, direction: ASC }) {
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

export interface GetExecutionResultsOutput {
  executionResults: ExecutionResults;
}

interface GetExecutionResultsInput {
  limit: number;
  flowId: string | null;
  startedDate: string;
  endedDate: string;
}

export const getExecutionResults = fromPromise<
  GetExecutionResultsOutput,
  GraphQLVariables<GetExecutionResultsInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  const response = await fetcher<
    GetExecutionResultsQuery,
    GraphQLVariables<GetExecutionResultsVariables>
  >(GET_EXECUTION_RESULTS, {
    limit: input.limit,
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    flowId: input.flowId,
    startedDate: input.startedDate,
    endedDate: input.endedDate,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const executionResults = response.data.executionResults?.nodes?.reduce(
    (acc, executionResult) => {
      if (!executionResult) {
        return acc;
      }

      const stepResults = executionResult.stepResults?.nodes?.reduce(
        (acc, step) => {
          if (!step) {
            return acc;
          }

          acc.push(step);
          return acc;
        },
        [] as StepResult[],
      );

      acc.push({
        ...executionResult,
        stepResults,
      });

      return acc;
    },
    [] as ExecutionResults,
  );

  return {
    executionResults,
  };
});
