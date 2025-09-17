import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { GraphQLVariables } from "@/types/graphql";

export enum InstanceConfigState {
  FULLY_CONFIGURED = "FULLY_CONFIGURED",
  NEEDS_INSTANCE_CONFIGURATION = "NEEDS_INSTANCE_CONFIGURATION",
  NEEDS_USER_LEVEL_CONFIGURATION = "NEEDS_USER_LEVEL_CONFIGURATION",
}

type GetIntegrationQuery = {
  integration: {
    systemInstance: {
      id: string;
      configState: InstanceConfigState | null;
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
  query GetIntegration(
    $integrationId: ID!
  ) {
    integration(id: $integrationId) {
      systemInstance {
        id
        configState
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
  configState: InstanceConfigState | null;
  initialFlow: {
    id: string;
    name: string;
  } | null;
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

  const systemInstanceId = integration.systemInstance.id;
  const configState = integration.systemInstance?.configState ?? null;
  const initialFlow = integration.flows?.nodes?.[0] ?? null;

  return {
    systemInstanceId,
    configState,
    initialFlow,
  };
});
