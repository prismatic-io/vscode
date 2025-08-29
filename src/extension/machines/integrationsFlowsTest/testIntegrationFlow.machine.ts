import * as vscode from "vscode";
import { type ActorRefFrom, assign, setup } from "xstate";
import { log } from "@/extension";
import { getIntegration, InstanceConfigState } from "./getIntegration";
import { testIntegrationFlow } from "./testIntegrationFlow";
import { isServerRunning, getPort, getPublicUrl } from "@/extension/honoServer";
import { FileSystemUtils } from "@/extension/fileSystemUtils";

type TestIntegrationFlowInput = {};

interface TestIntegrationFlowContext {
  configState: InstanceConfigState | null;
  flowId: string | null;
  integrationId: string | null;
  systemInstanceId: string | null;
  accessToken: string | null;
  prismaticUrl: string | null;
  serverUrl: string | null;
  "@input": TestIntegrationFlowInput;
}

type TestIntegrationFlowEvents = {
  type: "TEST_INTEGRATION";
  integrationId: string;
  flowId?: string;
  accessToken: string;
  prismaticUrl: string;
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
    prepareServerUrl: assign(({ context }) => {
      if (isServerRunning()) {
        // Just get the server URL - no session creation needed with global token approach
        let serverUrl = `http://localhost:${getPort()}`;
        
        // Try to get the public tunnel URL
        try {
          const publicUrl = getPublicUrl();
          if (publicUrl && !publicUrl.includes('localhost')) {
            serverUrl = publicUrl;
          }
        } catch (error) {
          // Fall back to localhost if public URL unavailable
        }
        
        return {
          serverUrl
        };
      }
      return {
        serverUrl: null
      };
    }),
    saveStepResults: async ({ context, event }: any) => {
      const executionId = event.output?.executionId;
      
      if (!executionId) {
        return;
      }

      // With the new approach, step results are saved directly to filesystem when HTTP requests arrive
      // We just need to wait a bit for the async execution to complete and send any step results
      
      // Wait 30 seconds for CNI calls to arrive and be saved directly to filesystem
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      try {
        // Check if execution directory was created (indicates step results were received)
        const { FileSystemUtils } = await import("@/extension/fileSystemUtils");
        const executionDir = FileSystemUtils.getExecutionDir(executionId);
        
        const { existsSync, readdirSync } = await import('fs');
        if (existsSync(executionDir)) {
          // Discover step names from saved files and update types
          try {
            const files = readdirSync(executionDir);
            const stepFiles = files.filter(file => file.startsWith('step-') && file.endsWith('.json'));
            const stepNames = stepFiles.map(file => {
              // Convert step-webhook-trigger.json back to webhook-trigger
              return file.replace('step-', '').replace('.json', '').replace(/-/g, '-');
            });
            
            if (stepNames.length > 0) {
              await FileSystemUtils.updateTypesFile(executionId, stepNames);
            }
          } catch (error) {
            console.error("Error updating types file:", error);
            // Don't fail the whole process if types update fails
          }
          
          log("SUCCESS", `Step results were saved directly for execution ${executionId}`);
        }
        
      } catch (error) {
        console.error("Error checking for step results:", error);
      }
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
      serverUrl: null,
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
            })),
          ],
          target: "#testIntegrationFlow.TESTING_INTEGRATION",
        },
      },
    },
    TESTING_INTEGRATION: {
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
              actions: [
                ({ event }) =>
                  log("ERROR", `Error fetching integration. ${event.error}`),
                assign({
                  accessToken: null,
                  configState: null,
                  flowId: null,
                  integrationId: null,
                  prismaticUrl: null,
                  systemInstanceId: null,
                }),
              ],
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
          always: [
            {
              actions: assign({
                accessToken: null,
                configState: null,
                flowId: null,
                integrationId: null,
                prismaticUrl: null,
                systemInstanceId: null,
              }),
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
          ],
        },
        EXECUTING_TEST: {
          entry: [
            ({ context }) => log("INFO", `Running test for flow: ${context.flowId}`),
            "prepareServerUrl"
          ],
          invoke: {
            id: "testIntegrationFlow",
            src: "testIntegrationFlow",
            input: ({ context }) => ({
              accessToken: context.accessToken!,
              prismaticUrl: context.prismaticUrl!,
              flowId: context.flowId!,
              serverUrl: context.serverUrl || undefined,
            }),
            onDone: {
              actions: [
                () =>
                  log(
                    "SUCCESS",
                    "Integration flow test completed successfully!",
                  ),
                "saveStepResults",
                assign({
                  accessToken: null,
                  configState: null,
                  flowId: null,
                  integrationId: null,
                  prismaticUrl: null,
                  systemInstanceId: null,
                  serverUrl: null,
                }),
              ],
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
            onError: {
              actions: [
                ({ event }) =>
                  log(
                    "ERROR",
                    `Error running integration flow test. ${event.error}`
                  ),
                assign({
                  accessToken: null,
                  configState: null,
                  flowId: null,
                  integrationId: null,
                  prismaticUrl: null,
                  systemInstanceId: null,
                  serverUrl: null,
                }),
              ],
              target: "#testIntegrationFlow.WAITING_FOR_TEST",
            },
          },
        },
      },
    },
  },
});
