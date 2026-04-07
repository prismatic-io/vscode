import type * as vscode from "vscode";
import type { TokenSet } from "./types";

const TOKENS_KEY = "prismatic.tokens";

export class SecretStore {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async storeTokens(tokens: TokenSet): Promise<void> {
    await this.context.secrets.store(TOKENS_KEY, JSON.stringify(tokens));
  }

  async getTokens(): Promise<TokenSet | null> {
    const raw = await this.context.secrets.get(TOKENS_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    await this.context.secrets.delete(TOKENS_KEY);
  }

  onDidChange(listener: () => void): vscode.Disposable {
    return this.context.secrets.onDidChange((e) => {
      if (e.key === TOKENS_KEY) {
        listener();
      }
    });
  }
}
