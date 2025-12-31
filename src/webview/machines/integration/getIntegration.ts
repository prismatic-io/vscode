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
  stableKey: string;
  status: string;
  authorizationUrl: string | null;
  oauth2Type: string | null;
  scopes: string | null;
  inputs: ConnectionInput[];
  isTestCredential: boolean;
  scopedConfigVariableId: string | null;
  variableScope: string | null;
  managedBy: string | null;
  componentKey: string | null;
  componentLabel: string | null;
  connectionKey: string | null;
  isInlineCNI: boolean;
  onPremiseConnectionConfig: unknown | null;
  scopedConnectionKey: string | null;
  scopedConnectionLabel: string | null;
  scopedComponentLabel: string | null;
  scopedConnectionIsInlineCNI: boolean;
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
            stableKey: string;
            dataType: string;
            onPremiseConnectionConfig: unknown | null;
            connection: {
              key: string;
              label: string;
              oauth2Type: string | null;
              component: {
                key: string;
                label: string;
                forCodeNativeIntegration: boolean;
              } | null;
              inputs: {
                nodes: {
                  key: string;
                  label: string;
                  type: string;
                }[];
              };
            } | null;
            scopedConfigVariable: {
              id: string;
              status: string;
              variableScope: string;
              managedBy: string;
              key: string;
              description: string | null;
              connection: {
                key: string;
                label: string;
                component: {
                  key: string;
                  label: string;
                  forCodeNativeIntegration: boolean;
                } | null;
              } | null;
              customer: {
                id: string;
                name: string;
              } | null;
              customerConfigVariables: {
                nodes: {
                  id: string;
                  isTest: boolean;
                  status: string;
                  customer: {
                    id: string;
                  } | null;
                  inputs: {
                    nodes: {
                      name: string;
                      value: string | null;
                      hasValue: boolean;
                    }[];
                  };
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
        isSynchronous: boolean;
        usesFifoQueue: boolean;
        endpointSecurityType: string;
        testUrl: string;
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
              stableKey
              dataType
              onPremiseConnectionConfig
              connection {
                key
                label
                oauth2Type
                component {
                  key
                  label
                  forCodeNativeIntegration
                }
                inputs {
                  nodes {
                    key
                    label
                    type
                  }
                }
              }
              scopedConfigVariable {
                id
                status
                variableScope
                managedBy
                key
                description
                connection {
                  key
                  label
                  component {
                    key
                    label
                    forCodeNativeIntegration
                  }
                }
                customer {
                  id
                  name
                }
                customerConfigVariables(isTest: true) {
                  nodes {
                    id
                    isTest
                    status
                    customer {
                      id
                    }
                    inputs {
                      nodes {
                        name
                        value
                        hasValue
                      }
                    }
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
          isSynchronous
          usesFifoQueue
          endpointSecurityType
          testUrl
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
        isSynchronous: flow.isSynchronous,
        usesFifoQueue: flow.usesFifoQueue,
        endpointSecurityType: flow.endpointSecurityType,
        testUrl: flow.testUrl,
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

          // Check if we have customer config from scoped config variable
          const customerConfig =
            configVar.requiredConfigVariable.scopedConfigVariable?.customerConfigVariables?.nodes?.[0];
          const hasCustomerConfig = !!customerConfig;

          // Use customer data if available, otherwise fall back to instance data
          const effectiveStatus = hasCustomerConfig
            ? customerConfig.status
            : configVar.status;
          // customerConfigVariables doesn't have authorizeUrl, use instance authorizeUrl
          const effectiveAuthorizeUrl = configVar.authorizeUrl;
          const effectiveInputs = hasCustomerConfig
            ? customerConfig.inputs?.nodes
            : configVar.inputs?.nodes;

          // Get scopes from the effective inputs source
          const scopesInput = effectiveInputs?.find(
            (i: { name: string }) => i.name === "scopes",
          );

          // Map inputs with their hasValue status using the effective inputs
          const inputs =
            effectiveInputs?.map(
              (input: { name: string; value: string | null; hasValue: boolean }) => {
                const fieldDef = connection?.inputs?.nodes?.find(
                  (f) => f.key === input.name,
                );
                return {
                  name: input.name,
                  label: fieldDef?.label ?? input.name,
                  hasValue: input.hasValue,
                  type: fieldDef?.type ?? "STRING",
                };
              },
            ) ?? [];

          const scopedConfigVar =
            configVar.requiredConfigVariable.scopedConfigVariable;

          const scopedConnection = scopedConfigVar?.connection;

          acc.push({
            id: configVar.id,
            label: configVar.requiredConfigVariable.key,
            stableKey: configVar.requiredConfigVariable.stableKey,
            status: effectiveStatus,
            authorizationUrl: effectiveAuthorizeUrl ?? null,
            oauth2Type: connection?.oauth2Type ?? null,
            scopes: scopesInput?.value ?? null,
            inputs,
            isTestCredential: hasCustomerConfig,
            scopedConfigVariableId: scopedConfigVar?.id ?? null,
            variableScope: scopedConfigVar?.variableScope ?? null,
            managedBy: scopedConfigVar?.managedBy ?? null,
            componentKey: connection?.component?.key ?? null,
            componentLabel: connection?.component?.label ?? null,
            connectionKey: connection?.key ?? null,
            isInlineCNI: connection?.component?.forCodeNativeIntegration ?? false,
            onPremiseConnectionConfig:
              configVar.requiredConfigVariable.onPremiseConnectionConfig ?? null,
            scopedConnectionKey: scopedConnection?.key ?? null,
            scopedConnectionLabel: scopedConnection?.label ?? null,
            scopedComponentLabel: scopedConnection?.component?.label ?? null,
            scopedConnectionIsInlineCNI:
              scopedConnection?.component?.forCodeNativeIntegration ?? false,
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
