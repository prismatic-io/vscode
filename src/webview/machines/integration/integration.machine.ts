import { assign, setup } from "xstate";
import type { Connection } from "@/types/connections";
import type { Flow } from "@/types/flows";
import type { InstanceConfigState } from "@/types/state";

interface IntegrationContext {
  integrationId: string | null;
  systemInstanceId: string;
  configState: InstanceConfigState | null;
  connections: Connection[];
  flow: Flow | null;
  flows: Flow[];
}

type IntegrationEvents =
  | { type: "SET_FLOW"; flow: Flow }
  | { type: "SET_INTEGRATION_ID"; integrationId: string }
  | {
      type: "SYNC_DATA";
      data: {
        systemInstanceId?: string;
        configState?: InstanceConfigState | null;
        connections?: Connection[];
        flows?: Flow[];
      };
    }
  | { type: "CLEAR" };

type IntegrationTags = "idle" | "loading";

export const integrationMachine = setup({
  types: {
    context: {} as IntegrationContext,
    events: {} as IntegrationEvents,
    tags: {} as IntegrationTags,
  },
  actions: {
    updateIntegrationId: assign((_, params: { integrationId: string }) => ({
      integrationId: params.integrationId,
    })),
    updateFlow: assign((_, params: { flow: Flow }) => ({
      flow: params.flow,
    })),
    syncData: assign(
      (
        _,
        params: {
          systemInstanceId?: string;
          configState?: InstanceConfigState | null;
          connections?: Connection[];
          flows?: Flow[];
        },
      ) => ({
        ...(params.systemInstanceId !== undefined && {
          systemInstanceId: params.systemInstanceId,
        }),
        ...(params.configState !== undefined && {
          configState: params.configState,
        }),
        ...(params.connections !== undefined && {
          connections: params.connections,
        }),
        ...(params.flows !== undefined && { flows: params.flows }),
      }),
    ),
    clearContext: assign(() => ({
      integrationId: null,
      systemInstanceId: "",
      configState: null,
      connections: [],
      flow: null,
      flows: [],
    })),
  },
  guards: {
    hasIntegrationId: ({ context }) => Boolean(context.integrationId),
    hasFlow: ({ context }) => Boolean(context.flow),
    hasSystemInstanceId: ({ context }) => Boolean(context.systemInstanceId),
    hasData: ({ context }) =>
      Boolean(context.systemInstanceId) || context.flows.length > 0,
  },
}).createMachine({
  id: "integration",
  initial: "IDLE",
  context: {
    integrationId: null,
    systemInstanceId: "",
    configState: null,
    connections: [],
    flow: null,
    flows: [],
  },
  states: {
    IDLE: {
      tags: "idle",
      on: {
        SET_FLOW: {
          actions: [
            {
              type: "updateFlow",
              params: ({ event }) => ({ flow: event.flow }),
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
          target: "AWAITING_DATA",
        },
        SYNC_DATA: {
          actions: [
            {
              type: "syncData",
              params: ({ event }) => event.data,
            },
          ],
        },
        CLEAR: {
          actions: "clearContext",
        },
      },
    },
    AWAITING_DATA: {
      tags: "loading",
      on: {
        SYNC_DATA: {
          actions: [
            {
              type: "syncData",
              params: ({ event }) => event.data,
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
        },
        CLEAR: {
          actions: "clearContext",
          target: "IDLE",
        },
      },
      always: {
        guard: "hasData",
        target: "IDLE",
      },
    },
  },
});
