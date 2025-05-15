import { useCallback, useState, useEffect } from "react";
import type { StateChangeMessage, MessageType } from "@typeDefs/messages";
import type { GlobalState, WorkspaceState } from "@typeDefs/state";
import { MessageHandler } from "@/lib/MessageHandler";

const messageHandler = new MessageHandler();

type StateValue<T, K> = T extends "global"
  ? K extends keyof GlobalState
    ? Partial<GlobalState[K]>
    : never
  : K extends keyof WorkspaceState
  ? Partial<WorkspaceState[K]>
  : never;

interface StateOptions<T extends "global" | "workspace", K> {
  key: K;
  scope: T;
  initialValue?: StateValue<T, K>;
}

export function useVSCodeState<
  T extends "global" | "workspace",
  K extends T extends "global" ? keyof GlobalState : keyof WorkspaceState
>(options: StateOptions<T, K>) {
  const [state, setState] = useState<StateValue<T, K> | undefined>(
    options.initialValue
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // note: get initial state
  useEffect(() => {
    messageHandler.postMessage({
      type: "getState",
      payload:
        options.scope === "global"
          ? {
              scope: "global",
              key: options.key as keyof GlobalState,
            }
          : {
              scope: "workspace",
              key: options.key as keyof WorkspaceState,
            },
    });
  }, [options.key, options.scope]);

  // note: update state
  const updateState = useCallback(
    (newValue: StateValue<T, K>) => {
      try {
        messageHandler.postMessage({
          type: "stateChange",
          payload:
            options.scope === "global"
              ? {
                  scope: "global",
                  key: options.key as keyof GlobalState,
                  value: newValue as GlobalState[keyof GlobalState],
                }
              : {
                  scope: "workspace",
                  key: options.key as keyof WorkspaceState,
                  value: newValue as WorkspaceState[keyof WorkspaceState],
                },
        });
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

  useEffect(() => {
    const handleMessage = (message: MessageType) => {
      if (message.type === "stateChange" || message.type === "getState") {
        if (
          message.payload.scope === options.scope &&
          message.payload.key === options.key
        ) {
          const newValue = message.payload.value as StateValue<T, K>;

          setState(newValue);
          setIsLoading(false);
          setError(null);
        }
      }
    };

    messageHandler.on("stateChange", handleMessage);
    messageHandler.on("getState", handleMessage);

    return () => {
      messageHandler.off("stateChange", handleMessage);
      messageHandler.off("getState", handleMessage);
    };
  }, [options.key, options.scope]);

  return {
    state,
    updateState,
    isLoading,
    error,
  } as const;
}
