import type { AuthManager } from "../../extension/AuthManager";
import type { StatusBarManager } from "../../extension/StatusBarManager";
import { activateExtension, getTestApi, waitFor } from "./helpers/activation";

suite("Auth event propagation", () => {
  let authManager: AuthManager;
  let statusBarManager: StatusBarManager;

  suiteSetup(async () => {
    await activateExtension();
    const api = await getTestApi();
    authManager = api.authManager;
    statusBarManager = api.statusBarManager;
  });

  test("logout drives StatusBarManager.updateUserStatusBar via onDidChangeAuth", async () => {
    const original =
      statusBarManager.updateUserStatusBar.bind(statusBarManager);
    let calls = 0;
    statusBarManager.updateUserStatusBar = async () => {
      calls++;
      await original();
    };

    try {
      await authManager.logout();
      // Subscriber is fire-and-forget (`void instance.updateUserStatusBar()`),
      // so the call lands on a later microtask.
      await waitFor(() => calls >= 1);
    } finally {
      statusBarManager.updateUserStatusBar = original;
    }
  });
});
