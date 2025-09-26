import { PrismCLIManager } from "@extension/PrismCLIManager";
import { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import { log } from "../extension";

export class AuthManager {
  private static instance: AuthManager | null = null;
  private prismCLIManager: PrismCLIManager;
  private stateManager: StateManager;

  private constructor(
    prismCLIManager: PrismCLIManager,
    stateManager: StateManager,
  ) {
    this.stateManager = stateManager;
    this.prismCLIManager = prismCLIManager;
  }

  /**
   * Gets the singleton instance of AuthManager.
   * Creates a new instance if one doesn't exist.
   * @returns {Promise<AuthManager>} A promise that resolves to the singleton instance of AuthManager
   */
  static async getInstance(): Promise<AuthManager> {
    if (!AuthManager.instance) {
      const prismCLIManager = await PrismCLIManager.getInstance();
      const stateManager = StateManager.getInstance();

      AuthManager.instance = new AuthManager(prismCLIManager, stateManager);
    }

    return AuthManager.instance;
  }

  /**
   * Checks if the user has valid authentication tokens.
   * @returns {Promise<boolean>} True if both access and refresh tokens exist
   */
  public async hasTokens(): Promise<boolean> {
    const globalState = await this.stateManager.getGlobalState();

    return !!globalState?.accessToken && !!globalState?.refreshToken;
  }

  /**
   * Checks if the user is currently logged in via the Prismatic CLI and has valid tokens.
   * @returns {Promise<boolean>} True if the user is logged in and has tokens
   */
  public async isLoggedIn(): Promise<boolean> {
    try {
      const result = await this.prismCLIManager.me();

      return !result.includes("Error: You are not logged");
    } catch {
      return false;
    }
  }

  /**
   * Performs login through the Prismatic CLI.
   * @returns {Promise<string>} The login result message
   * @throws {Error} If login fails
   */
  public async login(): Promise<string> {
    try {
      const result = await this.prismCLIManager.login();

      await this.fetchAndStoreTokens();
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to login: ${errorMessage}`);
    }
  }

  /**
   * Performs logout through the Prismatic CLI and clears all tokens.
   * @returns {Promise<string>} The logout result message
   * @throws {Error} If logout fails
   */
  public async logout(): Promise<string> {
    try {
      const result = await this.prismCLIManager.logout();

      await this.clearTokens();
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to logout: ${errorMessage}`);
    }
  }

  /**
   * Fetches both access and refresh tokens from the Prismatic CLI
   * and stores them in the global state.
   * @throws {Error} If token fetching fails
   */
  public async fetchAndStoreTokens(): Promise<void> {
    try {
      const accessToken = await this.prismCLIManager.meToken("access");
      await this.stateManager.updateGlobalState({
        accessToken,
      });

      const refreshToken = await this.prismCLIManager.meToken("refresh");
      await this.stateManager.updateGlobalState({
        refreshToken,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to fetch and store tokens: ${errorMessage}`);
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
      const globalState = await this.stateManager.getGlobalState();

      if (!globalState?.refreshToken) {
        throw new Error("No refresh token found");
      }

      process.env.PRISM_REFRESH_TOKEN = globalState.refreshToken;
      const accessToken = await this.prismCLIManager.meToken();

      await this.stateManager.updateGlobalState({
        accessToken,
      });

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
    const globalState = await this.stateManager.getGlobalState();

    if (!globalState?.accessToken) {
      throw new Error("No access token found");
    }

    return globalState.accessToken;
  }

  /**
   * Retrieves the current refresh token from the global state.
   * @returns {Promise<string>} The current refresh token
   * @throws {Error} If no refresh token is found
   */
  public async getRefreshToken(): Promise<string> {
    const globalState = await this.stateManager.getGlobalState();

    if (!globalState?.refreshToken) {
      throw new Error("No refresh token found");
    }

    return globalState.refreshToken;
  }

  /**
   * Clears both access and refresh tokens from the global state.
   * @returns {Promise<void>}
   */
  public async clearTokens(): Promise<void> {
    await this.stateManager.updateGlobalState({
      accessToken: undefined,
      refreshToken: undefined,
    });
  }

  /**
   * Gets the current user's information from the Prismatic CLI.
   * @returns {Promise<string>} The user information
   * @throws {Error} If getting user info fails
   */
  public async getCurrentUser(): Promise<string> {
    try {
      return await this.prismCLIManager.me();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to get current user: ${errorMessage}`);
    }
  }

  /**
   * Performs the complete initial authentication flow during extension activation.
   * Checks if user is logged in, prompts for login if needed, and fetches tokens.
   * Also starts monitoring the prism config file for changes.
   * @returns {Promise<void>}
   * @throws {Error} If authentication fails
   */
  public async performInitialAuthFlow(): Promise<void> {
    try {
      // Check if user is logged in
      if (!(await this.isLoggedIn())) {
        // Prompt user to login
        const loginAction = "Login to Prismatic";

        const response = await vscode.window.showInformationMessage(
          "You need to login to Prismatic to continue.",
          { modal: true },
          loginAction,
        );

        if (response !== loginAction) {
          throw new Error("Login required to continue");
        }

        log("INFO", "Logging in...");
        await this.login();
        log("SUCCESS", "Successfully logged in!");
      } else {
        // Fetch and store tokens if user is already logged in
        this.fetchAndStoreTokens();
      }

      // Start monitoring Prism Config file for changes
      log("INFO", "Starting Prism Config monitoring...");
      this.prismCLIManager.monitorPrismConfig(
        // On Prism Config change
        async () => {
          log("INFO", "Prism Config changed, fetching and storing tokens...");
          await this.fetchAndStoreTokens();
        },
        // On Prism Config delete
        async () => {
          log("INFO", "Prism Config deleted, clearing tokens...");
          await this.clearTokens();
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log("ERROR", errorMessage, true);
      throw error;
    }
  }

  /**
   * Disposes of the AuthManager instance and clears all tokens.
   */
  public async dispose(): Promise<void> {
    await this.clearTokens();
    AuthManager.instance = null;
  }
}
