import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findSpectralDirectories } from "./findSpectralDirectories";

describe("findSpectralDirectories", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectral-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds a .spectral directory at the root level", () => {
    fs.mkdirSync(path.join(tmpDir, ".spectral"));

    const results = findSpectralDirectories(tmpDir);
    expect(results).toEqual([path.join(tmpDir, ".spectral")]);
  });

  it("finds nested .spectral directories", () => {
    fs.mkdirSync(
      path.join(tmpDir, "integrations", "my-integration", ".spectral"),
      {
        recursive: true,
      },
    );

    const results = findSpectralDirectories(tmpDir);
    expect(results).toEqual([
      path.join(tmpDir, "integrations", "my-integration", ".spectral"),
    ]);
  });

  it("finds multiple .spectral directories in a monorepo", () => {
    fs.mkdirSync(path.join(tmpDir, "integration-a", ".spectral"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmpDir, "integration-b", ".spectral"), {
      recursive: true,
    });

    const results = findSpectralDirectories(tmpDir);
    expect(results).toHaveLength(2);
    expect(results).toContain(path.join(tmpDir, "integration-a", ".spectral"));
    expect(results).toContain(path.join(tmpDir, "integration-b", ".spectral"));
  });

  it("skips node_modules, dist, .git, and .vscode directories", () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules", ".spectral"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmpDir, "dist", ".spectral"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".git", ".spectral"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".vscode", ".spectral"), {
      recursive: true,
    });

    const results = findSpectralDirectories(tmpDir);
    expect(results).toEqual([]);
  });

  it("respects maxDepth", () => {
    // Create .spectral at depth 3
    fs.mkdirSync(path.join(tmpDir, "a", "b", "c", ".spectral"), {
      recursive: true,
    });

    expect(findSpectralDirectories(tmpDir, { maxDepth: 2 })).toEqual([]);
    expect(findSpectralDirectories(tmpDir, { maxDepth: 3 })).toHaveLength(1);
  });

  it("returns empty array when no .spectral directories exist", () => {
    fs.mkdirSync(path.join(tmpDir, "src"));
    fs.mkdirSync(path.join(tmpDir, "lib"));

    const results = findSpectralDirectories(tmpDir);
    expect(results).toEqual([]);
  });

  it("handles non-existent root path gracefully", () => {
    const results = findSpectralDirectories(
      path.join(tmpDir, "does-not-exist"),
    );
    expect(results).toEqual([]);
  });
});
