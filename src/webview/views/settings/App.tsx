import type React from "react";
import { useWebviewMessage } from "@webview/lib/useWebviewMessage";
import { ThemeProvider } from "@webview/lib/theme/ThemeProvider";
import { useVSCodeState } from "@webview/lib/useVSCodeState";
import { Container, Title, Message, LastMessage, Button } from "./styles";

export const App: React.FC = () => {
  const { state, updateState } = useVSCodeState({
    key: "accessToken",
    scope: "global",
  });

  const { state: workspaceState, updateState: updateWorkspaceState } =
    useVSCodeState({
      key: "settings",
      scope: "workspace",
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
        <p>Integration Id: {workspaceState?.integrationId}</p>
        <button
          onClick={() => updateWorkspaceState({ integrationId: "123" })}
          type="button"
        >
          Update Workspace State
        </button>
      </Container>
    </ThemeProvider>
  );
};
