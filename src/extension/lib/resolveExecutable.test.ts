import { describe, expect, it, vi } from "vitest";

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

const mockConfig = (values: Record<string, string>) => {
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: (key: string) => values[key] ?? "",
  } as ReturnType<typeof vscode.workspace.getConfiguration>);
};

const mockWhichResult = (results: Record<string, string | null>) => {
  vi.mocked(x).mockImplementation((cmd: string, args?: string[]) => {
    const name = args?.[0] ?? "";

    if (cmd === "which" || cmd === "where") {
      const path = results[name];
      if (path) {
        return { stdout: path, stderr: "" } as ReturnType<typeof x>;
      }
      throw new Error(`not found: ${name}`);
    }

    if (cmd === "npx") {
      return { stdout: "1.0.0", stderr: "" } as ReturnType<typeof x>;
    }

    throw new Error(`unexpected command: ${cmd}`);
  });
};

describe("resolveNpmExecutable", () => {
  it("returns configured path when valid", async () => {
    const expectedPath = "/custom/npm";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({ npmCliPath: expectedPath });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await resolveNpmExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("falls through when configured path does not exist", async () => {
    const expectedPath = "/usr/bin/npm";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({ npmCliPath: "/nonexistent/npm" });
    vi.mocked(existsSync).mockReturnValue(false);
    mockWhichResult({ npm: expectedPath });

    const result = await resolveNpmExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("falls through when config is empty", async () => {
    const expectedPath = "/usr/local/bin/npm";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({});
    mockWhichResult({ npm: expectedPath });

    const result = await resolveNpmExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("finds npm on PATH", async () => {
    const expectedPath = "/opt/homebrew/bin/npm";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({});
    mockWhichResult({ npm: expectedPath });

    const result = await resolveNpmExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("returns null when npm is not found anywhere", async () => {
    mockConfig({});
    mockWhichResult({});

    const result = await resolveNpmExecutable();

    expect(result).toBeNull();
  });
});

describe("resolvePrismExecutable", () => {
  it("returns configured path when valid", async () => {
    const expectedPath = "/custom/prism";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({ prismCliPath: expectedPath });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await resolvePrismExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("finds prism on PATH", async () => {
    const expectedPath = "/usr/local/bin/prism";
    const expectedResult = { command: expectedPath, args: [], isNpx: false };

    mockConfig({});
    mockWhichResult({ prism: expectedPath });

    const result = await resolvePrismExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("falls back to npx when prism not on PATH", async () => {
    const expectedResult = {
      command: "npx",
      args: ["@prismatic-io/prism"],
      isNpx: true,
    };

    mockConfig({});
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

    expect(result).toEqual(expectedResult);
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
