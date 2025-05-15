import type React from "react";
import { useWebviewMessage } from "@/hooks/useWebviewMessage";
import {
  Container,
  Title,
  Message,
  LastMessage,
  Button,
} from "@/views/settings/styles";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { SettingsExampleMessage } from "@/views/settings/typeDefs";
import { useVSCodeState } from "@/hooks/useVSCodeState";
import { useEffect } from "react";

const App: React.FC = () => {
  const { state, updateState } = useVSCodeState({
    key: "accessToken",
    scope: "global",
  });

  const { message, postMessage, lastReceived, hasReceivedMessages } =
    useWebviewMessage("settings.example");

  return (
    <ThemeProvider>
      <Container>
        <Title>Settings</Title>
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
        <p>Token: {state}</p>
        <button onClick={() => updateState("example value")} type="button">
          Update Token
        </button>
      </Container>
    </ThemeProvider>
  );
};

export default App;
