import type { StepResultMeta } from "@/webview/views/executionResults/types";
import type { GraphQLVariables } from "@/types/graphql";
import { fetcher } from "@/lib/fetcher";
import { fromPromise } from "xstate";

type GetStepResultMetaQuery = {
  stepResult: {
    id: string;
    resultsMetadataUrl: string;
    resultsUrl: string;
  };
};

interface GetStepResultMetaVariables {
  id: string;
}

const GET_STEP_RESULT_META = `
  query GetStepResultMeta($id: ID!) {
    stepResult(id: $id) {
      id
      resultsMetadataUrl
      resultsUrl
    }
  }
`;

export interface GetStepResultMetaOutput {
  stepResultMeta: StepResultMeta;
}

interface GetStepResultMetaInput {
  id: string;
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
    id: input.id,
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const { id, resultsMetadataUrl, resultsUrl } = response.data.stepResult;

  return {
    stepResultMeta: {
      id,
      resultsMetadataUrl,
      resultsUrl,
    },
  };
});
