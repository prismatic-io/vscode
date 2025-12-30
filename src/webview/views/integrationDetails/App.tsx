import { useState, useCallback } from "react";
import type React from "react";
import { MessageHandlerManager } from "@extension/MessageHandlerManager";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";
import { useIntegrationContext } from "@/webview/providers/IntegrationProvider";
import type { Connection } from "@/webview/machines/integration/getIntegration";
import type { IntegrationDetailsMessage } from "@/webview/views/integrationDetails/types";
import styled from "styled-components";

const messageHandler = new MessageHandlerManager();

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

const StatusDot = styled.span<{
  $status?: "success" | "warning" | "error";
}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${({ $status }) => {
    switch ($status) {
      case "success":
        return "var(--vscode-testing-iconPassed)";
      case "warning":
        return "var(--vscode-editorWarning-foreground)";
      case "error":
        return "var(--vscode-testing-iconFailed)";
      default:
        return "currentColor";
    }
  }};
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

const ConnectionCard = styled.div`
  border-radius: 4px;
  background-color: var(--vscode-list-hoverBackground);
  overflow: hidden;
`;

const ConnectionHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--vscode-foreground);
  font-size: 12px;
  text-align: left;

  &:hover {
    background-color: var(--vscode-list-activeSelectionBackground);
  }
`;

const Chevron = styled.span<{ $expanded: boolean }>`
  transition: transform 0.2s;
  transform: rotate(${({ $expanded }) => ($expanded ? "90deg" : "0deg")});
  font-size: 10px;
`;

const ConnectionLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ConnectionDetails = styled.div`
  padding: 8px 12px 12px 28px;
  border-top: 1px solid var(--vscode-widget-border);
`;

const AuthenticateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
`;

const ConnectionActiveText = styled.span`
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
`;

const InfoMessage = styled.span`
  display: block;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  font-style: italic;
`;

const DetailRow = styled.div`
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
`;

const DetailLabel = styled.span`
  font-weight: 500;
  min-width: 80px;
`;

const DetailValue = styled.span`
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const WarningSection = styled.div`
  margin-top: 8px;
  padding: 8px;
  background-color: var(--vscode-inputValidation-warningBackground);
  border: 1px solid var(--vscode-inputValidation-warningBorder);
  border-radius: 4px;
`;

const WarningTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-editorWarning-foreground);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const WarningList = styled.ul`
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--vscode-foreground);
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

const getStatusDotColor = (
  status: string,
  hasMissingInputs: boolean,
): "success" | "warning" | "error" => {
  if (status === "ERROR") return "error";
  if (hasMissingInputs) return "warning";
  return "success";
};

const formatOAuth2Type = (type: string | null): string => {
  if (!type) return "Unknown";
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

const truncateScopes = (scopes: string | null, maxLength = 50): string => {
  if (!scopes) return "None";
  if (scopes.length <= maxLength) return scopes;
  return scopes.substring(0, maxLength) + "...";
};

export const App: React.FC = () => {
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(
    new Set(),
  );
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

  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAuthenticate = useCallback((connection: Connection) => {
    if (connection.authorizationUrl) {
      messageHandler.postMessage({
        type: "integrationDetails.authenticate",
        payload: {
          connectionId: connection.id,
          authorizationUrl: connection.authorizationUrl,
        },
      } as IntegrationDetailsMessage);
    }
  }, []);

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
                const isExpanded = expandedConnections.has(connection.id);
                const missingInputs = connection.inputs.filter(
                  (i) => !i.hasValue && i.name !== "scopes",
                );

                return (
                  <ConnectionCard key={connection.id}>
                    <ConnectionHeader
                      onClick={() => toggleConnection(connection.id)}
                    >
                      <Chevron $expanded={isExpanded}>▶</Chevron>
                      <ConnectionLabel>{connection.label}</ConnectionLabel>
                      <StatusDot
                        $status={getStatusDotColor(
                          connection.status,
                          missingInputs.length > 0,
                        )}
                      />
                    </ConnectionHeader>

                    {isExpanded && (
                      <ConnectionDetails>
                        {connection.oauth2Type && (
                          <DetailRow>
                            <DetailLabel>OAuth Type:</DetailLabel>
                            <DetailValue>
                              {formatOAuth2Type(connection.oauth2Type)}
                            </DetailValue>
                          </DetailRow>
                        )}

                        {connection.scopes && (
                          <DetailRow>
                            <DetailLabel>Scopes:</DetailLabel>
                            <DetailValue title={connection.scopes}>
                              {truncateScopes(connection.scopes)}
                            </DetailValue>
                          </DetailRow>
                        )}

                        {missingInputs.length > 0 && (
                          <WarningSection>
                            <WarningTitle>Missing Required Fields:</WarningTitle>
                            <WarningList>
                              {missingInputs.map((input) => (
                                <li key={input.name}>{input.label}</li>
                              ))}
                            </WarningList>
                          </WarningSection>
                        )}

                        {connection.oauth2Type === "AUTHORIZATION_CODE" ? (
                          connection.status === "ACTIVE" ? (
                            <ConnectionActiveText
                              style={{
                                marginTop:
                                  missingInputs.length > 0 ? "12px" : "8px",
                              }}
                            >
                              Connection is active
                            </ConnectionActiveText>
                          ) : connection.authorizationUrl ? (
                            <AuthenticateButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAuthenticate(connection);
                              }}
                              style={{
                                marginTop:
                                  missingInputs.length > 0 ? "12px" : "8px",
                              }}
                            >
                              Connect
                            </AuthenticateButton>
                          ) : (
                            <InfoMessage
                              style={{
                                marginTop:
                                  missingInputs.length > 0 ? "12px" : "8px",
                              }}
                            >
                              Complete setup in the configuration wizard
                            </InfoMessage>
                          )
                        ) : missingInputs.length > 0 ? (
                          <InfoMessage
                            style={{
                              marginTop: "12px",
                            }}
                          >
                            Visit the configuration wizard to provide missing
                            values
                          </InfoMessage>
                        ) : (
                          <ConnectionActiveText style={{ marginTop: "8px" }}>
                            Connection configured
                          </ConnectionActiveText>
                        )}
                      </ConnectionDetails>
                    )}
                  </ConnectionCard>
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
