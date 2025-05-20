import type React from "react";
import { useWebviewMessage } from "@webview/lib/useWebviewMessage";
import { useExecutionResultsContext } from "./ExecutionResultsProvider";
import { Container, Title, Message, LastMessage, Button } from "./styles";

export const App: React.FC = () => {
  const { executionResults, refetch, isLoading } = useExecutionResultsContext();

  const { message, postMessage, lastReceived, hasReceivedMessages } =
    useWebviewMessage("executionResults.example");

  return (
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
  );
};
