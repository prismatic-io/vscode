import { type ActorRefFrom, assign, sendParent, setup } from "xstate";
import { getExecutionLogs } from "@/webview/views/executionResults/machines/stepOutputs/getExecutionLogs";
import { getStepOutputs } from "@/webview/views/executionResults/machines/stepOutputs/getStepOutputs";
import { getStepResultMeta } from "@/webview/views/executionResults/machines/stepOutputs/getStepResultMeta";
import type {
  ExecutionLogs,
  StepLogsAndOutputsCache,
  StepResult,
  StepResultMeta,
} from "@/webview/views/executionResults/types";

interface StepOutputsInput {
  accessToken: string;
  prismaticUrl: string;
  executionResultId: string;
  executionStartedAt: string;
  stepResult: StepResult;
  cachedData?: StepLogsAndOutputsCache;
}

interface StepOutputsContext {
  output: {
    data: unknown;
    message: string | null;
  };
  stepResultMeta: StepResultMeta | null;
  logs: ExecutionLogs | null;
  hasLoaded: boolean;
  "@input": StepOutputsInput;
}

type StepOutputsEvents = { type: "FETCH" };

type StepOutputsTags = "idle" | "loading";

export type StepOutputsActorRef = ActorRefFrom<typeof stepOutputsMachine>;

export const stepOutputsMachine = setup({
  types: {
    context: {} as StepOutputsContext,
    events: {} as StepOutputsEvents,
    input: {} as StepOutputsInput,
    tags: {} as StepOutputsTags,
  },
  actions: {
    updateHasLoaded: assign((_, params: { hasLoaded: boolean }) => {
      return {
        hasLoaded: params.hasLoaded,
      };
    }),
    updateStepResultMeta: assign(
      (_, params: { stepResultMeta: StepResultMeta }) => {
        return {
          stepResultMeta: params.stepResultMeta,
        };
      },
    ),
    updateStepOutput: assign(
      (
        _,
        params: {
          output: {
            data: unknown;
            message: string | null;
          };
        },
      ) => {
        return {
          output: params.output,
        };
      },
    ),
    updateLogs: assign(({ context }, params: { logs: ExecutionLogs }) => {
      const stepLogs = params.logs.filter(
        (log) => log.stepName === context["@input"].stepResult.stepName,
      );

      return {
        logs: stepLogs,
      };
    }),
  },
  actors: {
    getStepResultMeta,
    getStepOutputs,
    getExecutionLogs,
  },
  guards: {
    hasExecutionResultId: ({ context }) =>
      Boolean(context["@input"].executionResultId),
    hasCachedData: ({ context }) => {
      const cachedData = context["@input"].cachedData;
      return Boolean(cachedData?.output && cachedData?.logs);
    },
  },
}).createMachine({
  id: "stepOutputs",
  initial: "INITIALIZING",
  context: ({ input }) => {
    const context: StepOutputsContext = {
      output: input.cachedData?.output ?? {
        data: null,
        message: null,
      },
      logs: input.cachedData?.logs || null,
      hasLoaded: Boolean(input.cachedData?.output && input.cachedData?.logs),
      stepResultMeta: {
        id: input.stepResult.id,
        resultsMetadataUrl: input.stepResult.resultsMetadataUrl,
        resultsUrl: input.stepResult.resultsUrl,
      },
      "@input": input,
    };

    return context;
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
        { target: "IDLE", guard: "hasCachedData" },
        { target: "FETCHING" },
      ],
    },
    FETCHING: {
      tags: "loading",
      type: "parallel",
      states: {
        FETCHING_OUTPUTS: {
          initial: "GETTING_STEP_OUTPUTS",
          states: {
            GETTING_STEP_RESULT_META: {
              tags: "loading",
              invoke: {
                src: "getStepResultMeta",
                input: ({ context }) => ({
                  executionId: context["@input"].executionResultId,
                  id: context["@input"].stepResult.id,
                  startedAt: context["@input"].stepResult.startedAt,
                  endedAt: context["@input"].stepResult.endedAt,
                  accessToken: context["@input"].accessToken,
                  prismaticUrl: context["@input"].prismaticUrl,
                }),
                onDone: {
                  actions: [
                    {
                      type: "updateStepResultMeta",
                      params: ({ event }) => {
                        return {
                          stepResultMeta: event.output.stepResultMeta,
                        };
                      },
                    },
                  ],
                  target: "GETTING_STEP_OUTPUTS",
                },
                onError: "FINISHING_FETCHING_OUTPUTS",
              },
            },
            GETTING_STEP_OUTPUTS: {
              tags: "loading",
              invoke: {
                src: "getStepOutputs",
                input: ({ context }) => ({
                  resultsMetadataUrl:
                    context.stepResultMeta?.resultsMetadataUrl,
                  resultsUrl: context.stepResultMeta?.resultsUrl,
                }),
                onDone: {
                  actions: [
                    {
                      type: "updateStepOutput",
                      params: ({ event }) => {
                        return {
                          output: {
                            data: event.output.stepOutputs.data,
                            message: event.output.stepOutputs.message,
                          },
                        };
                      },
                    },
                  ],
                  target: "FINISHING_FETCHING_OUTPUTS",
                },
                onError: "GETTING_STEP_RESULT_META",
              },
            },
            FINISHING_FETCHING_OUTPUTS: {
              type: "final",
            },
          },
        },
        FETCHING_LOGS: {
          initial: "GETTING_EXECUTION_LOGS",
          states: {
            GETTING_EXECUTION_LOGS: {
              tags: "loading",
              invoke: {
                src: "getExecutionLogs",
                input: ({ context }) => ({
                  cursor: null,
                  accessToken: context["@input"].accessToken,
                  prismaticUrl: context["@input"].prismaticUrl,
                  executionId: context["@input"].executionResultId,
                  startedDate: context["@input"].executionStartedAt,
                }),
                onDone: {
                  actions: [
                    {
                      type: "updateLogs",
                      params: ({ event }) => {
                        return {
                          logs: event.output.logs,
                        };
                      },
                    },
                  ],
                  target: "FINISHED_GETTING_EXECUTION_LOGS",
                },
                onError: "FINISHED_GETTING_EXECUTION_LOGS",
              },
            },
            FINISHED_GETTING_EXECUTION_LOGS: {
              type: "final",
            },
          },
        },
      },
      onDone: {
        target: "IDLE",
        actions: [
          {
            type: "updateHasLoaded",
            params: { hasLoaded: true },
          },
          sendParent(({ context }) => ({
            type: "SET_STEP_LOGS_AND_OUTPUTS_CACHE",
            stepId: context["@input"].stepResult.id,
            cache: {
              output: context.output,
              logs: context.logs,
            },
          })),
        ],
      },
      onError: {
        target: "IDLE",
        actions: [
          {
            type: "updateHasLoaded",
            params: { hasLoaded: true },
          },
        ],
      },
    },
  },
});
