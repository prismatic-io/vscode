import type React from "react";
import { useWebviewMessage } from "@/hooks/useWebviewMessage";
import {
  Container,
  Title,
  Message,
  LastMessage,
  Button,
} from "@/views/executionResults/styles";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { ExecutionResultsDummyMessage } from "@/views/executionResults/types";

const App: React.FC = () => {
  const {
    state: message,
    postMessage,
    lastReceived,
    hasReceivedMessages,
  } = useWebviewMessage<ExecutionResultsDummyMessage>(
    "executionResults.dummy",
    "This is to display execution results."
  );

  const handleSendMessage = () => {
    postMessage("Hello from Execution Results!");
  };

  return (
    <ThemeProvider>
      <Container>
        <Title>Execution Results</Title>
        <Message>{message}</Message>
        <LastMessage>
          {hasReceivedMessages && (
            <p>Last message received: {lastReceived?.toLocaleTimeString()}</p>
          )}
        </LastMessage>
        <Button onClick={handleSendMessage}>Send Message to VS Code</Button>
      </Container>
    </ThemeProvider>
  );
};

export default App;
