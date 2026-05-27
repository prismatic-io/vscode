import type { AuthManager } from "@extension/AuthManager";
import type { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import { CONFIG } from "@/config";
import type { BatchProgressService } from "@/extension/executionResults/BatchProgressService";
import type {
  BatchExecutionSnapshot,
  ExecutionBatchNode,
} from "@/extension/executionResults/types";
import { WebviewPanelManager } from "@/extension/WebviewPanelManager";
import type {
  BatchProgressMessage,
  BatchProgressUpdateMessage,
} from "@/webview/views/batchProgress/types";

const WEBVIEW_CONFIG = CONFIG.webviews.batchProgress;

interface SnapshotKey {
  snapshotHash: string;
  batchesHash: string;
  loading: boolean;
  hasMore: boolean;
  totalCount: number;
}

const extractExecutionIdFromTreeItem = (arg: unknown): string | null => {
  if (!arg || typeof arg !== "object") return null;
  const candidate = arg as { execution?: { id?: unknown } };
  const id = candidate.execution?.id;
  return typeof id === "string" ? id : null;
};

const hashSnapshot = (s: BatchExecutionSnapshot | null): string => {
  if (!s) return "null";
  const p = s.batchProgress;
  return [
    s.status ?? "",
    s.cancelRequestedAt ?? "",
    p?.discovered ?? 0,
    p?.completed ?? 0,
    p?.failed ?? 0,
    p?.canceled ?? 0,
    p?.queued ?? 0,
    p?.running ?? 0,
    p?.total ?? 0,
    p?.discoveryComplete ?? false,
  ].join("|");
};

const hashBatches = (nodes: ExecutionBatchNode[]): string => {
  if (nodes.length === 0) return "0";
  const parts: string[] = [String(nodes.length)];
  for (const n of nodes) {
    parts.push(`${n.id}:${n.status}:${n.startedAt ?? ""}:${n.completedAt ?? ""}`);
  }
  return parts.join("|");
};

export const createBatchProgressPanel = (
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  authManager: AuthManager,
  batchProgressService: BatchProgressService,
): vscode.Disposable => {
  let currentExecutionId: string | null = null;
  let lastSent: SnapshotKey | null = null;
  let postToWebview: ((m: BatchProgressMessage) => void) | null = null;

  const buildUpdate = (executionId: string): BatchProgressUpdateMessage => {
    const snapshot = batchProgressService.getSnapshot(executionId);
    const batches = batchProgressService.getBatches(executionId);
    return {
      type: "batchProgress.update",
      payload: {
        executionId,
        snapshot,
        batches,
        totalCount: batchProgressService.totalCount(executionId),
        hasMore: batchProgressService.hasMore(executionId),
        loading: batchProgressService.isLoading(executionId),
      },
    };
  };

  const maybeSend = (force = false): void => {
    if (!postToWebview || !currentExecutionId) return;
    const update = buildUpdate(currentExecutionId);
    const key: SnapshotKey = {
      snapshotHash: hashSnapshot(update.payload.snapshot),
      batchesHash: hashBatches(update.payload.batches),
      loading: update.payload.loading,
      hasMore: update.payload.hasMore,
      totalCount: update.payload.totalCount,
    };
    if (
      !force &&
      lastSent &&
      lastSent.snapshotHash === key.snapshotHash &&
      lastSent.batchesHash === key.batchesHash &&
      lastSent.loading === key.loading &&
      lastSent.hasMore === key.hasMore &&
      lastSent.totalCount === key.totalCount
    ) {
      return;
    }
    lastSent = key;
    postToWebview(update);
  };

  const provider = new WebviewPanelManager<BatchProgressMessage>(
    context,
    {
      viewType: WEBVIEW_CONFIG.viewType,
      title: WEBVIEW_CONFIG.title,
      scriptPath: WEBVIEW_CONFIG.scriptPath,
      onMessage: async (message, postMessage) => {
        postToWebview = postMessage;
        switch (message.type) {
          case "batchProgress.setExecution":
          case "batchProgress.requestUpdate": {
            currentExecutionId = message.payload.executionId;
            lastSent = null;
            batchProgressService.subscribe(message.payload.executionId);
            maybeSend(true);
            break;
          }
          case "batchProgress.loadMore": {
            await batchProgressService.loadMore(message.payload.executionId);
            maybeSend(true);
            break;
          }
          case "batchProgress.cancel": {
            try {
              await batchProgressService.cancel(message.payload.executionId);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(
                `Failed to cancel batch processing: ${msg}`,
              );
            }
            maybeSend(true);
            break;
          }
          case "batchProgress.openBatchLogs": {
            await vscode.commands.executeCommand(
              "prismatic.executionResults.openBatchLogs",
              message.payload.executionId,
              message.payload.batchExecutionId,
            );
            break;
          }
        }
      },
    },
    stateManager,
    authManager,
  );

  const eventSub = batchProgressService.onDidChangeBatches((id) => {
    if (id === currentExecutionId) maybeSend(false);
  });

  const commandSub = vscode.commands.registerCommand(
    WEBVIEW_CONFIG.command,
    (arg: unknown) => {
      const executionId =
        typeof arg === "string"
          ? arg
          : extractExecutionIdFromTreeItem(arg);
      if (!executionId) {
        vscode.window.showInformationMessage(
          "No batched execution to summarize.",
        );
        return;
      }
      currentExecutionId = executionId;
      lastSent = null;
      batchProgressService.subscribe(executionId);
      provider.createPanel();
      // Webview boots asynchronously; queue an initial send for when it requests state.
      // The webview also sends `requestUpdate` on mount, so this is best-effort.
      maybeSend(true);
    },
  );

  return {
    dispose: () => {
      eventSub.dispose();
      commandSub.dispose();
      provider.dispose();
    },
  };
};
