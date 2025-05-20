import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";

export class TokenManager {
  private static instance: TokenManager | null = null;
  private prismCLIManager: PrismCLIManager;
  private stateManager: StateManager;

  private constructor() {
    this.prismCLIManager = PrismCLIManager.getInstance();
    this.stateManager = StateManager.getInstance();
  }

  /**
   * Gets the singleton instance of TokenManager.
   * Creates a new instance if one doesn't exist.
   * @returns {TokenManager} The singleton instance of TokenManager
   */
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }

    return TokenManager.instance;
  }

  public async hasTokens(): Promise<boolean> {
    const accessToken = await this.stateManager.getGlobalState("accessToken");
    const refreshToken = await this.stateManager.getGlobalState("refreshToken");

    return !!accessToken && !!refreshToken;
  }

  /**
   * Initializes both access and refresh tokens by fetching them from the Prismatic CLI
   * and storing them in the global state.
   * @throws {Error} If token initialization fails
   */
  public async initializeTokens(): Promise<void> {
    try {
      const accessToken = await this.prismCLIManager.meToken("access");
      await this.stateManager.updateGlobalState("accessToken", accessToken);

      const refreshToken = await this.prismCLIManager.meToken("refresh");
      await this.stateManager.updateGlobalState("refreshToken", refreshToken);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to initialize tokens: ${errorMessage}`);
    }
  }

  /**
   * Refreshes the access token using the stored refresh token.
   * Updates the access token in the global state.
   * @returns {Promise<string>} The new access token
   * @throws {Error} If refresh token is not found or token refresh fails
   */
  public async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await this.stateManager.getGlobalState(
        "refreshToken"
      );

      if (!refreshToken) {
        throw new Error("No refresh token found");
      }

      process.env.PRISM_REFRESH_TOKEN = refreshToken;
      const accessToken = await this.prismCLIManager.meToken();

      await this.stateManager.updateGlobalState("accessToken", accessToken);

      return accessToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to refresh access token: ${errorMessage}`);
    }
  }

  /**
   * Retrieves the current access token from the global state.
   * @returns {Promise<string>} The current access token
   * @throws {Error} If no access token is found
   */
  public async getAccessToken(): Promise<string> {
    const accessToken = await this.stateManager.getGlobalState("accessToken");

    if (!accessToken) {
      throw new Error("No access token found");
    }

    return accessToken;
  }

  /**
   * Retrieves the current refresh token from the global state.
   * @returns {Promise<string>} The current refresh token
   * @throws {Error} If no refresh token is found
   */
  public async getRefreshToken(): Promise<string> {
    const refreshToken = await this.stateManager.getGlobalState("refreshToken");

    if (!refreshToken) {
      throw new Error("No refresh token found");
    }

    return refreshToken;
  }

  /**
   * Clears both access and refresh tokens from the global state.
   * @returns {Promise<void>}
   */
  public async clearTokens(): Promise<void> {
    await this.stateManager.updateGlobalState("accessToken", undefined);
    await this.stateManager.updateGlobalState("refreshToken", undefined);
  }

  /**
   * Disposes of the TokenManager instance and clears all tokens.
   */
  public async dispose(): Promise<void> {
    await this.clearTokens();
    TokenManager.instance = null;
  }
}
