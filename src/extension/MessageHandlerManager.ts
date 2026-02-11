import type {
  MessageHandlerManager as MessageHandlerManagerType,
  MessageType,
  WebviewApi,
} from "@type/messages";

class MessageHandlerManagerImpl {
  private readonly vscode: WebviewApi;
  private readonly handlers: Map<string, MessageHandlerManagerType[]>;

  constructor() {
    this.vscode = getWebviewApi();
    this.handlers = new Map();

    window.addEventListener("message", this.handleMessage);
  }

  /**
   * Handles incoming messages from VS Code
   * @param event - The message event containing the data from VS Code
   */
  private readonly handleMessage = (event: MessageEvent): void => {
    try {
      const message = event.data as MessageType;
      const handlers = this.handlers.get(message.type) ?? [];

      for (const handler of handlers) {
        handler(message);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };

  /**
   * Registers a message handler for a specific message type
   * @param type - The message type to handle
   * @param handler - The handler function to call when a message of the specified type is received
   */
  public on(type: string, handler: MessageHandlerManagerType): void {
    const handlers = this.handlers.get(type) ?? [];

    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  /**
   * Removes a message handler for a specific message type
   * @param type - The message type to remove the handler from
   * @param handler - The handler function to remove
   */
  public off(type: string, handler: MessageHandlerManagerType): void {
    const handlers = this.handlers.get(type);

    if (!handlers) {
      return;
    }

    const index = handlers.indexOf(handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Sends a message from the webview to VS Code
   * @param message - The message to send to VS Code
   */
  public postMessage(message: MessageType): void {
    this.vscode.postMessage(message);
  }

  /**
   * Cleans up resources and removes event listeners
   */
  public dispose(): void {
    window.removeEventListener("message", this.handleMessage);
    this.handlers.clear();
  }
}

declare global {
  /**
   * VS Code's official webview API function.
   * It returns an API instance for communication between webview and VS Code.
   */
  interface Window {
    acquireVsCodeApi: () => WebviewApi;
  }
}

let webviewApi: WebviewApi;

/**
 * Gets or creates the VS Code webview API instance
 * @returns The VS Code webview API instance
 */
const getWebviewApi = (): WebviewApi => {
  if (!webviewApi) {
    webviewApi = window.acquireVsCodeApi();
  }

  return webviewApi;
};

// Singleton instance for shared use across all webview modules
let messageHandlerInstance: MessageHandlerManagerImpl | null = null;

/**
 * Gets or creates the singleton MessageHandlerManager instance
 * @returns The shared MessageHandlerManager instance
 */
export const getMessageHandlerManager = (): MessageHandlerManagerImpl => {
  if (!messageHandlerInstance) {
    messageHandlerInstance = new MessageHandlerManagerImpl();
  }
  return messageHandlerInstance;
};

// Export singleton instance for direct import
export const messageHandlerManager = getMessageHandlerManager();

// Export type for type annotations if needed
export type MessageHandlerManager = MessageHandlerManagerImpl;
