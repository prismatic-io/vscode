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
import type { ExecutionResultsExampleMessage } from "@/views/executionResults/typeDefs";

const App: React.FC = () => {
  const { message, postMessage, lastReceived, hasReceivedMessages } =
    useWebviewMessage("executionResults.example");

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
        <Button
          onClick={() => postMessage("Post an example message successfully")}
        >
          Send Example Message to VS Code
        </Button>
      </Container>
    </ThemeProvider>
  );
};

export default App;
