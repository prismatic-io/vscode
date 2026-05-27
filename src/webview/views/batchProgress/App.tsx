import { messageHandlerManager } from "@extension/MessageHandlerManager";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import type {
  BatchExecutionSnapshot,
  ExecutionBatchNode,
} from "@/extension/executionResults/types";
import type {
  BatchProgressMessage,
  BatchProgressUpdateMessage,
} from "@/webview/views/batchProgress/types";

const Container = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
  min-height: 100vh;
  font-family: var(--vscode-font-family);
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
`;

const Subtitle = styled.div`
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
`;

const Bar = styled.div`
  width: 100%;
  height: 12px;
  background-color: var(--vscode-input-background);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
`;

const Segment = styled.div<{ $color: string; $width: number }>`
  height: 100%;
  width: ${({ $width }) => $width}%;
  background-color: ${({ $color }) => $color};
  transition: width 200ms ease;
`;

const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Swatch = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: ${({ $color }) => $color};
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button`
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-size: 12px;
  &:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled(Button)`
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  &:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }
`;

const BatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const BatchTile = styled.button<{ $color: string }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--vscode-widget-border);
  background-color: var(--vscode-editorWidget-background);
  text-align: left;
  cursor: pointer;
  border-left: 4px solid ${({ $color }) => $color};
  color: var(--vscode-foreground);
  &:hover {
    background-color: var(--vscode-list-hoverBackground);
  }
`;

const TileLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TileMeta = styled.span`
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
`;

const EmptyState = styled.div`
  text-align: center;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  padding: 32px;
