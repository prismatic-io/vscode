import { assign, setup } from "xstate";
import { getIntegration } from "@/webview/machines/integration/getIntegration";

export interface IntegrationFlow {
  id: string;
  name: string;
}

interface IntegrationInput {
  accessToken: string;
  prismaticUrl: string;
}

interface IntegrationContext {
  integrationId: string | null;
  systemInstanceId: string;
  flowId: string;
  flows: IntegrationFlow[];
  "@input": IntegrationInput;
}

type IntegrationEvents =
  | { type: "FETCH" }
  | { type: "SET_FLOW_ID"; flowId: string }
  | { type: "SET_INTEGRATION_ID"; integrationId: string };

type IntegrationTags = "idle" | "loading";

export const integrationMachine = setup({
  types: {
    context: {} as IntegrationContext,
    events: {} as IntegrationEvents,
    input: {} as IntegrationInput,
    tags: {} as IntegrationTags,
  },
  actions: {
    updateIntegrationId: assign((_, params: { integrationId: string }) => {
      return {
        integrationId: params.integrationId,
      };
    }),
    updateFlowId: assign((_, params: { flowId: string }) => {
      return {
        flowId: params.flowId,
      };
    }),
    updateSystemInstanceId: assign(
      (_, params: { systemInstanceId: string }) => {
        return {
          systemInstanceId: params.systemInstanceId,
        };
      },
    ),
    updateFlows: assign((_, params: { flows: IntegrationFlow[] }) => {
      return {
        flows: params.flows,
      };
    }),
  },
  actors: {
    getIntegration,
  },
  guards: {
    hasIntegrationId: ({ context }) => Boolean(context.integrationId),
    hasFlowId: ({ context }) => Boolean(context.flowId),
    hasSystemInstanceId: ({ context }) => Boolean(context.systemInstanceId),
  },
}).createMachine({
  id: "integration",
  initial: "INITIALIZING",
  context: ({ input }) => {
    const context: IntegrationContext = {
      integrationId: null,
      systemInstanceId: "",
      flowId: "",
      flows: [],
      "@input": input,
    };

    return context;
  },
  states: {
    IDLE: {
      tags: "idle",
      on: {
        FETCH: "INITIALIZING",
        SET_FLOW_ID: {
          actions: [
            {
              type: "updateFlowId",
              params: ({ event }) => ({ flowId: event.flowId }),
            },
          ],
        },
        SET_INTEGRATION_ID: {
          actions: [
            {
              type: "updateIntegrationId",
              params: ({ event }) => ({ integrationId: event.integrationId }),
            },
          ],
          target: "INITIALIZING",
        },
      },
    },
    INITIALIZING: {
      tags: "loading",
      always: [
        {
          target: "FETCHING",
          guard: "hasIntegrationId",
        },
        {
          target: "IDLE",
        },
      ],
    },
    FETCHING: {
      tags: "loading",
      invoke: {
        src: "getIntegration",
        input: ({ context }) => ({
          integrationId: context.integrationId as string,
          accessToken: context["@input"].accessToken,
          prismaticUrl: context["@input"].prismaticUrl,
        }),
        onDone: {
          actions: [
            {
              type: "updateFlows",
              params: ({ event }) => {
                return {
                  flows: event.output.flows,
                };
              },
            },
            {
              type: "updateFlowId",
              params: ({ event }) => ({ flowId: event.output.flows[0].id }),
            },
            {
              type: "updateSystemInstanceId",
              params: ({ event }) => {
                return {
                  systemInstanceId: event.output.systemInstanceId,
                };
              },
            },
          ],
          target: "IDLE",
        },
        onError: "IDLE",
      },
    },
  },
});
