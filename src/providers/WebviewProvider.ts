import * as vscode from "vscode";
import type { WebviewMessage, StateChangeMessage } from "@typeDefs/messages";
import { StateManager } from "@/utils/stateManager";

export interface WebviewConfig<T extends WebviewMessage> {
  viewType: string;
  title: string;
  scriptPath: string;
  onMessage?: (message: T, postMessage: (message: T) => void) => void;
  getHtml?: (webview: vscode.Webview, scriptPath: string) => string;
}

export class WebviewProvider<T extends WebviewMessage>
  implements vscode.WebviewViewProvider
{
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _config: WebviewConfig<T>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const scriptPath = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, this._config.scriptPath)
    );

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      scriptPath
    );

    if (this._config.onMessage) {
      // note: listen for messages from the webview to VSCode
      this._disposables.push(
        webviewView.webview.onDidReceiveMessage(async (message: T) => {
          if (message.type === "stateChange") {
            const stateManager = StateManager.getInstance();
            const stateChangeMessage = message as unknown as StateChangeMessage;
            const { scope, key, value } = stateChangeMessage.payload;

            try {
              if (scope === "global") {
                await stateManager.updateGlobalState(key, value);
              } else {
                await stateManager.updateWorkspaceState(key, value);
              }

              // note: send confirmation message back to the webview
              this.postMessage(stateChangeMessage as unknown as T);
            } catch (error) {
              // note: send error message back to the webview
              this.postMessage({
                type: "stateChange",
                payload: {
                  scope,
                  key,
                  value,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                },
              } as unknown as T);
            }
          }

          this._config.onMessage?.(message, this.postMessage.bind(this));
        })
      );
    }
  }

  public dispose() {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }

  /**
   * Sends a message from VSCode to the webview.
   * This is used to communicate from the extension context to the webview context.
   */
  private postMessage(message: T) {
    if (this._view) {
      this._view.webview.postMessage(message);
    } else {
      console.warn("[WebviewProvider] Cannot post message - view is undefined");
    }
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
