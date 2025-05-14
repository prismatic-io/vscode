import { useEffect, useCallback, useState } from "react";
import { MessageHandler } from "@/lib/MessageHandler";
import type { MessageType } from "@typeDefs/messages";

const messageHandler = new MessageHandler();

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

    messageHandler.on(type, handleMessage);

    return () => messageHandler.off(type, handleMessage);
  }, [type]);

  const postMessage = useCallback(
    (payload: Payload) => {
      messageHandler.postMessage({ type, payload } as Message);
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
