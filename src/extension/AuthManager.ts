import { StateManager } from "@extension/StateManager";
import * as vscode from "vscode";
import { log } from "../extension";
import {
  clearDiscoveryCache,
  fetchAuthMeta,
  fetchOIDCEndpoints,
} from "./auth/discovery";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  refreshTokens,
  startCallbackServer,
} from "./auth/pkce";
import { SecretStore } from "./auth/secretStore";
import { resolveSwitchTenantOutcome } from "./auth/switchTenant";
import type { PrismaticUserInfo, Tenant } from "./auth/types";
import { fetchPrismaticUser, fetchUserTenants } from "./auth/userInfo";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

class PrismaticUrlNotConfiguredError extends Error {
  constructor() {
    super(
      'Prismatic URL is not configured. Set it via the "Prismatic: Set Prismatic URL" command or the PRISMATIC_URL environment variable.',
    );
    this.name = "PrismaticUrlNotConfiguredError";
  }
}

const waitForQuickPickSelection = <T extends vscode.QuickPickItem>(
  quickPick: vscode.QuickPick<T>,
): Promise<T | undefined> =>
  new Promise((resolve) => {
    let accepted = false;
    quickPick.onDidAccept(() => {
      accepted = true;
      resolve(quickPick.selectedItems[0]);
    });
    quickPick.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
  });

export class AuthManager {
  private static instance: AuthManager | null = null;
  private stateManager: StateManager;
  private secretStore: SecretStore;
  private cachedUserInfo: PrismaticUserInfo | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _onDidChangeAuth = new vscode.EventEmitter<void>();
  public readonly onDidChangeAuth = this._onDidChangeAuth.event;

  private constructor(
    context: vscode.ExtensionContext,
    stateManager: StateManager,
  ) {
    this.stateManager = stateManager;
    this.secretStore = new SecretStore(context);
    context.subscriptions.push(this._onDidChangeAuth);
  }

