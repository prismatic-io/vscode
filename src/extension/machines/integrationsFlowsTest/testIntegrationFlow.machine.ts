import * as vscode from "vscode";
import { type ActorRefFrom, assign, setup } from "xstate";
import { log } from "@/extension";
import { getIntegration, InstanceConfigState } from "./getIntegration";
import { testIntegrationFlow } from "./testIntegrationFlow";

type TestIntegrationFlowInput = {};

interface TestIntegrationFlowContext {
  configState: InstanceConfigState | null;
  flowId: string | null;
  integrationId: string | null;
  systemInstanceId: string | null;
  accessToken: string | null;
  prismaticUrl: string | null;
  payload?: string;
  contentType?: string;
  headers?: string;
  "@input": TestIntegrationFlowInput;
}

type TestIntegrationFlowEvents = {
  type: "TEST_INTEGRATION";
  integrationId: string;
  flowId?: string;
  accessToken: string;
  prismaticUrl: string;
  payload?: string;
  contentType?: string;
  headers?: string;
};

type TestIntegrationFlowTags = "idle" | "testing";

export type TestIntegrationFlowMachineActorRef = ActorRefFrom<
  typeof testIntegrationFlowMachine
>;

export const testIntegrationFlowMachine = setup({
  types: {
    context: {} as TestIntegrationFlowContext,
    events: {} as TestIntegrationFlowEvents,
    input: {} as TestIntegrationFlowInput,
    tags: {} as TestIntegrationFlowTags,
  },
  actions: {
    configureInstance: async () => {
      await vscode.commands.executeCommand("prismatic.configWizard");
    },
  },
  guards: {
    isFullyConfigured: ({ context }) =>
      context.configState === InstanceConfigState.FULLY_CONFIGURED,
  },
  actors: {
    getIntegration,
    testIntegrationFlow,
  },
}).createMachine({
  id: "testIntegrationFlow",
  initial: "WAITING_FOR_TEST",
  context: ({ input }) => {
    const context: TestIntegrationFlowContext = {
      configState: null,
      flowId: null,
      integrationId: null,
      systemInstanceId: null,
      accessToken: null,
      prismaticUrl: null,
      "@input": input,
    };

    return context;
  },
  states: {
    WAITING_FOR_TEST: {
      tags: "idle",
      on: {
        TEST_INTEGRATION: {
          actions: [
            assign(({ event }) => ({
              integrationId: event.integrationId,
              flowId: event.flowId,
              accessToken: event.accessToken,
              prismaticUrl: event.prismaticUrl,
              payload: event.payload,
              contentType: event.contentType,
              headers: event.headers,
            })),
          ],
          target: "#testIntegrationFlow.TESTING_INTEGRATION",
        },
      },
    },
    TESTING_INTEGRATION: {
      exit: assign({
        accessToken: null,
        configState: null,
        flowId: null,
        integrationId: null,
        prismaticUrl: null,
        systemInstanceId: null,
      }),
      tags: "testing",
      initial: "LOADING_INTEGRATION",
      states: {
        LOADING_INTEGRATION: {
          entry: ({ context }) =>
            log("INFO", `Fetching integration: ${context.integrationId}`),
          invoke: {
            id: "getIntegration",
            src: "getIntegration",
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              prismaticUrl: context.prismaticUrl!,
              integrationId: context.integrationId!,
            }),
            onDone: {
              actions: [
                assign(({ context, event }) => ({
                  configState: event.output.configState,
                  systemInstanceId: event.output.systemInstanceId,
                  flowId: context.flowId || event.output.initialFlow?.id,
                })),
              ],
              target:
                "#testIntegrationFlow.TESTING_INTEGRATION.CHECKING_CONFIGURATION",
            },
            onError: {
              actions: ({ event }) =>
                log("ERROR", `Error fetching integration. ${event.error}`),
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
          },
        },
        CHECKING_CONFIGURATION: {
          entry: ({ context }) =>
            log("INFO", `Checking config state: ${context.configState}`),
          always: [
            {
              guard: "isFullyConfigured",
              target: "#testIntegrationFlow.TESTING_INTEGRATION.EXECUTING_TEST",
            },
            {
              target:
                "#testIntegrationFlow.TESTING_INTEGRATION.CONFIGURING_INSTANCE",
            },
          ],
        },
        CONFIGURING_INSTANCE: {
          entry: [
            () =>
              log(
                "WARN",
                "Opening config wizard. Complete the instance setup, then proceed with a new test.",
              ),
            "configureInstance",
          ],
          always: [{ target: "#testIntegrationFlow.WAITING_FOR_TEST" }],
        },
        EXECUTING_TEST: {
          entry: ({ context }) =>
            log("INFO", `Running test for flow: ${context.flowId}`),
          invoke: {
            id: "testIntegrationFlow",
            src: "testIntegrationFlow",
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              prismaticUrl: context.prismaticUrl!,
              flowId: context.flowId!,
              payload: context.payload,
              headers: context.headers,
              contentType: context.contentType,
            }),
            onDone: {
              actions: [
                () =>
                  log(
                    "SUCCESS",
                    "Integration flow test completed successfully!",
                  ),
              ],
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
            onError: {
              actions: ({ event }) =>
                log(
                  "ERROR",
                  `Error running integration flow test. ${event.error}`,
                ),
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
          },
        },
      },
    },
  },
});
