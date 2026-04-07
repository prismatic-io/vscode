import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({}));

import type * as vscode from "vscode";
import { SecretStore } from "./secretStore";
import type { TokenSet } from "./types";

const tokens: TokenSet = {
  accessToken: "at-123",
  refreshToken: "rt-456",
  idToken: "id-789",
  expiresAt: Date.now() + 3600_000,
};

const createMockContext = (): vscode.ExtensionContext => {
  const store = new Map<string, string>();
  const changeListeners: Array<(e: { key: string }) => void> = [];

  return {
    secrets: {
      store: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        for (const listener of changeListeners) {
          listener({ key });
        }
      }),
      get: vi.fn(async (key: string) => store.get(key)),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
        for (const listener of changeListeners) {
          listener({ key });
        }
      }),
      onDidChange: vi.fn((listener: (e: { key: string }) => void) => {
        changeListeners.push(listener);
        return {
          dispose: () => {
            const idx = changeListeners.indexOf(listener);
            if (idx >= 0) changeListeners.splice(idx, 1);
          },
        };
      }),
    },
  } as unknown as vscode.ExtensionContext;
};

describe("SecretStore", () => {
  let context: vscode.ExtensionContext;
  let secretStore: SecretStore;

  beforeEach(() => {
    context = createMockContext();
    secretStore = new SecretStore(context);
  });

  it("stores and retrieves tokens", async () => {
    await secretStore.storeTokens(tokens);
    const result = await secretStore.getTokens();
    expect(result).toEqual(tokens);
  });

  it("returns null when no tokens are stored", async () => {
    const result = await secretStore.getTokens();
    expect(result).toBeNull();
  });

  it("returns null when stored value is invalid JSON", async () => {
    await context.secrets.store("prismatic.tokens", "not-json{{{");
    const result = await secretStore.getTokens();
    expect(result).toBeNull();
  });

  it("clears tokens", async () => {
    await secretStore.storeTokens(tokens);
    await secretStore.clearTokens();
    const result = await secretStore.getTokens();
    expect(result).toBeNull();
  });

  it("fires onDidChange listener when tokens change", async () => {
    const listener = vi.fn();
    secretStore.onDidChange(listener);

    await secretStore.storeTokens(tokens);
    expect(listener).toHaveBeenCalledTimes(1);

    await secretStore.clearTokens();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not fire onDidChange for unrelated keys", async () => {
    const listener = vi.fn();
    secretStore.onDidChange(listener);

    // Simulate a change to a different key
    const changeListenerArg = vi.mocked(context.secrets.onDidChange).mock
      .calls[0][0];
    changeListenerArg({ key: "other.key" });

    expect(listener).not.toHaveBeenCalled();
  });
});
