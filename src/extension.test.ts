import * as vscode from "vscode";
import { expect, describe, it } from "@jest/globals";
import { activate, deactivate } from "./extension";
import { StateManager } from "@/utils/stateManager";

// Mock vscode
jest.mock("vscode", () => ({
  ExtensionContext: jest.fn().mockImplementation(() => ({
    subscriptions: [],
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
    },
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
    },
  })),
  window: {
    registerWebviewViewProvider: jest.fn(),
    createWebviewPanel: jest.fn(),
  },
}));

// Mock view providers
jest.mock("@/views/prismatic/PrismaticViewProvider", () => ({
  createPrismaticViewProvider: jest.fn().mockReturnValue({
    dispose: jest.fn(),
  }),
}));

jest.mock("@/views/executionResults/ExecutionResultsViewProvider", () => ({
  createExecutionResultsViewProvider: jest.fn().mockReturnValue({
    dispose: jest.fn(),
  }),
}));

jest.mock("@/views/configWizard/ConfigWizardViewProvider", () => ({
  createConfigWizardPanel: jest.fn().mockReturnValue({
    dispose: jest.fn(),
  }),
}));

describe("Extension Test Suite", () => {
  it("should be present", () => {
    expect(vscode.extensions.getExtension("vscode")).toBeDefined();
  });

  it("should activate", async () => {
    const ext = vscode.extensions.getExtension("vscode");
    expect(ext).toBeDefined();
    await ext?.activate();
    expect(ext?.isActive).toBeTruthy();
  });

  it("should register all commands", async () => {
    const ext = vscode.extensions.getExtension("vscode");
    expect(ext).toBeDefined();
    await ext?.activate();

    const commands = await vscode.commands.getCommands(true);
    const extensionCommands = commands.filter((cmd) =>
      cmd.startsWith("vscode.")
    );
    expect(extensionCommands.length).toBeGreaterThan(0);
  });
});

describe("Extension", () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock context
    mockContext = {
      subscriptions: [],
      globalState: { get: jest.fn(), update: jest.fn() },
      workspaceState: { get: jest.fn(), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
  });

  describe("activate", () => {
    it("should initialize StateManager", () => {
      activate(mockContext);
      expect(StateManager.initialize).toHaveBeenCalledWith(mockContext);
    });

    it("should register Prismatic view provider", () => {
      const {
        createPrismaticViewProvider,
      } = require("@/views/prismatic/PrismaticViewProvider");
      activate(mockContext);
      expect(createPrismaticViewProvider).toHaveBeenCalledWith(mockContext);
      expect(mockContext.subscriptions).toContainEqual(expect.any(Object));
    });

    it("should register Execution Results view provider", () => {
      const {
        createExecutionResultsViewProvider,
      } = require("@/views/executionResults/ExecutionResultsViewProvider");
      activate(mockContext);
      expect(createExecutionResultsViewProvider).toHaveBeenCalledWith(
        mockContext
      );
      expect(mockContext.subscriptions).toContainEqual(expect.any(Object));
    });

    it("should register Config Wizard panel", () => {
      const {
        createConfigWizardPanel,
      } = require("@/views/configWizard/ConfigWizardViewProvider");
      activate(mockContext);
      expect(createConfigWizardPanel).toHaveBeenCalledWith(mockContext);
      expect(mockContext.subscriptions).toContainEqual(expect.any(Object));
    });
  });

  describe("deactivate", () => {
    it("should be defined", () => {
      expect(deactivate).toBeDefined();
    });

    it("should not throw when called", () => {
      expect(() => deactivate()).not.toThrow();
    });
  });

  describe("State Management", () => {
    // Removed tests for getState, updateState, getConfigWizardState, getExecutionResultsState, getPrismaticState
  });
});
