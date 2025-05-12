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
import type { ConfigWizardDummyMessage } from "@/views/configWizard/types";

const App: React.FC = () => {
  const {
    state: message,
    postMessage,
    lastReceived,
    hasReceivedMessages,
  } = useWebviewMessage<ConfigWizardDummyMessage>(
    "configWizard.dummy",
    "Welcome to the Configuration Wizard"
  );

  const handleComplete = () => {
    postMessage("Configuration completed successfully");
  };

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
        <Button onClick={handleComplete}>Complete Configuration</Button>
      </Container>
    </ThemeProvider>
  );
};

export default App;
