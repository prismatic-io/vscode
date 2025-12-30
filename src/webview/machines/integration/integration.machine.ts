import { assign, setup } from "xstate";
import type { Flow } from "@/types/flows";
import {
  type Connection,
  type InstanceConfigState,
  getIntegration,
} from "@/webview/machines/integration/getIntegration";

interface IntegrationInput {
  accessToken: string;
  prismaticUrl: string;
}

interface IntegrationContext {
  integrationId: string | null;
  systemInstanceId: string;
  configState: InstanceConfigState | null;
  connections: Connection[];
  flowId: string;
  flows: Flow[];
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
    updateConfigState: assign(
      (_, params: { configState: InstanceConfigState | null }) => {
        return {
          configState: params.configState,
        };
      },
    ),
    updateFlows: assign((_, params: { flows: Flow[] }) => {
      return {
        flows: params.flows,
      };
    }),
    updateConnections: assign((_, params: { connections: Connection[] }) => {
      return {
        connections: params.connections,
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
      configState: null,
      connections: [],
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
            {
              type: "updateConfigState",
              params: ({ event }) => {
                return {
                  configState: event.output.configState,
                };
              },
            },
            {
              type: "updateConnections",
              params: ({ event }) => {
                return {
                  connections: event.output.connections,
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
