import type {
  WebviewApi,
  WebviewMessage,
  MessageHandler as MessageHandlerType,
} from "@typeDefs/messages";
import { getWebviewApi } from "./webviewApi";

/**
 * MessageHandler manages communication between webview and VS Code extension.
 * It runs in the webview context and uses the VS Code webview API to communicate.
 */
export class MessageHandler {
  private vscode: WebviewApi;
  private handlers: Map<string, MessageHandlerType[]>;

  constructor() {
    this.vscode = getWebviewApi();
    this.handlers = new Map();

    // Listen for messages from VSCode to the webview
    window.addEventListener("message", this.handleMessage);
  }

  private handleMessage = (event: MessageEvent) => {
    const message = event.data as WebviewMessage;
    const handlers = this.handlers.get(message.type) || [];

    for (const handler of handlers) {
      handler(message);
    }
  };

  public on(type: string, handler: MessageHandlerType) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    const handlers = this.handlers.get(type);

    if (handlers) {
      handlers.push(handler);
    }
  }

  public off(type: string, handler: MessageHandlerType) {
    const handlers = this.handlers.get(type);

    if (handlers) {
      const index = handlers.indexOf(handler);

      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Sends a message from the webview to VSCode.
   * This is used to communicate from the webview context to the extension context.
   */
  public postMessage(message: WebviewMessage) {
    this.vscode.postMessage(message);
  }

  public dispose() {
    window.removeEventListener("message", this.handleMessage);
    this.handlers.clear();
  }
}
