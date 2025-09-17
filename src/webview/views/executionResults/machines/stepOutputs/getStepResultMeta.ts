import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLVariables } from "@/types/graphql";
import type { StepResultMeta } from "@/webview/views/executionResults/types";

type GetStepResultMetaQuery = {
  stepResults: {
    nodes: ({
      id: string;
      resultsMetadataUrl: string;
      resultsUrl: string;
    } | null)[];
  };
};

interface GetStepResultMetaVariables {
  executionId: string;
  startedAt: string;
  endedAt: string | null;
}

const GET_STEP_RESULT_META = `
  query GetStepResultMeta(
    $executionId: ID!, 
    $startedAt: DateTime, 
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

export interface GetStepResultMetaOutput {
  stepResultMeta: StepResultMeta;
}

interface GetStepResultMetaInput {
  executionId: string;
  id: string;
  startedAt: string;
  endedAt: string | null;
}

export const getStepResultMeta = fromPromise<
  GetStepResultMetaOutput,
  GraphQLVariables<GetStepResultMetaInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  const response = await fetcher<
    GetStepResultMetaQuery,
    GraphQLVariables<GetStepResultMetaVariables>
  >(GET_STEP_RESULT_META, {
    executionId: input.executionId,
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const { id, resultsMetadataUrl, resultsUrl } =
    response.data.stepResults.nodes.find((node) => node?.id === input.id)!;

  return {
    stepResultMeta: {
      id,
      resultsMetadataUrl,
      resultsUrl,
    },
  };
});
