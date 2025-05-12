import { useCallback, useState, useEffect } from "react";
import type { WebviewMessage, StateChangeMessage } from "@typeDefs/messages";
import { MessageHandler } from "@utils/messageHandler";

const messageHandler = new MessageHandler();

export function useVSCodeState<T>(options: {
  key: string;
  scope: "global" | "workspace";
  initialValue?: T;
}) {
  const [state, setState] = useState<T | undefined>(options.initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to send state change message to VS Code
  const updateState = useCallback(
    (newValue: T) => {
      const message: StateChangeMessage = {
        type: "stateChange",
        payload: {
          scope: options.scope,
          key: options.key,
          value: newValue,
        },
      };

      try {
        messageHandler.postMessage(message);
        setState(newValue);
        setError(null);
      } catch (err) {
        const error =
          err instanceof Error ? err.message : "Failed to update state";
        console.error("[useVSCodeState]", error);
        setError(error);
      }
    },
    [options.key, options.scope]
  );

  // Listen for state changes from VS Code
  useEffect(() => {
    const handleMessage = (message: WebviewMessage) => {
      if (
        message.type === "stateChange" &&
        (message as StateChangeMessage).payload.scope === options.scope &&
        (message as StateChangeMessage).payload.key === options.key
      ) {
        const newValue = (message as StateChangeMessage).payload.value as T;

        setState(newValue);
        setIsLoading(false);
        setError(null);
      }
    };

    messageHandler.on("stateChange", handleMessage);
    return () => messageHandler.off("stateChange", handleMessage);
  }, [options.key, options.scope]);

  return {
    state,
    updateState,
    isLoading,
    error,
  };
}
