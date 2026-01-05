import * as vscode from "vscode";
import { type ActorRefFrom, assign, setup } from "xstate";
import { log } from "@/extension";
import { StateManager } from "@/extension/StateManager";
import type { Flow } from "@/types/flows";
import { InstanceConfigState } from "@/types/state";
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
  configState: InstanceConfigState | null;
  systemInstanceId: string;
  flows: Flow[];
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
              flowId: event.flowId || event.flows[0]?.id,
              accessToken: event.accessToken,
              prismaticUrl: event.prismaticUrl,
              configState: event.configState,
              systemInstanceId: event.systemInstanceId,
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
      initial: "CHECKING_CONFIGURATION",
      states: {
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
          entry: ({ context }) => {
            log("INFO", `Running test for flow: ${context.flowId}`);
            vscode.commands.executeCommand("executionResults.webview.focus");
          },
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
                    true,
                  ),
                () => {
                  StateManager.getInstance().notifyWebviews({
                    type: "executionResults.refetch",
                    payload: new Date().toISOString(),
                  });
                },
              ],
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
            onError: {
              actions: ({ event }) =>
                log(
                  "ERROR",
                  `Error running integration flow test. ${event.error}`,
                  true,
                ),
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
          },
        },
      },
    },
  },
});
