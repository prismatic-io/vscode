import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDiscoveryCache,
  fetchAuthMeta,
  fetchOIDCEndpoints,
} from "./discovery";
import type { AuthMeta } from "./types";

const authMeta: AuthMeta = {
  domain: "auth.example.com",
  audience: "https://api.example.com",
  clientId: "client-123",
  connection: "Username-Password-Authentication",
};

const oidcConfig = {
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/oauth/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  revocation_endpoint: "https://auth.example.com/oauth/revoke",
};

describe("fetchAuthMeta", () => {
  beforeEach(() => {
    clearDiscoveryCache();
  });

  it("fetches auth meta from the prismatic URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(authMeta), { status: 200 }),
    );

    const result = await fetchAuthMeta("https://app.prismatic.io");

    expect(result).toEqual(authMeta);
    expect(fetch).toHaveBeenCalledWith("https://app.prismatic.io/auth/meta");
  });

  it("returns cached result on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      );

    await fetchAuthMeta("https://app.prismatic.io");
    const result = await fetchAuthMeta("https://app.prismatic.io");

    expect(result).toEqual(authMeta);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("caches per URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      );

    await fetchAuthMeta("https://a.prismatic.io");
    await fetchAuthMeta("https://b.prismatic.io");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );

    await expect(fetchAuthMeta("https://app.prismatic.io")).rejects.toThrow(
      "Failed to fetch auth config",
    );
  });
});

describe("fetchOIDCEndpoints", () => {
  beforeEach(() => {
    clearDiscoveryCache();
  });

  it("fetches and maps OIDC endpoints from well-known config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(oidcConfig), { status: 200 }),
    );

    const result = await fetchOIDCEndpoints("auth.example.com");

    expect(result).toEqual({
      authorizationEndpoint: oidcConfig.authorization_endpoint,
      tokenEndpoint: oidcConfig.token_endpoint,
      userinfoEndpoint: oidcConfig.userinfo_endpoint,
      revocationEndpoint: oidcConfig.revocation_endpoint,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example.com/.well-known/openid-configuration",
    );
  });

  it("returns cached result on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(oidcConfig), { status: 200 }),
      );

    await fetchOIDCEndpoints("auth.example.com");
    await fetchOIDCEndpoints("auth.example.com");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    await expect(fetchOIDCEndpoints("auth.example.com")).rejects.toThrow(
      "Failed to fetch OIDC configuration",
    );
  });
});

describe("clearDiscoveryCache", () => {
  it("clears cache for a specific URL and its associated OIDC domain", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(oidcConfig), { status: 200 }),
      );

    await fetchAuthMeta("https://app.prismatic.io");
    await fetchOIDCEndpoints("auth.example.com");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    clearDiscoveryCache("https://app.prismatic.io");

    // Re-mock for the re-fetches
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(oidcConfig), { status: 200 }),
      );

    await fetchAuthMeta("https://app.prismatic.io");
    await fetchOIDCEndpoints("auth.example.com");

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("clears all caches when called without arguments", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      );

    await fetchAuthMeta("https://a.prismatic.io");
    await fetchAuthMeta("https://b.prismatic.io");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    clearDiscoveryCache();

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authMeta), { status: 200 }),
      );

    await fetchAuthMeta("https://a.prismatic.io");
    await fetchAuthMeta("https://b.prismatic.io");

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});
