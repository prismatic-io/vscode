import { fromPromise } from "xstate";
import { fetcher, type GraphQLVariables } from "@/webview/utils/fetcher";
import { IntegrationFlow } from "@/webview/machines/integration/integration.machine";

type GetIntegrationQuery = {
  integration: {
    systemInstance: {
      id: string;
    };
    flows: {
      nodes: {
        id: string;
        name: string;
      }[];
    };
  };
};

interface GetIntegrationVariables {
  integrationId: string;
}

const GET_INTEGRATION = `
  query GetIntegration($integrationId: ID!) {
    integration(id: $integrationId) {
      systemInstance {
        id
      }
      flows {
        nodes {
          id
          name
        }
      }
    }
  }
`;

export interface GetIntegrationOutput {
  systemInstanceId: string;
  flows: IntegrationFlow[];
}

interface GetIntegrationInput {
  integrationId: string;
}

export const getIntegration = fromPromise<
  GetIntegrationOutput,
  GraphQLVariables<GetIntegrationInput>
>(async ({ input }) => {
  if (!input.accessToken || !input.prismaticUrl) {
    throw new Error("Access token and prismatic URL are required");
  }

  const response = await fetcher<
    GetIntegrationQuery,
    GraphQLVariables<GetIntegrationVariables>
  >(GET_INTEGRATION, {
    accessToken: input.accessToken,
    prismaticUrl: input.prismaticUrl,
    integrationId: input.integrationId,
  });

  if (response.errors) {
    throw new Error(response.errors[0].message);
  }

  const integration = response.data?.integration;

  if (!integration) {
    throw new Error("Integration data not found in response");
  }

  const flows =
    integration.flows?.nodes?.reduce((acc, flow) => {
      if (!flow) {
        return acc;
      }

      acc.push({ id: flow.id, name: flow.name });

      return acc;
    }, [] as IntegrationFlow[]) ?? [];

  const systemInstanceId = integration.systemInstance?.id;

  return {
    systemInstanceId,
    flows,
  };
});
