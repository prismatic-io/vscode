import { type ActorRefFrom, assign, setup } from "xstate";
import { getExecutionLogs } from "@/webview/views/executionResults/machines/stepOutputs/getExecutionLogs";
import { getStepOutputs } from "@/webview/views/executionResults/machines/stepOutputs/getStepOutputs";
import type {
  ExecutionLogs,
  StepResult,
} from "@/webview/views/executionResults/types";

interface StepOutputsInput {
  accessToken: string;
  prismaticUrl: string;
  executionResultId: string;
  stepResult: StepResult;
  startDate: string;
}

interface StepOutputsContext {
  output: {
    data: unknown;
    message: string | null;
  };
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
    updateStepOutput: assign(
      (
        _,
        params: {
          output: {
            data: unknown;
            message: string | null;
          };
        }
      ) => {
        return {
          output: params.output,
        };
      }
    ),
    updateLogs: assign(({ context }, params: { logs: ExecutionLogs }) => {
      const stepLogs = params.logs.filter(
        (log) => log.stepName === context["@input"].stepResult.stepName
      );

      return {
        logs: stepLogs,
      };
    }),
  },
  actors: {
    getStepOutputs,
    getExecutionLogs,
  },
  guards: {
    hasExecutionResultId: ({ context }) =>
      Boolean(context["@input"].executionResultId),
  },
}).createMachine({
  id: "stepOutputs",
  initial: "INITIALIZING",
  context: ({ input }) => {
    const context: StepOutputsContext = {
      output: {
        data: null,
        message: null,
      },
      logs: null,
      hasLoaded: false,
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
      always: [{ target: "FETCHING" }],
    },
    FETCHING: {
      tags: "loading",
      type: "parallel",
      states: {
        FETCHING_OUTPUTS: {
          initial: "INVOKING",
          states: {
            INVOKING: {
              tags: "loading",
              invoke: {
                src: "getStepOutputs",
                input: ({ context }) => ({
                  resultsMetadataUrl:
                    context["@input"].stepResult.resultsMetadataUrl,
                  resultsUrl: context["@input"].stepResult.resultsUrl,
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
                  target: "FINISHED_INVOKING",
                },
                onError: {
                  target: "FINISHED_INVOKING",
                },
              },
            },
            FINISHED_INVOKING: {
              type: "final",
            },
          },
        },
        FETCHING_LOGS: {
          initial: "INVOKING",
          states: {
            INVOKING: {
              tags: "loading",
              invoke: {
                src: "getExecutionLogs",
                input: ({ context }) => ({
                  cursor: null,
                  accessToken: context["@input"].accessToken,
                  prismaticUrl: context["@input"].prismaticUrl,
                  executionId: context["@input"].executionResultId,
                  startDate: context["@input"].startDate,
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
                  target: "FINISHED_INVOKING",
                },
                onError: {
                  target: "FINISHED_INVOKING",
                },
              },
            },
            FINISHED_INVOKING: {
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
