import * as vscode from "vscode";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import { formatExecutionLogs } from "./formatting";
import { buildLogsUri, parseLogsUri } from "./uris";

export class LogsContentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly service: ExecutionResultsService) {
    this.disposables.push(
      this._onDidChange,
      service.onDidChangeLogs((executionId) => {
        this._onDidChange.fire(buildLogsUri(executionId));
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        const parts = parseLogsUri(doc.uri);
        if (parts) service.untrackLogDoc(parts.executionId);
      }),
    );
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const parts = parseLogsUri(uri);
    if (!parts) {
      return `// Invalid logs URI: ${uri.toString()}`;
    }

    // Marking watched here covers both the first open and any time VS Code
    // re-requests content (e.g. after a reopen) — keeps the poll loop gated
    // strictly on actually-open log documents.
    this.service.trackLogDoc(parts.executionId);
    const logs = await this.service.loadLogs(parts.executionId);
    return formatExecutionLogs(logs);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
