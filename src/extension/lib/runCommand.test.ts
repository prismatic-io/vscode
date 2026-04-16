import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

vi.mock(import("tinyexec"), () => ({
  x: vi.fn(),
}));

vi.mock(import("vscode"), () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: () => "off",
    })),
  },
}));

vi.mock(import("@/extension"), () => ({
  log: vi.fn(),
}));

import { x } from "tinyexec";
import * as vscode from "vscode";
import { log } from "@/extension";
import type { ExecutablePath } from "./resolveExecutable";
import { runExecutable, spawnExecutable } from "./runCommand";

describe("runExecutable", () => {
  it("runs a direct command and returns stdout/stderr", async () => {
    const expectedCommand = "/usr/local/bin/prism";
    const expectedStdout = "output\n";
    const expectedStderr = "";
    const executable: ExecutablePath = {
      command: expectedCommand,
      args: [],
    };

    vi.mocked(x).mockReturnValue({
      stdout: expectedStdout,
      stderr: expectedStderr,
      exitCode: 0,
    } as ReturnType<typeof x>);

    const result = await runExecutable(executable, ["me"]);

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      expectedCommand,
      ["me"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({}),
      }),
    );
    expect(result).toEqual({ stdout: expectedStdout, stderr: expectedStderr });
  });

  it("resolves npx commands correctly", async () => {
    const expectedPackage = "@prismatic-io/prism";
    const executable: ExecutablePath = {
      command: "npx",
      args: [expectedPackage],
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["login"]);

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      "npx",
      [expectedPackage, "login"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({}),
      }),
    );
  });

  it("attaches stdout and stderr to errors on non-zero exit", async () => {
    const expectedStdout = "partial output before failure";
    const expectedStderr = "webpack not found";
    const expectedExitCode = 127;
    const executable: ExecutablePath = {
      command: "/usr/local/bin/prism",
      args: [],
    };

    vi.mocked(x).mockReturnValue({
      stdout: expectedStdout,
      stderr: expectedStderr,
      exitCode: expectedExitCode,
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
    expect(err.message).toContain(`exit code ${expectedExitCode}`);
    expect(err.message).toContain(expectedStderr);
    expect(err.stdout).toBe(expectedStdout);
    expect(err.stderr).toBe(expectedStderr);
    expect(err.exitCode).toBe(expectedExitCode);
  });

  it("passes cwd and env options through", async () => {
    const expectedCommand = "/usr/bin/npm";
    const expectedCwd = "/project";
    const expectedEnv = { PATH: "/usr/bin", NODE_ENV: "test" };
    const executable: ExecutablePath = {
      command: expectedCommand,
      args: [],
    };

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["run", "build"], {
      cwd: expectedCwd,
      env: expectedEnv,
    });

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      expectedCommand,
      ["run", "build"],
      {
        nodeOptions: {
          cwd: expectedCwd,
          env: expectedEnv,
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
  it("returns a tinyexec result with process access", () => {
    const expectedCommand = "/usr/local/bin/prism";
    const expectedStdio = ["pipe", "pipe", "pipe"] as const;
    const mockChild = new EventEmitter() as ChildProcess;
    const executable: ExecutablePath = {
      command: expectedCommand,
      args: [],
    };

    vi.mocked(x).mockReturnValue({
      process: mockChild,
    } as ReturnType<typeof x>);

    const result = spawnExecutable(executable, ["login"], {
      nodeOptions: { stdio: [...expectedStdio] },
    });

    expect(result.process).toBe(mockChild);
    expect(vi.mocked(x)).toHaveBeenCalledWith(
      expectedCommand,
      ["login"],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          stdio: [...expectedStdio],
        }),
      }),
    );
  });
});

describe("logExecContext", () => {
  it("does not log when debug mode is off", async () => {
    const executable: ExecutablePath = {
      command: "/usr/bin/npm",
      args: [],
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: () => "off",
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["test"]);

    expect(vi.mocked(log)).not.toHaveBeenCalled();
  });

  it("logs command info when debug mode is basic", async () => {
    const expectedCommand = "/usr/bin/npm";
    const executable: ExecutablePath = {
      command: expectedCommand,
      args: [],
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: (_key: string, defaultValue?: string) =>
        _key === "debugMode" ? "basic" : defaultValue,
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    vi.mocked(x).mockReturnValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    } as ReturnType<typeof x>);

    await runExecutable(executable, ["test"]);

    expect(vi.mocked(log)).toHaveBeenCalledWith(
      "DEBUG",
      expect.stringContaining(`COMMAND: ${expectedCommand} test`),
    );
  });
});
