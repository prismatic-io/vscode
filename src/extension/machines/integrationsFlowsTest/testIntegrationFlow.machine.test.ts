import * as vscode from "vscode";
import { createActor } from "xstate";
import { log } from "@/extension";
import type { StateManager } from "@/extension/StateManager";
import type { Flow } from "@/types/flows";
import { InstanceConfigState } from "@/types/state";
import { testIntegrationFlowMachine } from "./testIntegrationFlow.machine";

vi.mock("@/extension", () => ({ log: vi.fn() }));

const buildFlow = (overrides: Partial<Flow>): Flow => ({
  id: "flow-id",
  name: "Flow",
  stableKey: "flow",
  isSynchronous: false,
  usesFifoQueue: false,
  endpointSecurityType: "UNSECURED",
  testUrl: "https://example.com",
  hasOrganizationApiKeys: false,
  ...overrides,
});

const sendTest = (configState: InstanceConfigState | null, flows: Flow[]) => {
  const actor = createActor(testIntegrationFlowMachine, {
    input: { stateManager: {} as StateManager },
  });
  actor.start();
  actor.send({
    type: "TEST_INTEGRATION",
    integrationId: "integration-id",
    accessToken: "token",
    prismaticUrl: "https://app.prismatic.io",
    configState,
    systemInstanceId: "instance-id",
    flows,
  });
  return actor;
};

describe("testIntegrationFlowMachine", () => {
  beforeEach(() => {
    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
  });

  it("reports the flow missing an Organization API key instead of opening the config wizard", () => {
    const actor = sendTest(InstanceConfigState.NEEDS_INSTANCE_CONFIGURATION, [
      buildFlow({ name: "Secured", endpointSecurityType: "ORGANIZATION" }),
    ]);

    expect(actor.getSnapshot().hasTag("idle")).toBe(true);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
      "prismatic.configWizard",
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "prismatic.integrationDetails.refresh",
    );
    expect(log).toHaveBeenCalledWith(
      "ERROR",
      expect.stringContaining(
        'Flow "Secured" requires an Organization API key',
      ),
      true,
    );
  });

  it("opens the config wizard when the instance needs configuration for another reason", () => {
    const actor = sendTest(InstanceConfigState.NEEDS_INSTANCE_CONFIGURATION, [
      buildFlow({
        name: "Secured",
        endpointSecurityType: "ORGANIZATION",
        hasOrganizationApiKeys: true,
      }),
    ]);

    expect(actor.getSnapshot().hasTag("idle")).toBe(true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "prismatic.configWizard",
    );
  });
});
