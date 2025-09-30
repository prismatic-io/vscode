import type {
  ExecutionResult,
  ExecutionResults,
  StepLogsAndOutputsCache,
  StepResult,
} from "@webview/views/executionResults/types";
import { assign, setup } from "xstate";
import type { Flow } from "@/types/flows";
import { getExecutionResults } from "@/webview/views/executionResults/machines/executionResults/getExecutionResults";
import {
  type StepOutputsActorRef,
  stepOutputsMachine,
} from "@/webview/views/executionResults/machines/stepOutputs/stepOutputs.machine";

interface ExecutionResultsInput {
  accessToken: string;
  limit: number;
  prismaticUrl: string;
  startedDate: string;
  endedDate: string;
}

interface ExecutionResultsContext {
  executionResults: ExecutionResults;
  flow: Flow | null;
  executionResult: ExecutionResult | null;
  stepResult: StepResult | null;
  stepResultActorRef: StepOutputsActorRef | null;
  hasLoaded: boolean;
  stepLogsAndOutputsCache: Map<string, StepLogsAndOutputsCache>;
  "@input": ExecutionResultsInput;
}

type ExecutionResultsEvents =
  | {
      type: "FETCH";
    }
  | {
      type: "SET_FLOW";
      flow: Flow;
    }
  | {
      type: "SET_EXECUTION_RESULT";
      executionResultId: string;
    }
  | {
      type: "SET_STEP_RESULT";
      stepResultId: string;
    }
  | {
      type: "SET_STEP_LOGS_AND_OUTPUTS_CACHE";
      stepId: string;
      cache: StepLogsAndOutputsCache;
    };

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
      },
    ),
    updateFlow: assign((_, params: { flow: Flow }) => {
      return {
        flow: params.flow,
      };
    }),
    updateExecutionResult: assign(
      ({ context }, params: { executionResultId: string }) => {
        const executionResult = context.executionResults.find(
          (executionResult) => executionResult.id === params.executionResultId,
        );

        return {
          executionResult,
        };
      },
    ),
    updateStepResult: assign(
      ({ context, spawn }, params: { stepResultId: string }) => {
        const stepResult = context.executionResult?.stepResults.find(
          (stepResult) => stepResult.id === params.stepResultId,
        );

        if (!context.executionResult || !stepResult) {
          return {
            stepResult: null,
            stepResultActorRef: null,
          };
        }

        const cacheKey = `${context.executionResult.id}-${stepResult.id}`;

        const cachedData = context.stepLogsAndOutputsCache.get(cacheKey);

        const stepResultActorRef = spawn("stepOutputsMachine", {
          id: "stepOutputsMachine",
          input: {
            prismaticUrl: context["@input"].prismaticUrl,
            accessToken: context["@input"].accessToken,
            executionResultId: context.executionResult.id,
            executionStartedAt: context.executionResult.startedAt,
            stepResult,
            cachedData,
          },
        });

        return {
          stepResult,
          stepResultActorRef,
        };
      },
    ),
    updateStepLogsAndOutputsCache: assign(
      (
        { context },
        params: {
          stepId: string;
          cache: StepLogsAndOutputsCache;
        },
      ) => {
        const cacheKey = `${context.executionResult?.id}-${params.stepId}`;

        const existingCache = context.stepLogsAndOutputsCache.get(cacheKey) || {
          output: null,
          logs: null,
        };

        const updatedCache = {
          ...existingCache,
          output: params.cache.output,
          logs: params.cache.logs,
        };

        context.stepLogsAndOutputsCache.set(cacheKey, updatedCache);

        return {
          stepLogsAndOutputsCache: context.stepLogsAndOutputsCache,
        };
      },
    ),
  },
  guards: {
    hasFlow: ({ context }) => Boolean(context.flow),
  },
}).createMachine({
  id: "executionResults",
  initial: "INITIALIZING",
  context: ({ input }) => {
    const context: ExecutionResultsContext = {
      executionResults: [],
      flow: null,
      executionResult: null,
      stepResult: null,
      stepResultActorRef: null,
      hasLoaded: false,
      stepLogsAndOutputsCache: new Map(),
      "@input": input,
    };

    return context;
  },
  on: {
    SET_FLOW: {
      actions: [
        {
          type: "updateFlow",
          params: ({ event }) => ({ flow: event.flow }),
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
    SET_STEP_LOGS_AND_OUTPUTS_CACHE: {
      actions: [
        {
          type: "updateStepLogsAndOutputsCache",
          params: ({ event }) => ({
            stepId: event.stepId,
            cache: event.cache,
          }),
        },
      ],
    },
  },
  states: {
    IDLE: {
      tags: "idle",
      on: {
        FETCH: {
          target: "INITIALIZING",
        },
      },
    },
    INITIALIZING: {
      tags: "loading",
      always: [
        {
          target: "FETCHING",
          guard: "hasFlow",
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
          flowId: context.flow?.id!,
          limit: context["@input"].limit,
          accessToken: context["@input"].accessToken,
          prismaticUrl: context["@input"].prismaticUrl,
          startedDate: context["@input"].startedDate,
          endedDate: context["@input"].endedDate,
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
