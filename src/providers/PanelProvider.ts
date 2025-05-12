import * as vscode from "vscode";
import type { WebviewMessage } from "@typeDefs/messages";

export interface PanelConfig<T extends WebviewMessage> {
  viewType: string;
  title: string;
  scriptPath: string;
  onMessage?: (message: T, postMessage: (message: T) => void) => void;
  getHtml?: (webview: vscode.Webview, scriptPath: string) => string;
}

export class PanelProvider<T extends WebviewMessage> {
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _config: PanelConfig<T>
  ) {}

  public createPanel(viewColumn: vscode.ViewColumn = vscode.ViewColumn.One) {
    if (this._panel) {
      this._panel.reveal(viewColumn);

      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      this._config.viewType,
      this._config.title,
      viewColumn,
      {
        enableScripts: true,
        localResourceRoots: [this._context.extensionUri],
      }
    );

    const scriptPath = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, this._config.scriptPath)
    );

    this._panel.webview.html = this._getHtmlForWebview(
      this._panel.webview,
      scriptPath
    );

    if (this._config.onMessage) {
      this._disposables.push(
        this._panel.webview.onDidReceiveMessage((message: T) => {
          this._config.onMessage?.(message, this.postMessage.bind(this));
        })
      );
    }

    this._disposables.push(
      this._panel.onDidDispose(() => {
        this._panel = undefined;
        this.dispose();
      })
    );
  }

  public dispose() {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }

    this._disposables = [];
  }

  private postMessage(message: T) {
    if (!this._panel) {
      return;
    }

    this._panel.webview.postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview, scriptPath: vscode.Uri) {
    if (this._config.getHtml) {
      return this._config.getHtml(webview, scriptPath.toString());
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${this._config.title}</title>
      </head>
      <body>
          <div id="root"></div>
          <script src="${scriptPath}"></script>
      </body>
      </html>`;
  }
}