  static async initialize(
    context: vscode.ExtensionContext,
  ): Promise<AuthManager> {
    if (!AuthManager.instance) {
      const stateManager = StateManager.getInstance();
      AuthManager.instance = new AuthManager(context, stateManager);
    }
    return AuthManager.instance;
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      throw new Error("AuthManager not initialized. Call initialize() first.");
    }
    return AuthManager.instance;
  }

  public async hasTokens(): Promise<boolean> {
    const tokens = await this.secretStore.getTokens();
    return tokens !== null;
  }

  public async isLoggedIn(): Promise<boolean> {
    try {
      const tokens = await this.secretStore.getTokens();
      if (!tokens) return false;

      if (Date.now() >= tokens.expiresAt) {
        // Access token expired — try refresh
        await this.refreshAccessToken();
      }

      // Validate the token is actually accepted by the server
      const prismaticUrl = await this.requirePrismaticUrl();
      const currentTokens = await this.secretStore.getTokens();
      if (!currentTokens) return false;

      await fetchPrismaticUser(prismaticUrl, currentTokens.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  public async login(): Promise<string> {
    const prismaticUrl = await this.requirePrismaticUrl();

    const meta = await fetchAuthMeta(prismaticUrl);
    const endpoints = await fetchOIDCEndpoints(meta.domain);

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateState();

    const server = await startCallbackServer();
    const redirectUri = `http://localhost:${server.port}`;

    const authorizeUrl = buildAuthorizeUrl(
      endpoints,
      meta,
      challenge,
      state,
      redirectUri,
    );

    try {
      await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));
      const result = await server.codePromise;

      if (result.state !== state) {
        throw new Error(
          "OAuth state mismatch — possible CSRF attack. Please try again.",
        );
      }

      let tokens = await exchangeCodeForTokens(
        endpoints,
        meta,
        result.code,
        verifier,
        redirectUri,
      );

      await this.secretStore.storeTokens(tokens);

      // Fetch user info to get default tenantId
      const userInfo = await fetchPrismaticUser(
        prismaticUrl,
        tokens.accessToken,
      );

      // Store initial tenantId if present
      if (userInfo.tenantId) {
        tokens = { ...tokens, tenantId: userInfo.tenantId };
        await this.secretStore.storeTokens(tokens);
      }

      // Tenant selection — only prompt if user has multiple tenants
      try {
        const tenants = await fetchUserTenants(
          prismaticUrl,
          tokens.accessToken,
        );

        if (tenants.length > 1) {
          const selectedTenantId = await this.promptTenantSelection(
            tenants,
            userInfo.tenantId,
          );

          if (selectedTenantId) {
            tokens = await refreshTokens(
              endpoints,
              meta,
              tokens.refreshToken,
              selectedTenantId,
            );
            await this.secretStore.storeTokens(tokens);
          }
        }
      } catch {
        // Non-fatal — continue with initial tenant
      }

      this.notifyAuthChanged();
      this.scheduleProactiveRefresh(tokens.expiresAt);

      // Re-fetch user info for the selected tenant context
      try {
        this.cachedUserInfo = await fetchPrismaticUser(
          prismaticUrl,
          tokens.accessToken,
        );
      } catch {
        this.cachedUserInfo = null;
      }

      return "Login complete!";
    } catch (error) {
      server.close();
      throw error;
    }
  }

  public async logout(): Promise<string> {
    this.clearRefreshTimer();
    await this.secretStore.clearTokens();
    this.cachedUserInfo = null;
    this.notifyAuthChanged();
    return "Successfully logged out.";
  }

  public async getAccessToken(): Promise<string> {
    const tokens = await this.secretStore.getTokens();
    if (!tokens) {
      throw new Error("No access token found. Please login first.");
    }

    if (Date.now() >= tokens.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      return await this.refreshAccessToken();
    }

    return tokens.accessToken;
  }

  private async refreshAccessToken(): Promise<string> {
    const tokens = await this.secretStore.getTokens();
    if (!tokens?.refreshToken) {
      throw new Error("No refresh token found. Please login again.");
    }

    const prismaticUrl = await this.requirePrismaticUrl();

    try {
      const meta = await fetchAuthMeta(prismaticUrl);
      const endpoints = await fetchOIDCEndpoints(meta.domain);
      const newTokens = await refreshTokens(
        endpoints,
        meta,
        tokens.refreshToken,
        tokens.tenantId,
      );

      await this.secretStore.storeTokens(newTokens);
      this.notifyAuthChanged();
      this.scheduleProactiveRefresh(newTokens.expiresAt);
      return newTokens.accessToken;
    } catch (error) {
      // Refresh failed — clear tokens so user is prompted to re-login
      this.clearRefreshTimer();
      await this.secretStore.clearTokens();
      this.cachedUserInfo = null;
      this.notifyAuthChanged();
      throw new Error(
        `Session expired. Please login again. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  public async getCurrentUser(): Promise<PrismaticUserInfo> {
    if (this.cachedUserInfo) return this.cachedUserInfo;

    const accessToken = await this.getAccessToken();
    const prismaticUrl = await this.requirePrismaticUrl();

    this.cachedUserInfo = await fetchPrismaticUser(prismaticUrl, accessToken);
    return this.cachedUserInfo;
  }

  private async promptTenantSelection(
    tenants: Tenant[],
    currentTenantId?: string,
  ): Promise<string | undefined> {
    const items = tenants.map((t) => ({
      label: t.orgName,
      description: `${t.url} (${t.awsRegion})`,
      detail: t.tenantId === currentTenantId ? "Current" : undefined,
      tenantId: t.tenantId,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a tenant",
      title: "Prismatic Tenant Selection",
    });

    return selected?.tenantId;
  }

  public async switchTenant(): Promise<string | undefined> {
    const tokens = await this.secretStore.getTokens();
    if (!tokens?.refreshToken) {
      throw new Error("Not logged in. Please login first.");
    }

    const prismaticUrl = await this.requirePrismaticUrl();
    const accessToken = await this.getAccessToken();

    // Show the picker immediately so the click has visible feedback while we
    // load tenants. The selection promise is installed up-front so that hitting
    // escape during the fetch is handled cleanly.
    const quickPick = vscode.window.createQuickPick<
      vscode.QuickPickItem & { tenantId: string }
    >();
    quickPick.title = "Prismatic Tenant Selection";
    quickPick.placeholder = "Loading tenants…";
    quickPick.busy = true;
    quickPick.enabled = false;
    quickPick.show();

    const selectionPromise = waitForQuickPickSelection(quickPick);

    let selectedTenantId: string;
    try {
      const tenants = await fetchUserTenants(prismaticUrl, accessToken);
      const outcome = resolveSwitchTenantOutcome(tenants, tokens.tenantId);

      if (outcome.kind === "single") {
        return outcome.message;
      }

      quickPick.items = outcome.items;
      quickPick.placeholder = "Select a tenant";
      quickPick.busy = false;
      quickPick.enabled = true;

      const selected = await selectionPromise;
      if (!selected) {
        return undefined;
      }
      selectedTenantId = selected.tenantId;
    } finally {
      quickPick.dispose();
    }

    if (selectedTenantId === tokens.tenantId) {
      return "Already on selected tenant.";
    }

    const meta = await fetchAuthMeta(prismaticUrl);
    const endpoints = await fetchOIDCEndpoints(meta.domain);
    const newTokens = await refreshTokens(
      endpoints,
      meta,
      tokens.refreshToken,
      selectedTenantId,
    );

    await this.secretStore.storeTokens(newTokens);
    this.cachedUserInfo = null;
    this.notifyAuthChanged();
    this.scheduleProactiveRefresh(newTokens.expiresAt);

    // Re-fetch user info for the new tenant
    try {
      this.cachedUserInfo = await fetchPrismaticUser(
        prismaticUrl,
        newTokens.accessToken,
      );
    } catch {
      // Non-fatal
    }

    return `Switched to ${this.cachedUserInfo?.organization ?? selectedTenantId}`;
  }

  public async performInitialAuthFlow(): Promise<void> {
    try {
      if (await this.isLoggedIn()) {
        log("INFO", "User is already logged in.");

        // Schedule proactive refresh for the existing token
        const tokens = await this.secretStore.getTokens();
        if (tokens) {
          this.scheduleProactiveRefresh(tokens.expiresAt);
        }

        // Pre-fetch user info for status bar
        try {
          await this.getCurrentUser();
        } catch {
          // Non-fatal
        }
      } else {
        log("INFO", "User is not logged in. Waiting for login via sidebar.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log("ERROR", errorMessage, true);
    }
  }

  private async requirePrismaticUrl(): Promise<string> {
    const globalState = await this.stateManager.getGlobalState();
    const prismaticUrl = globalState?.prismaticUrl;
    if (!prismaticUrl) {
      throw new PrismaticUrlNotConfiguredError();
    }

    try {
      new URL(prismaticUrl);
    } catch {
      throw new Error(
        `Prismatic URL "${prismaticUrl}" is not a valid URL. Update it via the "Prismatic: Set Prismatic URL" command.`,
      );
    }

    return prismaticUrl;
  }

  public onPrismaticUrlChanged(): void {
    clearDiscoveryCache();
    this.cachedUserInfo = null;
  }

  private scheduleProactiveRefresh(expiresAt: number): void {
    this.clearRefreshTimer();
    const delay = expiresAt - Date.now() - TOKEN_EXPIRY_BUFFER_MS;
    if (delay <= 0) return;

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
        log("INFO", "Proactively refreshed access token.");
      } catch {
        // refreshAccessToken already clears tokens and notifies webviews on failure
      }
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private notifyAuthChanged(): void {
    this._onDidChangeAuth.fire();
    this.stateManager.notifyWebviews({
      type: "authStateChanged",
      payload: undefined,
    });
  }

  public dispose(): void {
    this.clearRefreshTimer();
    this.cachedUserInfo = null;
    AuthManager.instance = null;
  }
}
