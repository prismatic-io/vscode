import type { WebviewApi } from "@typeDefs/messages";

let webviewApi: WebviewApi;

declare global {
  /**
   * VS Code's official webview API function.
   * It returns an API instance for communication between webview and VS Code.
   */
  interface Window {
    acquireVsCodeApi: () => WebviewApi;
  }
}

/**
 * Gets the VS Code webview API instance for communication between webview and VS Code.
 * This should only be called from within a webview context.
 */
export function getWebviewApi(): WebviewApi {
  if (!webviewApi) {
    webviewApi = window.acquireVsCodeApi();
  }

  return webviewApi;
}
