import { MessageHandlerManager } from "@extension/MessageHandlerManager";
import type { MessageType } from "@type/messages";
import type { GlobalState, WorkspaceState } from "@type/state";
import { useCallback, useEffect, useState } from "react";

const messageHandlerManager = new MessageHandlerManager();

type StateValue<T> = T extends "global" ? GlobalState : WorkspaceState;

interface StateOptions<T extends "global" | "workspace"> {
  scope: T;
  initialValue?: StateValue<T>;
}

export function useVSCodeState<T extends "global" | "workspace">(
  options: StateOptions<T>,
) {
  const [state, setState] = useState<StateValue<T> | undefined>(
    options.initialValue,
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // get initial state
  useEffect(() => {
    messageHandlerManager.postMessage({
      type: "getState",
      payload:
        options.scope === "global"
          ? {
              scope: "global",
            }
          : {
              scope: "workspace",
            },
    });
  }, [options.scope]);

  // update state
  const updateState = useCallback(
    (newValue: Partial<StateValue<T>>) => {
      try {
        messageHandlerManager.postMessage({
          type: "stateChange",
          payload:
            options.scope === "global"
              ? {
                  scope: "global",
                  value: newValue,
                }
              : {
                  scope: "workspace",
                  value: newValue,
                },
        });

        setError(null);
      } catch (err) {
        const error =
          err instanceof Error ? err.message : "Failed to update state";

        console.error("[useVSCodeState]", error);
        setError(error);
      }
    },
    [options.scope],
  );

  // listen for state changes from the extension
  useEffect(() => {
    const handleMessage = (message: MessageType) => {
      if (
        message.type === "stateChange" &&
        message.payload.scope === options.scope
      ) {
        const newValue = message.payload.value as StateValue<T>;

        setState(newValue);
        setError(null);
      }

      if (
        message.type === "getState" &&
        message.payload.scope === options.scope
      ) {
        setState(message.payload.value as StateValue<T>);
        setHasLoaded(true);
      }
    };

    messageHandlerManager.on("stateChange", handleMessage);
    messageHandlerManager.on("getState", handleMessage);

    return () => {
      messageHandlerManager.off("stateChange", handleMessage);
      messageHandlerManager.off("getState", handleMessage);
    };
  }, [options.scope]);

  return {
    state,
    updateState,
    hasLoaded,
    error,
  };
}