`;

const COLORS = {
  success: "var(--vscode-testing-iconPassed, #3fb950)",
  fail: "var(--vscode-testing-iconFailed, #f85149)",
  running: "var(--vscode-progressBar-background, #0078d4)",
  queued: "var(--vscode-disabledForeground, #6e7681)",
  partial: "var(--vscode-editorWarning-foreground, #d29922)",
  canceled: "var(--vscode-descriptionForeground, #8b949e)",
};

const colorFor = (status: ExecutionBatchNode["status"]): string => {
  switch (status) {
    case "success":
      return COLORS.success;
    case "fail":
      return COLORS.fail;
    case "running":
      return COLORS.running;
    case "partial":
      return COLORS.partial;
    default:
      return COLORS.queued;
  }
};

const buildSegments = (snapshot: BatchExecutionSnapshot | null) => {
  const p = snapshot?.batchProgress;
  if (!p) return [];
  const total =
    Math.max(p.total, p.completed + p.failed + p.canceled + p.running + p.queued) ||
    1;
  const seg = (n: number, color: string) => ({
    width: (n / total) * 100,
    color,
  });
  return [
    { ...seg(p.completed, COLORS.success), key: "completed", label: "Completed" },
    { ...seg(p.failed, COLORS.fail), key: "failed", label: "Failed" },
    { ...seg(p.canceled, COLORS.canceled), key: "canceled", label: "Canceled" },
    { ...seg(p.running, COLORS.running), key: "running", label: "Running" },
    { ...seg(p.queued, COLORS.queued), key: "queued", label: "Queued" },
  ].filter((s) => s.width > 0);
};

const findExecutionIdFromQuery = (): string | null => {
  try {
    const params = new URLSearchParams(window.location.search ?? "");
    return params.get("executionId");
  } catch {
    return null;
  }
};

export const App: React.FC = () => {
  const [executionId, setExecutionId] = useState<string | null>(
    findExecutionIdFromQuery(),
  );
  const [state, setState] = useState<BatchProgressUpdateMessage["payload"] | null>(
    null,
  );

  useEffect(() => {
    const handler = (message: unknown) => {
      const msg = message as BatchProgressMessage;
      if (msg.type === "batchProgress.setExecution") {
        setExecutionId(msg.payload.executionId);
        messageHandlerManager.postMessage({
          type: "batchProgress.requestUpdate",
          payload: { executionId: msg.payload.executionId },
        });
      } else if (msg.type === "batchProgress.update") {
        setState(msg.payload);
      }
    };
    messageHandlerManager.on("batchProgress.setExecution", handler);
    messageHandlerManager.on("batchProgress.update", handler);
    return () => {
      messageHandlerManager.off("batchProgress.setExecution", handler);
      messageHandlerManager.off("batchProgress.update", handler);
    };
  }, []);

  useEffect(() => {
    if (!executionId) return;
    messageHandlerManager.postMessage({
      type: "batchProgress.requestUpdate",
      payload: { executionId },
    });
  }, [executionId]);

  const segments = useMemo(() => buildSegments(state?.snapshot ?? null), [
    state?.snapshot,
  ]);

  if (!executionId) {
    return (
      <Container>
        <EmptyState>No execution selected.</EmptyState>
      </Container>
    );
  }

  if (!state || state.loading) {
    return (
      <Container>
        <EmptyState>Loading batch progress…</EmptyState>
      </Container>
    );
  }

  const p = state.snapshot?.batchProgress;
  const denom = (p?.total ?? 0) > 0 ? p?.total : (p?.discovered ?? 0);
  const cancelPending = Boolean(state.snapshot?.cancelRequestedAt);
  const discoveryComplete = p?.discoveryComplete ?? false;

  return (
    <Container>
      <Header>
        <Title>
          {p?.completed ?? 0}/{denom ?? 0} batches
          {(p?.failed ?? 0) > 0 ? ` · ${p?.failed} failed` : null}
        </Title>
        <Subtitle>
          {discoveryComplete ? "Discovery complete" : "Discovering batches…"}
          {cancelPending ? " · Cancel requested" : null}
          {p?.concurrencyLimit !== null && p?.concurrencyLimit !== undefined
            ? ` · Concurrency limit: ${p.concurrencyLimit}${p.concurrencyLimitSource ? ` (${p.concurrencyLimitSource})` : ""}`
            : null}
        </Subtitle>
      </Header>

      <Bar>
        {segments.map((s) => (
          <Segment key={s.key} $color={s.color} $width={s.width} />
        ))}
      </Bar>

      <LegendRow>
        {segments.map((s) => (
          <LegendItem key={s.key}>
            <Swatch $color={s.color} /> {s.label}
          </LegendItem>
        ))}
      </LegendRow>

      <Actions>
        <SecondaryButton
          onClick={() => {
            messageHandlerManager.postMessage({
              type: "batchProgress.requestUpdate",
              payload: { executionId },
            });
          }}
        >
          Refresh
        </SecondaryButton>
        <Button
          disabled={!state.hasMore}
          onClick={() => {
            messageHandlerManager.postMessage({
              type: "batchProgress.loadMore",
              payload: { executionId },
            });
          }}
        >
          {state.hasMore ? "Load more batches" : "All batches loaded"}
        </Button>
        <Button
          disabled={cancelPending}
          onClick={() => {
            messageHandlerManager.postMessage({
              type: "batchProgress.cancel",
              payload: { executionId },
            });
          }}
        >
          {cancelPending ? "Cancel pending…" : "Cancel batch processing"}
        </Button>
      </Actions>

      {state.batches.length === 0 ? (
        <EmptyState>No batches yet.</EmptyState>
      ) : (
        <BatchGrid>
          {state.batches.map((b) => (
            <BatchTile
              key={b.id}
              $color={colorFor(b.status)}
              onClick={() => {
                messageHandlerManager.postMessage({
                  type: "batchProgress.openBatchLogs",
                  payload: {
                    executionId,
                    batchExecutionId: b.id,
                  },
                });
              }}
              title={b.errorMessage ?? undefined}
            >
              <TileLabel>{b.displayKey}</TileLabel>
              <TileMeta>
                {b.label} · {b.status}
              </TileMeta>
            </BatchTile>
          ))}
        </BatchGrid>
      )}
    </Container>
  );
};
