import { fromPromise } from "xstate";
import { fetcher } from "@/shared/fetcher";
import type { Flow } from "@/types/flows";
import type { GraphQLVariables } from "@/types/graphql";

export enum InstanceConfigState {
  FULLY_CONFIGURED = "FULLY_CONFIGURED",
  NEEDS_INSTANCE_CONFIGURATION = "NEEDS_INSTANCE_CONFIGURATION",
  NEEDS_USER_LEVEL_CONFIGURATION = "NEEDS_USER_LEVEL_CONFIGURATION",
}

export interface ConnectionInput {
  name: string;
  label: string;
  hasValue: boolean;
  type: string;
}

export interface Connection {
  id: string;
  label: string;
  status: string;
  authorizationUrl: string | null;
  oauth2Type: string | null;
  scopes: string | null;
  inputs: ConnectionInput[];
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
          authorizeUrl: string | null;
          inputs: {
            nodes: {
              name: string;
              value: string | null;
              hasValue: boolean;
            }[];
          };
          requiredConfigVariable: {
            key: string;
            dataType: string;
            connection: {
              key: string;
              label: string;
              oauth2Type: string | null;
              inputs: {
                nodes: {
                  key: string;
                  label: string;
                  type: string;
                }[];
              };
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
            authorizeUrl
            inputs {
              nodes {
                name
                value
                hasValue
              }
            }
            requiredConfigVariable {
              key
              dataType
              connection {
                key
                label
                oauth2Type
                inputs {
                  nodes {
                    key
                    label
                    type
                  }
                }
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
          const connection = configVar.requiredConfigVariable.connection;

          // Get scopes from inputs
          const scopesInput = configVar.inputs?.nodes?.find(
            (i) => i.name === "scopes",
          );

          // Map inputs with their hasValue status
          const inputs =
            configVar.inputs?.nodes?.map((input) => {
              const fieldDef = connection?.inputs?.nodes?.find(
                (f) => f.key === input.name,
              );
              return {
                name: input.name,
                label: fieldDef?.label ?? input.name,
                hasValue: input.hasValue,
                type: fieldDef?.type ?? "STRING",
              };
            }) ?? [];

          acc.push({
            id: configVar.id,
            label: configVar.requiredConfigVariable.key,
            status: configVar.status,
            authorizationUrl: configVar.authorizeUrl ?? null,
            oauth2Type: connection?.oauth2Type ?? null,
            scopes: scopesInput?.value ?? null,
            inputs,
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
