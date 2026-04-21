import { vi } from "vitest";

/**
 * Global `vscode` mock for all unit tests. Keeps tests from re-declaring the
 * mock per file. Tests that need per-test behavior should use `vi.spyOn` or
 * direct property assignment against the canonical mock rather than calling
 * `vi.mock("vscode")` again.
 */
vi.mock("vscode", async () => {
  const { createVscodeMock } = await import("@/test/unit/vscodeMock");
  return createVscodeMock();
});
