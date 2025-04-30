import type React from "react";
import { useWebviewMessage } from "@/hooks/useWebviewMessage";
import {
  Container,
  Title,
  Message,
  LastMessage,
  Button,
} from "@/views/prismatic/styles";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { PrismaticDummyMessage } from "@/views/prismatic/types";
import { useVSCodeState } from "@/hooks/useVSCodeState";

const App: React.FC = () => {
  const { state, updateState } = useVSCodeState({
    key: "mySetting",
    scope: "global",
    initialValue: "default",
  });

  const {
    state: message,
    postMessage,
    lastReceived,
    hasReceivedMessages,
  } = useWebviewMessage<PrismaticDummyMessage>(
    "prismatic.dummy",
    "This is to configure prismatic settings."
  );

  const handleSendMessage = () => {
    postMessage("Hello from React!");
  };

  return (
    <ThemeProvider>
      <Container>
        <Title>Welcome to Prismatic</Title>
        <Message>{message}</Message>
        <LastMessage>
          {hasReceivedMessages && (
            <p>Last message received: {lastReceived?.toLocaleTimeString()}</p>
          )}
        </LastMessage>
        <Button onClick={handleSendMessage}>Send Message to VS Code</Button>
        <p>Current value: {state}</p>
        <button onClick={() => updateState("new value")} type="button">
          Update State
        </button>
      </Container>
    </ThemeProvider>
  );
};

export default App;
