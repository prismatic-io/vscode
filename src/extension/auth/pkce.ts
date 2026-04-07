import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  type AuthMeta,
  type OIDCEndpoints,
  TokenResponseSchema,
  type TokenSet,
} from "./types";

const CALLBACK_TIMEOUT_MS = 120_000;
const PORT_RANGE_LOW = 59400;
const PORT_RANGE_HIGH = 59450;
const PORT_RETRIES = 5;

const randomPort = (): number => {
  return Math.floor(
    Math.random() * (PORT_RANGE_HIGH - PORT_RANGE_LOW + 1) + PORT_RANGE_LOW,
  );
};

export const generateCodeVerifier = (): string => {
  return randomBytes(32).toString("base64url");
};

export const generateCodeChallenge = (verifier: string): string => {
  return createHash("sha256").update(verifier).digest("base64url");
};

export const generateState = (): string => {
  return randomBytes(16).toString("base64url");
};

export interface CallbackServer {
  port: number;
  codePromise: Promise<{ code: string; state: string }>;
  close: () => void;
}

export const startCallbackServer = (): Promise<CallbackServer> => {
  return new Promise((resolveServer, rejectServer) => {
    let settled = false;
    let codeResolve: (value: { code: string; state: string }) => void;
    let codeReject: (reason: Error) => void;

    const codePromise = new Promise<{ code: string; state: string }>(
      (resolve, reject) => {
        codeResolve = resolve;
        codeReject = reject;
      },
    );

    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (error) {
        res.end(
          `<html><body><h1>Login failed</h1><p>${errorDescription || error}</p><p>You can close this tab.</p></body></html>`,
        );
        codeReject!(
          new Error(
            `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
          ),
        );
      } else if (code && state) {
        res.end(
          "<html><body><h1>Login successful!</h1><p>You can close this tab and return to VS Code.</p></body></html>",
        );
        codeResolve!({ code, state });
      } else {
        res.end(
          "<html><body><h1>Login failed</h1><p>Missing authorization code. Please try again.</p></body></html>",
        );
        codeReject!(new Error("Callback missing authorization code"));
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        server.close();
        codeReject!(new Error("Login timed out. Please try again."));
      }
    }, CALLBACK_TIMEOUT_MS);

    // Clean up on settlement. The .catch prevents an unhandled rejection
    // on this derived chain — callers handle errors via the original codePromise.
    codePromise
      .finally(() => {
        clearTimeout(timeout);
        settled = true;
        server.close();
      })
      .catch(() => {});

    let attempts = 0;

    const tryListen = () => {
      const port = randomPort();
      attempts++;

      server.listen(port, "localhost", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          rejectServer(new Error("Failed to start callback server"));
          return;
        }
        resolveServer({
          port: addr.port,
          codePromise,
          close: () => {
            clearTimeout(timeout);
            settled = true;
            server.close();
          },
        });
      });
    };

    server.on("error", (err) => {
      server.close();
      if (attempts < PORT_RETRIES) {
        tryListen();
      } else {
        rejectServer(
          new Error(
            `Failed to start callback server after ${PORT_RETRIES} attempts: ${err.message}`,
          ),
        );
      }
    });

    tryListen();
  });
};

export const buildAuthorizeUrl = (
  endpoints: OIDCEndpoints,
  meta: AuthMeta,
  challenge: string,
  state: string,
  redirectUri: string,
): string => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: meta.clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    audience: meta.audience,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    connection: meta.connection,
  });

  return `${endpoints.authorizationEndpoint}?${params.toString()}`;
};

export const exchangeCodeForTokens = async (
  endpoints: OIDCEndpoints,
  meta: AuthMeta,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenSet> => {
  const response = await fetch(endpoints.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: meta.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${body}`);
  }

  const data = TokenResponseSchema.parse(await response.json());

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    idToken: data.id_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
};

export const refreshTokens = async (
  endpoints: OIDCEndpoints,
  meta: AuthMeta,
  refreshToken: string,
  tenantId?: string,
): Promise<TokenSet> => {
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    client_id: meta.clientId,
    refresh_token: refreshToken,
  };
  if (tenantId) {
    params.tenant_id = tenantId;
  }

  const response = await fetch(endpoints.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${body}`);
  }

  const data = TokenResponseSchema.parse(await response.json());

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    idToken: data.id_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tenantId,
  };
};
