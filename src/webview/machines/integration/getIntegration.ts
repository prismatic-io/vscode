import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { Flow } from "@/types/flows";
import type { GraphQLVariables } from "@/types/graphql";

export enum InstanceConfigState {
  FULLY_CONFIGURED = "FULLY_CONFIGURED",
  NEEDS_INSTANCE_CONFIGURATION = "NEEDS_INSTANCE_CONFIGURATION",
  NEEDS_USER_LEVEL_CONFIGURATION = "NEEDS_USER_LEVEL_CONFIGURATION",
}

export interface Connection {
  id: string;
  label: string;
  status: string;
}

type GetIntegrationQuery = {
  integration: {
    systemInstance: {
      id: string;
      configState: InstanceConfigState | null;
      configVariables: {
        nodes: {
          id: string;
          status: string;
          requiredConfigVariable: {
            key: string;
            dataType: string;
            connection: {
              key: string;
              label: string;
            } | null;
          };
        }[];
      };
    };
    flows: {
      nodes: {
        id: string;
        name: string;
        stableKey: string;
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
        configVariables {
          nodes {
            id
            status
            requiredConfigVariable {
              key
              dataType
              connection {
                key
                label
              }
            }
          }
        }
      }
      flows {
        nodes {
          id
          name
          stableKey
        }
      }
    }
  }
`;

export interface GetIntegrationOutput {
  systemInstanceId: string;
  configState: InstanceConfigState | null;
  connections: Connection[];
  flows: Flow[];
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

      acc.push({
        id: flow.id,
        name: flow.name,
        stableKey: flow.stableKey,
      });

      return acc;
    }, [] as Flow[]) ?? [];

  const systemInstanceId = integration.systemInstance?.id;
  const configState = integration.systemInstance?.configState ?? null;

  const connections =
    integration.systemInstance?.configVariables?.nodes?.reduce(
      (acc, configVar) => {
        if (
          configVar?.requiredConfigVariable?.dataType?.toLowerCase() ===
          "connection"
        ) {
          acc.push({
            id: configVar.id,
            label: configVar.requiredConfigVariable.key,
            status: configVar.status,
          });
        }
        return acc;
      },
      [] as Connection[],
    ) ?? [];

  return {
    systemInstanceId,
    configState,
    connections,
    flows,
  };
});
