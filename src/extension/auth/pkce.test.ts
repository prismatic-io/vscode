import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  refreshTokens,
  startCallbackServer,
} from "./pkce";
import type { AuthMeta, OIDCEndpoints } from "./types";

const meta: AuthMeta = {
  domain: "auth.example.com",
  audience: "https://api.example.com",
  clientId: "test-client-id",
  connection: "Username-Password-Authentication",
};

const endpoints: OIDCEndpoints = {
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/oauth/token",
  userinfoEndpoint: "https://auth.example.com/userinfo",
  revocationEndpoint: "https://auth.example.com/oauth/revoke",
};

describe("generateCodeVerifier", () => {
  it("returns a base64url string", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a 43-character string (32 bytes base64url)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(43);
  });

  it("returns unique values on successive calls", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("generateCodeChallenge", () => {
  it("produces a deterministic SHA-256 base64url digest", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(generateCodeChallenge(verifier)).toBe(expected);
  });

  it("produces different challenges for different verifiers", () => {
    const a = generateCodeChallenge("verifier-a");
    const b = generateCodeChallenge("verifier-b");
    expect(a).not.toBe(b);
  });
});

describe("generateState", () => {
  it("returns a base64url string", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a 22-character string (16 bytes base64url)", () => {
    const state = generateState();
    expect(state).toHaveLength(22);
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds a URL with all required PKCE parameters", () => {
    const url = buildAuthorizeUrl(
      endpoints,
      meta,
      "test-challenge",
      "test-state",
      "http://localhost:9999",
    );

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      endpoints.authorizationEndpoint,
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe(meta.clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:9999",
    );
    expect(parsed.searchParams.get("scope")).toBe(
      "openid profile email offline_access",
    );
    expect(parsed.searchParams.get("audience")).toBe(meta.audience);
    expect(parsed.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("test-state");
    expect(parsed.searchParams.get("connection")).toBe(meta.connection);
  });
});

describe("startCallbackServer", () => {
  it("starts on a port in the expected range", async () => {
    const server = await startCallbackServer();
    expect(server.port).toBeGreaterThanOrEqual(59400);
    expect(server.port).toBeLessThanOrEqual(59450);
    server.close();
  });

  it("resolves codePromise when callback receives code and state", async () => {
    const server = await startCallbackServer();

    const res = await fetch(
      `http://localhost:${server.port}/?code=abc&state=xyz`,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Login successful");

    const result = await server.codePromise;
    expect(result).toEqual({ code: "abc", state: "xyz" });
  });

  it("rejects codePromise on OAuth error", async () => {
    const server = await startCallbackServer();

    // Attach rejection handler before triggering to avoid unhandled rejection
    const rejection = server.codePromise.catch((e: Error) => e);

    await fetch(
      `http://localhost:${server.port}/?error=access_denied&error_description=User+cancelled`,
    );

    const error = await rejection;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("OAuth error: access_denied - User cancelled");
  });

  it("rejects codePromise when code is missing", async () => {
    const server = await startCallbackServer();

    const rejection = server.codePromise.catch((e: Error) => e);

    await fetch(`http://localhost:${server.port}/`);

    const error = await rejection;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Callback missing authorization code");
  });

  it("times out after the configured duration", async () => {
    vi.useFakeTimers();

    const server = await startCallbackServer();

    const rejection = server.codePromise.catch((e: Error) => e);

    vi.advanceTimersByTime(120_000);

    const error = await rejection;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Login timed out");

    vi.useRealTimers();
  });
});

describe("exchangeCodeForTokens", () => {
  it("exchanges an authorization code for tokens", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at-123",
          refresh_token: "rt-456",
          id_token: "id-789",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await exchangeCodeForTokens(
      endpoints,
      meta,
      "auth-code",
      "verifier",
      "http://localhost:9999",
    );

    expect(result).toEqual({
      accessToken: "at-123",
      refreshToken: "rt-456",
      idToken: "id-789",
      expiresAt: now + 3600 * 1000,
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(endpoints.tokenEndpoint);
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(init?.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe(meta.clientId);
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("redirect_uri")).toBe("http://localhost:9999");
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Request", { status: 400 }),
    );

    await expect(
      exchangeCodeForTokens(
        endpoints,
        meta,
        "bad-code",
        "verifier",
        "http://localhost:9999",
      ),
    ).rejects.toThrow("Token exchange failed: 400");
  });
});

describe("refreshTokens", () => {
  it("refreshes tokens using a refresh token", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-at",
          refresh_token: "new-rt",
          id_token: "new-id",
          expires_in: 7200,
        }),
        { status: 200 },
      ),
    );

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await refreshTokens(endpoints, meta, "old-rt");

    expect(result).toEqual({
      accessToken: "new-at",
      refreshToken: "new-rt",
      idToken: "new-id",
      expiresAt: now + 7200 * 1000,
    });

    const body = new URLSearchParams(
      mockFetch.mock.calls[0][1]?.body as string,
    );
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-rt");
  });

  it("keeps the original refresh token when server omits it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-at",
          id_token: "new-id",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    const result = await refreshTokens(endpoints, meta, "original-rt");
    expect(result.refreshToken).toBe("original-rt");
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    await expect(refreshTokens(endpoints, meta, "expired-rt")).rejects.toThrow(
      "Token refresh failed: 401",
    );
  });
});
