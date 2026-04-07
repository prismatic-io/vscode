/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let messageListeners: Array<(event: MessageEvent) => void> = [];

const dispatchWindowMessage = (data: unknown) => {
  const event = new MessageEvent("message", { data });
  for (const listener of messageListeners) {
    listener(event);
  }
};

describe("fetcher", () => {
  let fetcher: typeof import("./fetcher").fetcher;

  beforeEach(async () => {
    messageListeners = [];

    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: unknown) => {
        if (type === "message") {
          messageListeners.push(listener as (event: MessageEvent) => void);
        }
      },
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { result: true } }), {
        status: 200,
      }),
    );

    vi.resetModules();
    const mod = await import("./fetcher");
    fetcher = mod.fetcher;
  });

  it("uses variable overrides when module state is unset", async () => {
    const expectedToken = "override-token";
    const expectedUrl = "https://override.prismatic.io";

    const result = await fetcher("{ query }", {
      accessToken: expectedToken,
      prismaticUrl: expectedUrl,
    });

    expect(result).toEqual({ data: { result: true } });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
    expect(init?.headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${expectedToken}`,
      }),
    );
  });

  it("updates accessToken from accessToken message", async () => {
    const expectedToken = "msg-token";

    dispatchWindowMessage({
      type: "accessToken",
      payload: { token: expectedToken },
    });

    await fetcher("{ query }", {
      accessToken: "should-be-ignored",
      prismaticUrl: "https://app.prismatic.io",
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(init?.headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${expectedToken}`,
      }),
    );
  });

  it("clears accessToken when message payload token is null", async () => {
    const expectedFallbackToken = "fallback-token";

    dispatchWindowMessage({
      type: "accessToken",
      payload: { token: "initial-token" },
    });

    dispatchWindowMessage({
      type: "accessToken",
      payload: { token: null },
    });

    await fetcher("{ query }", {
      accessToken: expectedFallbackToken,
      prismaticUrl: "https://app.prismatic.io",
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(init?.headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${expectedFallbackToken}`,
      }),
    );
  });

  it("updates prismaticUrl from stateChange global message", async () => {
    const expectedUrl = "https://updated.prismatic.io";

    dispatchWindowMessage({
      type: "stateChange",
      payload: {
        scope: "global",
        value: { prismaticUrl: expectedUrl },
      },
    });

    await fetcher("{ query }", {
      accessToken: "token",
      prismaticUrl: "https://should-be-ignored.prismatic.io",
    });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
  });

  it("preserves prismaticUrl when stateChange has no prismaticUrl", async () => {
    const expectedUrl = "https://first.prismatic.io";

    dispatchWindowMessage({
      type: "stateChange",
      payload: {
        scope: "global",
        value: { prismaticUrl: expectedUrl },
      },
    });

    dispatchWindowMessage({
      type: "stateChange",
      payload: {
        scope: "global",
        value: {},
      },
    });

    await fetcher("{ query }", {
      accessToken: "token",
      prismaticUrl: "https://fallback.prismatic.io",
    });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
  });

  it("hydrates prismaticUrl from getState global message", async () => {
    const expectedUrl = "https://hydrated.prismatic.io";

    dispatchWindowMessage({
      type: "getState",
      payload: {
        scope: "global",
        value: { prismaticUrl: expectedUrl },
      },
    });

    await fetcher("{ query }", {
      accessToken: "token",
      prismaticUrl: "https://should-be-ignored.prismatic.io",
    });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
  });

  it("ignores getState messages without a value", async () => {
    const expectedUrl = "https://fallback.prismatic.io";

    dispatchWindowMessage({
      type: "getState",
      payload: {
        scope: "global",
      },
    });

    await fetcher("{ query }", {
      accessToken: "token",
      prismaticUrl: expectedUrl,
    });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
  });

  it("ignores stateChange messages for workspace scope", async () => {
    const expectedUrl = "https://fallback.prismatic.io";

    dispatchWindowMessage({
      type: "stateChange",
      payload: {
        scope: "workspace",
        value: { prismaticUrl: "https://workspace.prismatic.io" },
      },
    });

    await fetcher("{ query }", {
      accessToken: "token",
      prismaticUrl: expectedUrl,
    });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${expectedUrl}/api`);
  });

  it("sends query and variables in the request body", async () => {
    const expectedQuery =
      "query GetThing($id: ID!) { thing(id: $id) { name } }";
    const expectedId = "thing-123";

    await fetcher(expectedQuery, {
      accessToken: "token",
      prismaticUrl: "https://app.prismatic.io",
      id: expectedId,
    } as never);

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.query).toBe(expectedQuery);
    expect(body.variables).toEqual({ id: expectedId });
    expect(body.variables).not.toHaveProperty("accessToken");
    expect(body.variables).not.toHaveProperty("prismaticUrl");
  });

  it("throws on non-OK response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    await expect(
      fetcher("{ query }", {
        accessToken: "token",
        prismaticUrl: "https://app.prismatic.io",
      }),
    ).rejects.toThrow("Failed to fetch data");
  });
});
