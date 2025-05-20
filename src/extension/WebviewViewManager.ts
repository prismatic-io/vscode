import * as vscode from "vscode";
import { StateManager } from "@extension/StateManager";
import type { MessageType } from "@type/messages";

export interface WebviewViewManagerConfig<T extends MessageType> {
  viewType: string;
  title: string;
  scriptPath: string;
  onMessage?: (message: T, postMessage: (message: T) => void) => void;
  getHtml?: (webview: vscode.Webview, scriptPath: string) => string;
}

export class WebviewViewManager<T extends MessageType>
  implements vscode.WebviewViewProvider
{
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates a new WebviewViewManager instance.
   * @param _extensionUri - The URI of the extension
   * @param _config - Configuration options for the webview
   */
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _config: WebviewViewManagerConfig<T>
  ) {}

  /**
   * Sends a message from VSCode to the webview.
   * This is used to communicate from the extension context to the webview context.
   * @param message - The message to send to the webview
   */
  private postMessage(message: T) {
    if (this._view) {
      this._view.webview.postMessage(message);
    } else {
      console.warn(
        "[WebviewViewManager] Cannot post message - view is undefined"
      );
    }
  }

  /**
   * Called when the webview view is first created or restored.
   * Sets up the webview with the necessary options, HTML content, and message handling.
   * @param webviewView - The webview view to be resolved
   * @param _context - Additional context about the webview view
   * @param _token - A cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    const stateManager = StateManager.getInstance();
    stateManager.registerWebview(webviewView.webview);

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
      this._disposables.push(
        webviewView.webview.onDidReceiveMessage(
          async (message: MessageType) => {
            const stateManager = StateManager.getInstance();

            switch (message.type) {
              case "stateChange": {
                const { scope, key, value } = message.payload;

                try {
                  if (scope === "global") {
                    await stateManager.updateGlobalState(key, value);
                  } else {
                    await stateManager.updateWorkspaceState(key, value);
                  }

                  this.postMessage(message as T);
                } catch (error) {
                  this.postMessage({
                    type: "stateChange",
                    payload: {
                      scope,
                      key,
                      value,
                      error:
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                    },
                  } as T);
                }
                break;
              }
              case "getState": {
                const { scope, key } = message.payload;

                try {
                  const value =
                    scope === "global"
                      ? await stateManager.getGlobalState(key)
                      : await stateManager.getWorkspaceState(key);

                  this.postMessage({
                    type: "getState",
                    payload: { scope, key, value },
                  } as T);
                } catch (error) {
                  this.postMessage({
                    type: "getState",
                    payload: {
                      scope,
                      key,
                      value: undefined,
                      error:
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                    },
                  } as T);
                }
                break;
              }
              // note: send other postMessage to the webview
              default: {
                this._config.onMessage?.(
                  message as T,
                  this.postMessage.bind(this)
                );
              }
            }
          }
        )
      );
    }
  }

  /**
   * Generates the HTML content for the webview.
   * Uses a custom HTML generator if provided in the config, otherwise returns a default template.
   * @param webview - The webview instance
   * @param scriptPath - The URI of the script to be loaded in the webview
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
   * Cleans up resources when the webview is disposed.
   * Un-registers the webview from the state manager and disposes of all disposables.
   */
  public dispose() {
    if (this._view) {
      const stateManager = StateManager.getInstance();

      stateManager.unregisterWebview(this._view.webview);
    }
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}
