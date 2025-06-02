import { assign, setup } from "xstate";
import type {
  ExecutionResult,
  ExecutionResults,
  StepResult,
} from "@webview/views/executionResults/types";
import { getExecutionResults } from "@/webview/views/executionResults/machines/executionResults/getExecutionResults";
import {
  stepOutputsMachine,
  type StepOutputsActorRef,
} from "@/webview/views/executionResults/machines/stepOutputs/stepOutputs.machine";

interface ExecutionResultsInput {
  accessToken: string;
  limit: number;
  prismaticUrl: string;
  startDate: string;
  endDate: string;
}

interface ExecutionResultsContext {
  executionResults: ExecutionResults;
  flowId: string | null;
  executionResult: ExecutionResult | null;
  stepResult: StepResult | null;
  stepResultActorRef: StepOutputsActorRef | null;
  hasLoaded: boolean;
  "@input": ExecutionResultsInput;
}

type ExecutionResultsEvents =
  | { type: "FETCH" }
  | { type: "SET_FLOW_ID"; flowId: string }
  | { type: "SET_EXECUTION_RESULT"; executionResultId: string }
  | { type: "SET_STEP_RESULT"; stepResultId: string };

type ExecutionResultsTags = "idle" | "loading";

export const executionResultsMachine = setup({
  types: {
    context: {} as ExecutionResultsContext,
    events: {} as ExecutionResultsEvents,
    input: {} as ExecutionResultsInput,
    tags: {} as ExecutionResultsTags,
  },
  actors: {
    getExecutionResults,
    stepOutputsMachine,
  },
  actions: {
    updateHasLoaded: assign((_, params: { hasLoaded: boolean }) => {
      return {
        hasLoaded: params.hasLoaded,
      };
    }),
    updateExecutionResults: assign(
      (_, params: { executionResults: ExecutionResults }) => {
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
    updateExecutionResult: assign(
      ({ context }, params: { executionResultId: string }) => {
        const executionResult = context.executionResults.find(
          (executionResult) => executionResult.id === params.executionResultId
        );

        return {
          executionResult,
        };
      }
    ),
    updateStepResult: assign(
      ({ context, spawn }, params: { stepResultId: string }) => {
        const stepResult = context.executionResult?.stepResults.find(
          (stepResult) => stepResult.id === params.stepResultId
        );

        if (!context.executionResult || !stepResult) {
          return {
            stepResult: null,
            stepResultActorRef: null,
          };
        }

        const stepResultActorRef = spawn("stepOutputsMachine", {
          id: "stepOutputsMachine",
          input: {
            prismaticUrl: context["@input"].prismaticUrl,
            accessToken: context["@input"].accessToken,
            executionResultId: context.executionResult.id,
            startDate: stepResult.startedAt,
            stepResult,
          },
        });

        return {
          stepResult,
          stepResultActorRef,
        };
      }
    ),
  },
  guards: {
    hasFlowId: ({ context }) => Boolean(context.flowId),
  },
}).createMachine({
  id: "executionResults",
  initial: "INITIALIZING",
  context: ({ input }) => {
    const context: ExecutionResultsContext = {
      executionResults: [],
      flowId: null,
      executionResult: null,
      stepResult: null,
      stepResultActorRef: null,
      hasLoaded: false,
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
        {
          type: "updateExecutionResult",
          params: () => ({
            executionResultId: "",
          }),
        },
        {
          type: "updateStepResult",
          params: () => ({
            stepResultId: "",
          }),
        },
      ],
      target: ".INITIALIZING",
    },
    SET_EXECUTION_RESULT: {
      actions: [
        {
          type: "updateExecutionResult",
          params: ({ event }) => ({
            executionResultId: event.executionResultId,
          }),
        },
        {
          type: "updateStepResult",
          params: ({ context }) => ({
            stepResultId: context.executionResult?.stepResults[0]?.id || "",
          }),
        },
      ],
      target: ".IDLE",
    },
    SET_STEP_RESULT: {
      actions: [
        {
          type: "updateStepResult",
          params: ({ event }) => ({ stepResultId: event.stepResultId }),
        },
      ],
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
          startDate: context["@input"].startDate,
          endDate: context["@input"].endDate,
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
            {
              type: "updateExecutionResult",
              params: ({ event }) => {
                return {
                  executionResultId: event.output.executionResults[0]?.id,
                };
              },
            },
            {
              type: "updateStepResult",
              params: ({ event }) => {
                return {
                  stepResultId:
                    event.output.executionResults[0]?.stepResults[0]?.id,
                };
              },
            },
            {
              type: "updateHasLoaded",
              params: { hasLoaded: true },
            },
          ],
          target: "IDLE",
        },
        onError: "IDLE",
      },
    },
  },
});
