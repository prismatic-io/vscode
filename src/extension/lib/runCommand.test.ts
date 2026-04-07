import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("tinyexec", () => ({
  x: vi.fn(),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: () => "off",
    })),
  },
}));

vi.mock("@/extension", () => ({
  log: vi.fn(),
}));

import { x } from "tinyexec";
import * as vscode from "vscode";
import { log } from "@/extension";
import type { ExecutablePath } from "./resolveExecutable";
import { runExecutable, spawnExecutable } from "./runCommand";

describe("runExecutable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a direct command and returns stdout/stderr", async () => {
    const executable: ExecutablePath = {
      command: "/usr/local/bin/prism",
      args: [],
      isNpx: false,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "output\n",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    const result = await runExecutable(executable, ["me"]);

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      "/usr/local/bin/prism",
      ["me"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({}),
      }),
    );
    expect(result).toEqual({ stdout: "output\n", stderr: "" });
  });

  it("resolves npx commands correctly", async () => {
    const executable: ExecutablePath = {
      command: "npx",
      args: ["@prismatic-io/prism"],
      isNpx: true,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["login"]);

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      "npx",
      ["@prismatic-io/prism", "login"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({}),
      }),
    );
  });

  it("attaches stdout and stderr to errors on non-zero exit", async () => {
    const executable: ExecutablePath = {
      command: "/usr/local/bin/prism",
      args: [],
      isNpx: false,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "partial output before failure",
      stderr: "webpack not found",
      exitCode: 127,
    } as ReturnType<typeof x>);

    const error = await runExecutable(executable, ["build"]).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(Error);
    const err = error as Error & {
      stdout: string;
      stderr: string;
      exitCode: number;
    };
    expect(err.message).toContain("exit code 127");
    expect(err.message).toContain("webpack not found");
    expect(err.stdout).toBe("partial output before failure");
    expect(err.stderr).toBe("webpack not found");
    expect(err.exitCode).toBe(127);
  });

  it("passes cwd and env options through", async () => {
    const executable: ExecutablePath = {
      command: "/usr/bin/npm",
      args: [],
      isNpx: false,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["run", "build"], {
      cwd: "/project",
      env: { PATH: "/usr/bin", NODE_ENV: "test" },
    });

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      "/usr/bin/npm",
      ["run", "build"],
      {
        nodeOptions: {
          cwd: "/project",
          env: { PATH: "/usr/bin", NODE_ENV: "test" },
        },
      },
    );
  });

  it("excludes DEBUG from env when callers destructure process.env", async () => {
    const { x: realX } =
      await vi.importActual<typeof import("tinyexec")>("tinyexec");
    vi.mocked(x).mockImplementation(realX);

    const { DEBUG: _, ...execEnv } = { ...process.env, DEBUG: "true" };
    const executable: ExecutablePath = {
      command: process.execPath,
      args: [],
      isNpx: false,
    };

    const result = await runExecutable(
      executable,
      ["-e", "console.log(JSON.stringify(process.env))"],
      { env: execEnv },
    );
    const childEnv = JSON.parse(result.stdout);

    expect(childEnv).not.toHaveProperty("DEBUG");
  });
});

describe("spawnExecutable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a tinyexec result with process access", () => {
    const mockChild = new EventEmitter() as ChildProcess;
    vi.mocked(x).mockReturnValue({
      process: mockChild,
    } as ReturnType<typeof x>);

    const executable: ExecutablePath = {
      command: "/usr/local/bin/prism",
      args: [],
      isNpx: false,
    };

    const result = spawnExecutable(executable, ["login"], {
      nodeOptions: { stdio: ["pipe", "pipe", "pipe"] },
    });

    expect(result.process).toBe(mockChild);
    expect(vi.mocked(x)).toHaveBeenCalledWith(
      "/usr/local/bin/prism",
      ["login"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      }),
    );
  });
});

describe("logExecContext", () => {
  it("does not log when debug mode is off", async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: () => "off",
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    const executable: ExecutablePath = {
      command: "/usr/bin/npm",
      args: [],
      isNpx: false,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["test"]);

    expect(vi.mocked(log)).not.toHaveBeenCalled();
  });

  it("logs command info when debug mode is basic", async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: (_key: string, defaultValue?: string) =>
        _key === "debugMode" ? "basic" : defaultValue,
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    const executable: ExecutablePath = {
      command: "/usr/bin/npm",
      args: [],
      isNpx: false,
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["test"]);

    expect(vi.mocked(log)).toHaveBeenCalledWith(
      "DEBUG",
      expect.stringContaining("COMMAND: /usr/bin/npm test"),
    );
  });
});
