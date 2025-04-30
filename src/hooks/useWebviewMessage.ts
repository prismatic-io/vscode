import { useEffect, useCallback, useState } from "react";
import { MessageHandler } from "@utils/messageHandler";
import type { WebviewMessage } from "@typeDefs/messages";

const messageHandler = new MessageHandler();

export function useWebviewMessage<T extends WebviewMessage>(
  type: T["type"],
  payload?: T["payload"]
) {
  const [state, setState] = useState<T["payload"] | undefined>(payload);
  const [lastReceived, setLastReceived] = useState<Date | null>(null);

  useEffect(() => {
    const handleMessage = (message: WebviewMessage) => {
      if (message.type === type) {
        setState(message.payload);
        setLastReceived(new Date());
      }
    };

    messageHandler.on(type, handleMessage);
    return () => messageHandler.off(type, handleMessage);
  }, [type]);

  const postMessage = useCallback(
    (payload: T["payload"]) => {
      messageHandler.postMessage({ type, payload } as T);
    },
    [type]
  );

  return {
    state,
    postMessage,
    setState,
    lastReceived,
    hasReceivedMessages: lastReceived !== null,
  };
}
