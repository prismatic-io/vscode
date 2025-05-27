import { assign, setup } from "xstate";
import {
  type ExecutionResult,
  getExecutionResults,
} from "./getExecutionResults";

interface ExecutionResultsInput {
  accessToken: string;
  limit: number;
  prismaticUrl: string;
}

interface ExecutionResultsContext {
  executionResults: ExecutionResult[];
  flowId: string | null;
  "@input": ExecutionResultsInput;
}

type ExecutionResultsEvents =
  | { type: "FETCH" }
  | { type: "SET_FLOW_ID"; flowId: string };

type ExecutionResultsTags = "idle" | "loading";

export const executionResultsMachine = setup({
  types: {
    context: {} as ExecutionResultsContext,
    events: {} as ExecutionResultsEvents,
    input: {} as ExecutionResultsInput,
    tags: {} as ExecutionResultsTags,
  },
  actions: {
    updateExecutionResults: assign(
      (_, params: { executionResults: ExecutionResult[] }) => {
        return {
          executionResults: params.executionResults,
        };
      }
    ),
    updateFlowId: assign((_, params: { flowId: string }) => {
      return {
        flowId: params.flowId,
      };
    }),
  },
  actors: {
    getExecutionResults,
  },
  guards: {
    hasFlowId: ({ context }) => Boolean(context.flowId),
  },
}).createMachine({
  id: "executionResults",
  initial: "IDLE",
  context: ({ input }) => {
    const context: ExecutionResultsContext = {
      executionResults: [],
      flowId: null,
      "@input": input,
    };

    return context;
  },
  on: {
    SET_FLOW_ID: {
      actions: [
        {
          type: "updateFlowId",
          params: ({ event }) => ({ flowId: event.flowId }),
        },
      ],
      target: ".INITIALIZING",
    },
  },
  states: {
    IDLE: {
      tags: "idle",
      on: {
        FETCH: "INITIALIZING",
      },
    },
    INITIALIZING: {
      tags: "loading",
      always: [
        {
          target: "FETCHING",
          guard: "hasFlowId",
        },
        {
          target: "IDLE",
        },
      ],
    },
    FETCHING: {
      tags: "loading",
      invoke: {
        src: "getExecutionResults",
        input: ({ context }) => ({
          flowId: context.flowId,
          limit: context["@input"].limit,
          accessToken: context["@input"].accessToken,
          prismaticUrl: context["@input"].prismaticUrl,
        }),
        onDone: {
          actions: [
            {
              type: "updateExecutionResults",
              params: ({ event }) => {
                return {
                  executionResults: event.output.executionResults,
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
