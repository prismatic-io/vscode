import { fromPromise } from "xstate";
import { fetcher, type GraphQLVariables } from "@webview/lib/fetcher";

export interface ExecutionResult {
  id: string;
  status: string;
  createdAt: string;
}

type GetExecutionResultsQuery = {
  executionResults: ExecutionResult[];
};

interface GetExecutionResultsVariables {
  limit: number;
  flowId: string | null;
}

const GET_EXECUTION_RESULTS = `
  query GetExecutionResults($limit: Int!, $instanceId: ID, $flowId: ID) {
    executionResults(first: $limit, instance: $instanceId, flow: $flowId) {
      nodes {
        id
        status
        stepResults {
          nodes {
            id
            stepName
          }
        }
      }
    }
  }
`;

export interface GetExecutionResultsOutput {
  executionResults: ExecutionResult[];
}

interface GetExecutionResultsInput {
  limit: number;
  flowId: string | null;
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
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  return {
    executionResults: response.data.executionResults || [],
  };
});
