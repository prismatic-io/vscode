import * as vscode from "vscode";
import { type ActorRefFrom, assign, setup } from "xstate";
import { log } from "@/extension";
import { InstanceConfigState } from "./getIntegration";
import { testIntegrationFlow } from "./testIntegrationFlow";
import type { IntegrationData } from "@type/state";

type TestIntegrationFlowInput = {};

interface TestIntegrationFlowContext {
  configState: InstanceConfigState | null;
  flowId: string | null;
  integrationId: string | null;
  systemInstanceId: string | null;
  accessToken: string | null;
  prismaticUrl: string | null;
  testPayload: string | null;
  integration: IntegrationData | null;
  "@input": TestIntegrationFlowInput;
}

type TestIntegrationFlowEvents = {
  type: "TEST_INTEGRATION";
  integrationId: string;
  flowId?: string;
  accessToken: string;
  prismaticUrl: string;
  testPayload?: string;
  integration?: IntegrationData;
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
    isFullyConfigured: ({ context }) => {
      // First check if we have integration data
      if (context.integration?.systemInstance?.configState) {
        return context.integration.systemInstance.configState === "FULLY_CONFIGURED";
      }
      // Fall back to context.configState for backwards compatibility
      return context.configState === InstanceConfigState.FULLY_CONFIGURED;
    },
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
      testPayload: null,
      integration: null,
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
              testPayload: event.testPayload || null,
              integration: event.integration || null,
              configState: event.integration?.systemInstance?.configState
                ? event.integration.systemInstance.configState as InstanceConfigState
                : null,
              systemInstanceId: event.integration?.systemInstance?.id || null,
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
        testPayload: null,
        integration: null,
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
          entry: ({ context }) =>
            log("INFO", `Running test for flow: ${context.flowId}`),
          invoke: {
            id: "testIntegrationFlow",
            src: "testIntegrationFlow",
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              prismaticUrl: context.prismaticUrl!,
              flowId: context.flowId!,
              payload: context.testPayload,
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
