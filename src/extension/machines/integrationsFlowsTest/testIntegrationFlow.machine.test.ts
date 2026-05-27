import { describe, expect, it, vi } from "vitest";

vi.mock(import("@/extension"), () => ({
  log: vi.fn(),
}));

const testIntegrationFlowMock = vi.fn();

vi.mock(import("./testIntegrationFlow"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    testIntegrationFlow: {
      logic: testIntegrationFlowMock,
    } as never,
  };
});

import * as vscode from "vscode";
import { createActor, fromPromise } from "xstate";
import type { StateManager } from "@/extension/StateManager";
import { InstanceConfigState } from "@/types/state";
import { testIntegrationFlowMachine } from "./testIntegrationFlow.machine";

const flushTicks = async (n = 5) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe("testIntegrationFlowMachine", () => {
  it("dispatches subscribeBatched when the result is batched", async () => {
    const executeMock = vi
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValue(undefined as never);

    // Re-shape the mocked actor to a thenable success returning a batched result.
    const actor = createActor(
      testIntegrationFlowMachine.provide({
        actors: {
          testIntegrationFlow: fromPromise(async () => ({
            executionId: "exec-batched",
            usesBatching: true,
          })),
        },
      }),
      { input: { stateManager: {} as unknown as StateManager } },
    );
    actor.start();
    actor.send({
      type: "TEST_INTEGRATION",
      integrationId: "int-1",
      accessToken: "tok",
      prismaticUrl: "https://example",
      configState: InstanceConfigState.FULLY_CONFIGURED,
      systemInstanceId: "sys-1",
      flows: [{ id: "flow-1", name: "f", stableKey: "s" }],
    });

    await flushTicks();

    const calls = executeMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain("prismatic.executionResults.subscribeBatched");
    actor.stop();
  });

  it("does not dispatch subscribeBatched for non-batched runs", async () => {
    const executeMock = vi
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValue(undefined as never);

    const actor = createActor(
      testIntegrationFlowMachine.provide({
        actors: {
          testIntegrationFlow: fromPromise(async () => ({
            executionId: "exec-plain",
            usesBatching: false,
          })),
        },
      }),
      { input: { stateManager: {} as unknown as StateManager } },
    );
    actor.start();
    actor.send({
      type: "TEST_INTEGRATION",
      integrationId: "int-1",
      accessToken: "tok",
      prismaticUrl: "https://example",
      configState: InstanceConfigState.FULLY_CONFIGURED,
      systemInstanceId: "sys-1",
      flows: [{ id: "flow-1", name: "f", stableKey: "s" }],
    });

    await flushTicks();

    const calls = executeMock.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("prismatic.executionResults.subscribeBatched");
    actor.stop();
  });
});
