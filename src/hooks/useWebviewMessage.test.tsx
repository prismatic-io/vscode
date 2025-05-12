import { renderHook, act } from "@testing-library/react";
import { useWebviewMessage } from "@hooks/useWebviewMessage";
import { MessageHandler } from "@utils/messageHandler";
import type { VSCodeMessage } from "@typeDefs/messages";
import type { ConfigWizardMessage } from "@/views/configWizard/types";
import type { ExecutionResultsMessage } from "@/views/executionResults/types";
import type { PrismaticMessage } from "@/views/prismatic/types";

// Mock the MessageHandler
jest.mock("@utils/messageHandler", () => {
  const mockHandlers = new Map<string, ((message: VSCodeMessage) => void)[]>();

  return {
    MessageHandler: jest.fn().mockImplementation(() => ({
      on: jest.fn((type: string, handler: (message: VSCodeMessage) => void) => {
        if (!mockHandlers.has(type)) {
          mockHandlers.set(type, []);
        }
        mockHandlers.get(type)?.push(handler);
      }),
      off: jest.fn(
        (type: string, handler: (message: VSCodeMessage) => void) => {
          const handlers = mockHandlers.get(type);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
              handlers.splice(index, 1);
            }
          }
        }
      ),
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
      dispose: jest.fn(),
    })),
  };
});

describe("useWebviewMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() =>
      useWebviewMessage<ConfigWizardMessage>("configWizard.update")
    );
    expect(result.current.state).toBeUndefined();
    expect(result.current.hasReceivedMessages).toBe(false);
    expect(result.current.lastReceived).toBeNull();
  });

  it("should initialize with provided initial state", () => {
    const initialState = "Welcome to the Configuration Wizard";
    const { result } = renderHook(() =>
      useWebviewMessage<ConfigWizardMessage>(
        "configWizard.update",
        initialState
      )
    );
    expect(result.current.state).toBe(initialState);
  });

  it("should update state when receiving a message", () => {
    const { result } = renderHook(() =>
      useWebviewMessage<ConfigWizardMessage>("configWizard.update")
    );
    const testMessage: ConfigWizardMessage = {
      type: "configWizard.update",
      payload: "Configuration updated successfully",
    };

    act(() => {
      const messageHandler = new MessageHandler();
      messageHandler.on("configWizard.update", (msg) => {
        result.current.setState(msg.payload);
      });
      messageHandler.postMessage(testMessage);
    });

    expect(result.current.state).toBe("Configuration updated successfully");
    expect(result.current.hasReceivedMessages).toBe(true);
    expect(result.current.lastReceived).toBeInstanceOf(Date);
  });

  it("should post messages correctly", () => {
    const { result } = renderHook(() =>
      useWebviewMessage<ConfigWizardMessage>("configWizard.update")
    );
    const testPayload = "Configuration completed successfully";

    act(() => {
      result.current.postMessage(testPayload);
    });

    const messageHandler = new MessageHandler();
    expect(messageHandler.postMessage).toHaveBeenCalledWith({
      type: "configWizard.update",
      payload: testPayload,
    });
  });

  it("should handle execution results messages", () => {
    const { result } = renderHook(() =>
      useWebviewMessage<ExecutionResultsMessage>("executionResults.update")
    );
    const testMessage: ExecutionResultsMessage = {
      type: "executionResults.update",
      payload: "Execution completed",
    };

    act(() => {
      const messageHandler = new MessageHandler();
      messageHandler.on("executionResults.update", (msg) => {
        result.current.setState(msg.payload);
      });
      messageHandler.postMessage(testMessage);
    });

    expect(result.current.state).toBe("Execution completed");
  });

  it("should handle prismatic messages", () => {
    const { result } = renderHook(() =>
      useWebviewMessage<PrismaticMessage>("prismatic.update")
    );
    const testMessage: PrismaticMessage = {
      type: "prismatic.update",
      payload: "Settings updated",
    };

    act(() => {
      const messageHandler = new MessageHandler();
      messageHandler.on("prismatic.update", (msg) => {
        result.current.setState(msg.payload);
      });
      messageHandler.postMessage(testMessage);
    });

    expect(result.current.state).toBe("Settings updated");
  });

  it("should clean up message handlers on unmount", () => {
    const { unmount } = renderHook(() =>
      useWebviewMessage<ConfigWizardMessage>("configWizard.update")
    );
    const messageHandler = new MessageHandler();

    unmount();

    expect(messageHandler.dispose).toHaveBeenCalled();
  });
});
