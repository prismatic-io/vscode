import { describe, expect, it, vi } from "vitest";

vi.mock(import("tinyexec"), () => ({
  x: vi.fn(),
}));

vi.mock(import("node:fs"), () => ({
  existsSync: vi.fn(),
}));

vi.mock(import("package-manager-detector"), () => ({
  detect: vi.fn(),
}));

import { existsSync } from "node:fs";
import { detect } from "package-manager-detector";
import { x } from "tinyexec";
import * as vscode from "vscode";
import {
  resolvePackageManager,
  resolvePrismExecutable,
} from "./resolveExecutable";

const mockConfig = (values: Record<string, string>) => {
  vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
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

describe("resolvePackageManager", () => {
  it.each([
    {
      name: "npm",
      detectName: "npm" as const,
      agent: "npm" as const,
      binary: "npm",
      path: "/usr/bin/npm",
    },
    {
      name: "pnpm",
      detectName: "pnpm" as const,
      agent: "pnpm" as const,
      binary: "pnpm",
      path: "/opt/homebrew/bin/pnpm",
    },
    {
      name: "bun",
      detectName: "bun" as const,
      agent: "bun" as const,
      binary: "bun",
      path: "/opt/homebrew/bin/bun",
    },
    {
      name: "yarn@berry (strips version from PATH lookup)",
      detectName: "yarn" as const,
      agent: "yarn@berry" as const,
      binary: "yarn",
      path: "/opt/homebrew/bin/yarn",
    },
  ])("resolves $name on PATH when detected", async (tc) => {
    mockConfig({});
    vi.mocked(detect).mockResolvedValue({
      name: tc.detectName,
      agent: tc.agent,
    });
    mockWhichResult({ [tc.binary]: tc.path });

    const result = await resolvePackageManager("/project");

    expect(result).toEqual({
      packageManager: tc.agent,
      executable: { command: tc.path, args: [] },
      detectedFromProject: true,
    });
  });

  it("defaults to npm when no package manager is detected", async () => {
    const expectedPath = "/usr/local/bin/npm";

    mockConfig({});
    vi.mocked(detect).mockResolvedValue(null);
    mockWhichResult({ npm: expectedPath });

    const result = await resolvePackageManager("/project");

    expect(result).toEqual({
      packageManager: "npm",
      executable: { command: expectedPath, args: [] },
      detectedFromProject: false,
    });
  });

  it("returns executable null when the detected package manager is not installed", async () => {
    mockConfig({});
    vi.mocked(detect).mockResolvedValue({ name: "pnpm", agent: "pnpm" });
    mockWhichResult({});

    const result = await resolvePackageManager("/project");

    expect(result).toEqual({
      packageManager: "pnpm",
      executable: null,
      detectedFromProject: true,
    });
  });
});

describe("resolvePrismExecutable", () => {
  it("returns configured path when valid", async () => {
    const expectedPath = "/custom/prism";
    const expectedResult = { command: expectedPath, args: [] };

    mockConfig({ prismCliPath: expectedPath });
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await resolvePrismExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("finds prism on PATH", async () => {
    const expectedPath = "/usr/local/bin/prism";
    const expectedResult = { command: expectedPath, args: [] };

    mockConfig({});
    mockWhichResult({ prism: expectedPath });

    const result = await resolvePrismExecutable();

    expect(result).toEqual(expectedResult);
  });

  it("falls back to npx when prism not on PATH", async () => {
    const expectedResult = {
      command: "npx",
      args: ["@prismatic-io/prism"],
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
