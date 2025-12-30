import type React from "react";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import { useIntegrationContext } from "@/webview/providers/IntegrationProvider";
import styled from "styled-components";

const Container = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--vscode-sideBar-background);
  min-height: 100vh;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.h3`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  margin: 0;
`;

const IntegrationName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
`;

const StatusBadge = styled.span<{ $status?: "success" | "warning" | "unknown" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  background-color: ${({ $status }) => {
    switch ($status) {
      case "success":
        return "var(--vscode-testing-iconPassed)";
      case "warning":
        return "var(--vscode-editorWarning-foreground)";
      default:
        return "var(--vscode-descriptionForeground)";
    }
  }};
  color: var(--vscode-editor-background);
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ListItem = styled.li`
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--vscode-list-hoverBackground);
  color: var(--vscode-foreground);
`;

const ConnectionItem = styled(ListItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const ConnectionLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ConnectionStatusBadge = styled.span<{
  $status?: "success" | "warning" | "error" | "unknown";
}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-transform: uppercase;
  background-color: ${({ $status }) => {
    switch ($status) {
      case "success":
        return "var(--vscode-testing-iconPassed)";
      case "warning":
        return "var(--vscode-editorWarning-foreground)";
      case "error":
        return "var(--vscode-testing-iconFailed)";
      default:
        return "var(--vscode-descriptionForeground)";
    }
  }};
  color: var(--vscode-editor-background);
`;

const LoadingText = styled.div`
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
`;

const getConfigStateDisplay = (
  configState: string | null,
): { label: string; status: "success" | "warning" | "unknown" } => {
  switch (configState) {
    case "FULLY_CONFIGURED":
      return { label: "Fully Configured", status: "success" };
    case "NEEDS_INSTANCE_CONFIGURATION":
      return { label: "Needs Instance Configuration", status: "warning" };
    case "NEEDS_USER_LEVEL_CONFIGURATION":
      return { label: "Needs User Configuration", status: "warning" };
    default:
      return { label: "Unknown", status: "unknown" };
  }
};

const getConnectionStatusDisplay = (
  status: string,
): { label: string; status: "success" | "warning" | "error" | "unknown" } => {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", status: "success" };
    case "PENDING":
      return { label: "Pending", status: "warning" };
    case "ERROR":
      return { label: "Error", status: "error" };
    default:
      return { label: status || "Unknown", status: "unknown" };
  }
};

export const App: React.FC = () => {
  const { state: workspaceState } = useVSCodeState({
    scope: "workspace",
  });
  const { flows, connections, configState, isLoading } =
    useIntegrationContext();

  const integrationPath = workspaceState?.activeIntegrationPath;
  const integrationName = integrationPath
    ? integrationPath.split("/").pop()
    : null;

  const configStateDisplay = getConfigStateDisplay(configState);

  return (
    <Container>
      <Section>
        <SectionTitle>Active Integration</SectionTitle>
        <IntegrationName>{integrationName ?? "Loading..."}</IntegrationName>
      </Section>

      <Section>
        <SectionTitle>System Instance</SectionTitle>
        <div>
          {isLoading ? (
            <LoadingText>Loading...</LoadingText>
          ) : (
            <StatusBadge $status={configStateDisplay.status}>
              <StatusDot />
              {configStateDisplay.label}
            </StatusBadge>
          )}
        </div>
      </Section>

      {connections.length > 0 && (
        <Section>
          <SectionTitle>Connections</SectionTitle>
          {isLoading ? (
            <LoadingText>Loading...</LoadingText>
          ) : (
            <List>
              {connections.map((connection) => {
                const statusDisplay = getConnectionStatusDisplay(
                  connection.status,
                );
                return (
                  <ConnectionItem key={connection.id}>
                    <ConnectionLabel>{connection.label}</ConnectionLabel>
                    <ConnectionStatusBadge $status={statusDisplay.status}>
                      {statusDisplay.label}
                    </ConnectionStatusBadge>
                  </ConnectionItem>
                );
              })}
            </List>
          )}
        </Section>
      )}

      <Section>
        <SectionTitle>Flows</SectionTitle>
        {isLoading ? (
          <LoadingText>Loading...</LoadingText>
        ) : (
          <List>
            {flows.map((flow) => (
              <ListItem key={flow.id}>{flow.name}</ListItem>
            ))}
          </List>
        )}
      </Section>
    </Container>
  );
};
