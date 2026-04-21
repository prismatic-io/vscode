import * as vscode from "vscode";
import type { ExecutionResultsService } from "./ExecutionResultsService";
import { formatStepOutput } from "./formatting";
import { buildStepUri, parseStepUri } from "./uris";

export class StepContentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly service: ExecutionResultsService) {
    this.disposables.push(
      this._onDidChange,
      service.onDidChangeStepOutput(({ executionId, stepId }) => {
        const execution = this.service.getExecution(executionId);
        const step = execution?.stepResults.find((s) => s.id === stepId);
        const uri = buildStepUri(executionId, stepId, step?.stepName ?? null);
        this._onDidChange.fire(uri);
      }),
    );
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const parts = parseStepUri(uri);
    if (!parts) {
      return `// Invalid step URI: ${uri.toString()}`;
    }

    const output = await this.service.loadStepOutput(
      parts.executionId,
      parts.stepId,
    );

    if (!output) {
      return "// Step output is not yet available.";
    }

    return formatStepOutput(output.data, output.message);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
