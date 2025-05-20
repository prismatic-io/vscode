import { useCallback, useEffect, useState } from "react";
import { MessageHandlerManager } from "@extension/MessageHandlerManager";
import type { MessageType } from "@type/messages";

const messageHandlerManager = new MessageHandlerManager();

type MessageMap = {
  [K in MessageType["type"]]: Extract<MessageType, { type: K }>;
};

export function useWebviewMessage<T extends MessageType["type"]>(type: T) {
  type Message = MessageMap[T];
  type Payload = Message["payload"];

  const [message, setMessage] = useState<Payload>();
  const [lastReceived, setLastReceived] = useState<Date | null>(null);

  useEffect(() => {
    const handleMessage = (message: MessageType) => {
      if (message.type === type) {
        const payload = message.payload as Payload;

        setMessage(payload);
        setLastReceived(new Date());
      }
    };

    messageHandlerManager.on(type, handleMessage);

    return () => messageHandlerManager.off(type, handleMessage);
  }, [type]);

  const postMessage = useCallback(
    (payload: Payload) => {
      messageHandlerManager.postMessage({ type, payload } as Message);
    },
    [type]
  );

  return {
    message,
    postMessage,
    setMessage,
    lastReceived,
    hasReceivedMessages: lastReceived !== null,
  };
}
