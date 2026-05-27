import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import type { AuthManager } from "@/extension/AuthManager";
import type { BatchProgressService } from "@/extension/executionResults/BatchProgressService";
import type { ExecutionResultsService } from "@/extension/executionResults/ExecutionResultsService";
import type { ExecutionResult } from "@/extension/executionResults/types";
import type { StateManager } from "@/extension/StateManager";
import { StatusBarManager } from "./StatusBarManager";

const makeExecution = (
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult => ({
  id: "exec-1",
  invokeType: null,
  startedAt: "2026-05-20T00:00:00Z",
  resultType: null,
  status: null,
  endedAt: null,
  error: null,
  stepResults: [],
  usesBatching: true,
  batchProgress: null,
  cancelRequestedAt: null,
  canceledBy: null,
  registeredBatchCount: null,
  triggerResolverBatchSize: null,
  ...overrides,
});

const makeAuthManager = (): AuthManager => {
  const emitter = new vscode.EventEmitter<void>();
  return {
    getCurrentUser: vi
      .fn()
      .mockResolvedValue({
        name: "n",
        email: "e",
        organization: "org",
        endpointUrl: "https://example",
      }),
    onDidChangeAuth: emitter.event,
  } as unknown as AuthManager;
};

const makeStateManager = (): StateManager => {
  return {
    getWorkspaceState: vi.fn().mockResolvedValue({}),
  } as unknown as StateManager;
};

const makeContext = (): vscode.ExtensionContext => {
  return {
    subscriptions: [] as { dispose: () => void }[],
  } as unknown as vscode.ExtensionContext;
};

const makeExecutionResultsService = (
  executions: ExecutionResult[],
): ExecutionResultsService => {
  return {
    getExecutions: () => executions,
    getExecution: (id: string) => executions.find((e) => e.id === id),
    onDidChangeExecutions: new vscode.EventEmitter().event,
  } as unknown as ExecutionResultsService;
};

const makeBatchService = (): BatchProgressService => {
  return {
    onDidChangeBatches: new vscode.EventEmitter<string>().event,
  } as unknown as BatchProgressService;
};

const makeTreeView = (visible = true): vscode.TreeView<unknown> => {
  return {
    visible,
    onDidChangeVisibility: new vscode.EventEmitter<{ visible: boolean }>()
      .event,
    reveal: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.TreeView<unknown>;
};

describe("StatusBarManager — batch indicator", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("hides the batch indicator without batched executions", () => {
    const mgr = new StatusBarManager(
      makeAuthManager(),
      makeStateManager(),
      makeContext(),
    );
    mgr.attachExecutionResults(
      makeExecutionResultsService([]),
      makeBatchService(),
      makeTreeView(),
    );
    // biome-ignore lint/suspicious/noExplicitAny: peek private field for assertion
    const item = (mgr as any).batchStatusBarItem;
    expect(item.visible).toBe(false);
  });

  it("renders running text with completed/total and failed", () => {
    const execution = makeExecution({
      batchProgress: {
        discovered: 5,
        discoveryComplete: true,
        completed: 3,
        failed: 1,
        canceled: 0,
        queued: 1,
        running: 1,
        total: 5,
        concurrencyLimit: null,
        concurrencyLimitSource: null,
      },
    });
    const mgr = new StatusBarManager(
      makeAuthManager(),
      makeStateManager(),
      makeContext(),
    );
    mgr.attachExecutionResults(
      makeExecutionResultsService([execution]),
      makeBatchService(),
      makeTreeView(true),
    );
    // biome-ignore lint/suspicious/noExplicitAny: peek private field for assertion
    const item = (mgr as any).batchStatusBarItem;
    expect(item.visible).toBe(true);
    expect(String(item.text)).toContain("3/5");
    expect(String(item.text)).toContain("1 failed");
  });

  it("hides when executions view is not visible", () => {
    const execution = makeExecution({
      batchProgress: {
        discovered: 5,
        discoveryComplete: true,
        completed: 1,
        failed: 0,
        canceled: 0,
        queued: 3,
        running: 1,
        total: 5,
        concurrencyLimit: null,
        concurrencyLimitSource: null,
      },
    });
    const mgr = new StatusBarManager(
      makeAuthManager(),
      makeStateManager(),
      makeContext(),
    );
    mgr.attachExecutionResults(
      makeExecutionResultsService([execution]),
      makeBatchService(),
      makeTreeView(false),
    );
    // biome-ignore lint/suspicious/noExplicitAny: peek private field for assertion
    const item = (mgr as any).batchStatusBarItem;
    expect(item.visible).toBe(false);
  });
});
