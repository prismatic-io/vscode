import { useCallback, useState, useEffect } from "react";
import type { MessageType } from "@type/messages";
import type { GlobalState, WorkspaceState } from "@type/state";
import { MessageHandlerManager } from "@extension/MessageHandlerManager";

const messageHandlerManager = new MessageHandlerManager();

type StateValue<T, K> = T extends "global"
  ? K extends keyof GlobalState
    ? GlobalState[K]
    : never
  : K extends keyof WorkspaceState
  ? WorkspaceState[K]
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
    messageHandlerManager.postMessage({
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
    (newValue: Partial<StateValue<T, K>>) => {
      try {
        messageHandlerManager.postMessage({
          type: "stateChange",
          payload:
            options.scope === "global"
              ? {
                  scope: "global",
                  key: options.key as keyof GlobalState,
                  value: newValue as unknown as GlobalState[keyof GlobalState],
                }
              : {
                  scope: "workspace",
                  key: options.key as keyof WorkspaceState,
                  value:
                    newValue as unknown as WorkspaceState[keyof WorkspaceState],
                },
        });
        setState(newValue as StateValue<T, K>);
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

  // note: listen for state changes from the extension
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

    messageHandlerManager.on("stateChange", handleMessage);
    messageHandlerManager.on("getState", handleMessage);

    return () => {
      messageHandlerManager.off("stateChange", handleMessage);
      messageHandlerManager.off("getState", handleMessage);
    };
  }, [options.key, options.scope]);

  return {
    state,
    updateState,
    isLoading,
    error,
  };
}
