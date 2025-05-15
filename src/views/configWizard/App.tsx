import type React from "react";
import { useWebviewMessage } from "@/hooks/useWebviewMessage";
import {
  Container,
  Title,
  Message,
  LastMessage,
  Button,
} from "@/views/configWizard/styles";
import { ThemeProvider } from "@/theme/ThemeProvider";

export const App: React.FC = () => {
  const { message, postMessage, lastReceived, hasReceivedMessages } =
    useWebviewMessage("configWizard.example");

  return (
    <ThemeProvider>
      <Container>
        <Title>Configuration Wizard</Title>
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
