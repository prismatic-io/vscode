import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("node:fs"), () => ({
  existsSync: vi.fn(),
}));

vi.mock(import("@/extension"), () => ({
  log: vi.fn(),
}));

vi.mock(import("@/extension/lib/getWorkspaceJsonFile"), () => ({
  getWorkspaceJsonFile: vi.fn(),
}));

vi.mock(import("@/extension/lib/resolveExecutable"), () => ({
  resolvePackageManager: vi.fn(),
  packageManagerBinary: (pm: string) => pm.split("@")[0],
}));

vi.mock(import("@/extension/lib/runCommand"), () => ({
  runExecutable: vi.fn(),
  spawnExecutable: vi.fn(),
}));

import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { log } from "@/extension";
import { getWorkspaceJsonFile } from "@/extension/lib/getWorkspaceJsonFile";
import { resolvePackageManager } from "@/extension/lib/resolveExecutable";
import { runExecutable, spawnExecutable } from "@/extension/lib/runCommand";
import { runProjectScript } from "./runProjectScript";

const integrationPath = "/project";
const executable = { command: "/usr/bin/npm", args: [] };

const mockPackageJsonPresent = () => {
  vi.mocked(getWorkspaceJsonFile).mockReturnValue({
    workspaceFolderPath: integrationPath,
    filePath: `${integrationPath}/package.json`,
    fileData: { name: "integration" },
  });
};

const mockPackageManagerResolved = (packageManager = "npm" as const) => {
  vi.mocked(resolvePackageManager).mockResolvedValue({
    packageManager,
    executable,
    detectedFromProject: true,
  });
};

const mockSpawnedProc = (lines: string[], exitCode = 0) => {
  const proc = {
    exitCode: undefined as number | undefined,
    async *[Symbol.asyncIterator]() {
      for (const line of lines) yield line;
      proc.exitCode = exitCode;
    },
  };
  vi.mocked(spawnExecutable).mockReturnValue(
    proc as unknown as ReturnType<typeof spawnExecutable>,
  );
  return proc;
};

beforeEach(() => {
  vi.mocked(runExecutable).mockResolvedValue({ stdout: "", stderr: "" });
  vi.spyOn(vscode.window, "showWarningMessage");
  vi.spyOn(vscode.window, "withProgress").mockImplementation(
    async (_opts, task) =>
      task({ report: vi.fn() }, {
        isCancellationRequested: false,
      } as unknown as vscode.CancellationToken),
  );
});

describe("runProjectScript", () => {
  it("runs the script directly when node_modules exists", async () => {
    mockPackageJsonPresent();
    mockPackageManagerResolved();
    vi.mocked(existsSync).mockReturnValue(true);

    await runProjectScript(integrationPath, "build");

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(spawnExecutable).not.toHaveBeenCalled();
    expect(runExecutable).toHaveBeenCalledTimes(1);
    expect(runExecutable).toHaveBeenCalledWith(
      executable,
      ["run", "build"],
      expect.objectContaining({ cwd: integrationPath }),
    );
  });

  it("prompts, streams install output, then runs script when user accepts", async () => {
    mockPackageJsonPresent();
    mockPackageManagerResolved("pnpm");
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Install" as never,
    );
    mockSpawnedProc(["added 42 packages", "done in 3s"]);

    await runProjectScript(integrationPath, "build");

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("'pnpm install'"),
      { modal: true },
      "Install",
    );
    expect(vscode.window.withProgress).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Running pnpm install…" }),
      expect.any(Function),
    );
    expect(spawnExecutable).toHaveBeenCalledWith(executable, ["install"], {
      cwd: integrationPath,
    });
    expect(log).toHaveBeenCalledWith("INFO", "added 42 packages");
    expect(log).toHaveBeenCalledWith("INFO", "done in 3s");
    expect(runExecutable).toHaveBeenCalledWith(
      executable,
      ["run", "build"],
      expect.objectContaining({ cwd: integrationPath }),
    );
  });

  it("throws when the install process exits non-zero", async () => {
    mockPackageJsonPresent();
    mockPackageManagerResolved("npm");
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Install" as never,
    );
    mockSpawnedProc(["npm err: boom"], 1);

    await expect(runProjectScript(integrationPath, "build")).rejects.toThrow(
      /npm install exited with code 1/,
    );
    expect(runExecutable).not.toHaveBeenCalled();
  });

  it("throws with install hint when user dismisses the prompt", async () => {
    mockPackageJsonPresent();
    mockPackageManagerResolved("bun");
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await expect(runProjectScript(integrationPath, "build")).rejects.toThrow(
      /bun install.*\/project/,
    );
    expect(spawnExecutable).not.toHaveBeenCalled();
    expect(runExecutable).not.toHaveBeenCalled();
  });

  it("throws with install-page hint when detected package manager is not on PATH", async () => {
    mockPackageJsonPresent();
    vi.mocked(resolvePackageManager).mockResolvedValue({
      packageManager: "pnpm",
      executable: null,
      detectedFromProject: true,
    });

    await expect(runProjectScript(integrationPath, "build")).rejects.toThrow(
      /pnpm.*pnpm\.io/,
    );
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(runExecutable).not.toHaveBeenCalled();
  });

  it("throws when package.json is missing", async () => {
    vi.mocked(getWorkspaceJsonFile).mockReturnValue({
      workspaceFolderPath: integrationPath,
      filePath: `${integrationPath}/package.json`,
      fileData: null,
    });

    await expect(runProjectScript(integrationPath, "build")).rejects.toThrow(
      /No package\.json/,
    );
    expect(resolvePackageManager).not.toHaveBeenCalled();
  });
});
