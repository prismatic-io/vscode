import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

vi.mock("tinyexec", () => ({
  x: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { x } from "tinyexec";
import * as vscode from "vscode";
import {
  resolveNpmExecutable,
  resolvePrismExecutable,
} from "./resolveExecutable";

function mockConfig(values: Record<string, string>) {
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: (key: string) => values[key] ?? "",
  } as ReturnType<typeof vscode.workspace.getConfiguration>);
}

function mockWhichResult(results: Record<string, string | null>) {
  vi.mocked(x).mockImplementation((cmd: string, args?: string[]) => {
    const name = args?.[0] ?? "";

    // which/where calls
    if (cmd === "which" || cmd === "where") {
      const path = results[name];
      if (path) {
        return { stdout: path, stderr: "" } as ReturnType<typeof x>;
      }
      throw new Error(`not found: ${name}`);
    }

    // npx --version calls
    if (cmd === "npx") {
      return { stdout: "1.0.0", stderr: "" } as ReturnType<typeof x>;
    }

    throw new Error(`unexpected command: ${cmd}`);
  });
}

describe("resolveNpmExecutable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns configured path when valid", async () => {
    mockConfig({ npmCliPath: "/custom/npm" });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await resolveNpmExecutable();

    expect(result).toEqual({
      command: "/custom/npm",
      args: [],
      isNpx: false,
    });
  });

  it("falls through when configured path does not exist", async () => {
    mockConfig({ npmCliPath: "/nonexistent/npm" });
    vi.mocked(existsSync).mockReturnValue(false);
    mockWhichResult({ npm: "/usr/bin/npm" });

    const result = await resolveNpmExecutable();

    expect(result).toEqual({
      command: "/usr/bin/npm",
      args: [],
      isNpx: false,
    });
  });

  it("falls through when config is empty", async () => {
    mockConfig({});
    mockWhichResult({ npm: "/usr/local/bin/npm" });

    const result = await resolveNpmExecutable();

    expect(result).toEqual({
      command: "/usr/local/bin/npm",
      args: [],
      isNpx: false,
    });
  });

  it("finds npm on PATH", async () => {
    mockConfig({});
    mockWhichResult({ npm: "/opt/homebrew/bin/npm" });

    const result = await resolveNpmExecutable();

    expect(result).toEqual({
      command: "/opt/homebrew/bin/npm",
      args: [],
      isNpx: false,
    });
  });

  it("returns null when npm is not found anywhere", async () => {
    mockConfig({});
    mockWhichResult({});

    const result = await resolveNpmExecutable();

    expect(result).toBeNull();
  });
});

describe("resolvePrismExecutable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns configured path when valid", async () => {
    mockConfig({ prismCliPath: "/custom/prism" });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await resolvePrismExecutable();

    expect(result).toEqual({
      command: "/custom/prism",
      args: [],
      isNpx: false,
    });
  });

  it("finds prism on PATH", async () => {
    mockConfig({});
    mockWhichResult({ prism: "/usr/local/bin/prism" });

    const result = await resolvePrismExecutable();

    expect(result).toEqual({
      command: "/usr/local/bin/prism",
      args: [],
      isNpx: false,
    });
  });

  it("falls back to npx when prism not on PATH", async () => {
    mockConfig({});
    mockWhichResult({});
    // x is already set up to succeed for npx calls via mockWhichResult

    // Override to make which fail but npx succeed
    vi.mocked(x).mockImplementation((cmd: string) => {
      if (cmd === "which" || cmd === "where") {
        throw new Error("not found");
      }
      if (cmd === "npx") {
        return { stdout: "1.0.0", stderr: "" } as ReturnType<typeof x>;
      }
      throw new Error(`unexpected: ${cmd}`);
    });

    const result = await resolvePrismExecutable();

    expect(result).toEqual({
      command: "npx",
      args: ["@prismatic-io/prism"],
      isNpx: true,
    });
  });

  it("returns null when prism not found and npx unavailable", async () => {
    mockConfig({});
    vi.mocked(x).mockImplementation(() => {
      throw new Error("not found");
    });

    const result = await resolvePrismExecutable();

    expect(result).toBeNull();
  });

  it("returns null when everything fails", async () => {
    mockConfig({ prismCliPath: "/bad/path" });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(x).mockImplementation(() => {
      throw new Error("not found");
    });

    const result = await resolvePrismExecutable();

    expect(result).toBeNull();
  });
});
