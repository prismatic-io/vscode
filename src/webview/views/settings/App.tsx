import type React from "react";
import { useWebviewMessage } from "@/webview/hooks/useWebviewMessage";
import { ThemeProvider } from "@/webview/providers/theme/ThemeProvider";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import {
  Container,
  Title,
  Message,
  LastMessage,
  Button,
} from "@/webview/views/settings/styles";

export const App: React.FC = () => {
  const { state: globalState, updateState } = useVSCodeState({
    scope: "global",
  });

  const { state: workspaceState, updateState: updateWorkspaceState } =
    useVSCodeState({
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
        <p>Token: {globalState?.accessToken}</p>
        <button
          onClick={() => updateState({ accessToken: "example value" })}
          type="button"
        >
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
