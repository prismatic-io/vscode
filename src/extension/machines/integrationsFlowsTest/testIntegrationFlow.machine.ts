import * as vscode from "vscode";
import { type ActorRefFrom, assign, setup } from "xstate";
import { log } from "@/extension";
import type { StateManager } from "@/extension/StateManager";
import {
  getFlowNamesMissingOrgApiKeys,
  getMissingOrgApiKeysMessage,
} from "@/shared/missingOrgApiKeys";
import type { Flow } from "@/types/flows";
import { InstanceConfigState } from "@/types/state";
import { testIntegrationFlow } from "./testIntegrationFlow";

type TestIntegrationFlowInput = {
  stateManager: StateManager;
};

interface TestIntegrationFlowContext {
  configState: InstanceConfigState | null;
  flows: Flow[];
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
    reportMissingOrgApiKeys: ({ context }) => {
      const message = getMissingOrgApiKeysMessage(
        getFlowNamesMissingOrgApiKeys(context.flows),
      );
      log(
        "ERROR",
        `Unable to run test. ${message}. Add organizationApiKeys to the flow definition, then import the integration and try again.`,
        true,
      );
      // The import command refreshes integration details itself; this covers
      // a fix imported outside the extension, e.g. with prism in a terminal.
      vscode.commands.executeCommand("prismatic.integrationDetails.refresh");
    },
  },
  guards: {
    hasFlowsMissingOrgApiKeys: ({ context }) =>
      getFlowNamesMissingOrgApiKeys(context.flows).length > 0,
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
      flows: [],
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
              flows: event.flows,
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
        flows: [],
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
            // Checked ahead of config state: a missing Organization API key
            // keeps the instance from ever reading as fully configured, and
            // it lives in the flow definition rather than the config wizard.
            {
              guard: "hasFlowsMissingOrgApiKeys",
              target:
                "#testIntegrationFlow.TESTING_INTEGRATION.MISSING_ORG_API_KEYS",
            },
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
        MISSING_ORG_API_KEYS: {
          entry: "reportMissingOrgApiKeys",
          always: [{ target: "#testIntegrationFlow.WAITING_FOR_TEST" }],
        },
        CONFIGURING_INSTANCE: {
          entry: [
            () =>
              log(
                "WARN",
                "Opening config wizard. Complete the instance setup, then proceed with a new test.",
                true,
              ),
            "configureInstance",
          ],
          always: [{ target: "#testIntegrationFlow.WAITING_FOR_TEST" }],
        },
        EXECUTING_TEST: {
          entry: ({ context }) => {
            log("INFO", `Running test for flow: ${context.flowId}`);
            vscode.commands.executeCommand(
              "prismatic.executionResultsView.focus",
            );
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
                  vscode.commands.executeCommand(
                    "prismatic.executionResults.refresh",
                  );
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
