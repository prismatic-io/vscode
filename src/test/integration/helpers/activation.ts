import { setTimeout as sleep } from "node:timers/promises";
import * as vscode from "vscode";
import type { AuthManager } from "../../../extension/AuthManager";
import type { StatusBarManager } from "../../../extension/StatusBarManager";

export const EXTENSION_ID = "prismatic.prismatic-io";

export interface ExtensionTestApi {
  authManager: AuthManager;
  statusBarManager: StatusBarManager;
}

export const activateExtension = async (): Promise<void> => {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension '${EXTENSION_ID}' not found.`);
  }
  if (!ext.isActive) {
    await ext.activate();
  }
};

export const getTestApi = async (): Promise<ExtensionTestApi> => {
  const api = await vscode.commands.executeCommand<ExtensionTestApi>(
    "prismatic._test.getApi",
  );
  if (!api) {
    throw new Error("Test API not available. Is the extension activated?");
  }
  return api;
};

export const waitFor = async (
  predicate: () => boolean,
  { timeoutMs = 2000, intervalMs = 10 } = {},
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`waitFor: predicate not satisfied within ${timeoutMs}ms`);
};
