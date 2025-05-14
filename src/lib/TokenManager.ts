import * as vscode from "vscode";
import { PrismCLI } from "./PrismCLI";
import { StateManager } from "@/lib/StateManager";

export class TokenManager {
  private static instance: TokenManager;
  private prismCLI: PrismCLI;
  private stateManager: StateManager;

  private constructor() {
    this.prismCLI = PrismCLI.getInstance();
    this.stateManager = StateManager.getInstance();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }

    return TokenManager.instance;
  }

  async initializeTokens(): Promise<void> {
    try {
      const accessToken = await this.prismCLI.meToken("access");
      await this.stateManager.updateGlobalState("accessToken", accessToken);

      const refreshToken = await this.prismCLI.meToken("refresh");
      await this.stateManager.updateGlobalState("refreshToken", refreshToken);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to initialize tokens: ${errorMessage}`);
    }
  }

  async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await this.stateManager.getGlobalState(
        "refreshToken"
      );

      if (!refreshToken) {
        throw new Error("No refresh token found");
      }

      process.env.PRISM_REFRESH_TOKEN = refreshToken;
      const accessToken = await this.prismCLI.meToken();

      await this.stateManager.updateGlobalState("accessToken", accessToken);

      return accessToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to refresh access token: ${errorMessage}`);
    }
  }

  async getAccessToken(): Promise<string> {
    const accessToken = await this.stateManager.getGlobalState("accessToken");

    if (!accessToken) {
      throw new Error("No access token found");
    }

    return accessToken;
  }

  async getRefreshToken(): Promise<string> {
    const refreshToken = await this.stateManager.getGlobalState("refreshToken");

    if (!refreshToken) {
      throw new Error("No refresh token found");
    }

    return refreshToken;
  }

  async clearTokens(): Promise<void> {
    await this.stateManager.updateGlobalState("accessToken", undefined);
    await this.stateManager.updateGlobalState("refreshToken", undefined);
  }
}
