import * as vscode from "vscode";
import { StateManager } from "@extension/StateManager";
import type { MessageType } from "@type/messages";

export interface WebviewPanelManagerConfig<T extends MessageType> {
  viewType: string;
  title: string;
  scriptPath: string;
  onMessage?: (message: T, postMessage: (message: T) => void) => void;
  getHtml?: (webview: vscode.Webview, scriptPath: string) => string;
}

export class WebviewPanelManager<T extends MessageType> {
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates a new WebviewPanelManager instance.
   * @param _context - The extension context
   * @param _config - Configuration object for the panel
   */
  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _config: WebviewPanelManagerConfig<T>
  ) {}

  /**
   * Sends a message to the webview panel.
   * @param message - The message to send to the panel
   */
  private postMessage(message: T) {
    if (!this._panel) {
      return;
    }

    this._panel.webview.postMessage(message);
  }

  /**
   * Creates and reveals a new webview panel.
   * If a panel already exists, it will be revealed in the specified view column.
   * @param viewColumn - The view column where the panel should be shown. Defaults to ViewColumn.One
   */
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

    const stateManager = StateManager.getInstance();
    stateManager.registerWebview(this._panel.webview);

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

  /**
   * Generates the HTML content for the webview panel.
   * Uses custom HTML if provided in config, otherwise returns a default template.
   * @param webview - The webview instance
   * @param scriptPath - The URI of the script to be loaded
   * @returns The HTML content for the webview
   */
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

  /**
   * Disposes of the panel and cleans up all registered disposables.
   * Un-registers the webview from the state manager and disposes of all event listeners.
   */
  public dispose() {
    if (this._panel) {
      const stateManager = StateManager.getInstance();

      stateManager.unregisterWebview(this._panel.webview);
    }

    for (const disposable of this._disposables) {
      disposable.dispose();
    }

    this._disposables = [];
  }
}
