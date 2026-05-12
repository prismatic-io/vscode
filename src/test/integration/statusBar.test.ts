import * as assert from "node:assert";
import type { AuthManager } from "../../extension/AuthManager";
import type { StatusBarManager } from "../../extension/StatusBarManager";
import { activateExtension, getTestApi, waitFor } from "./helpers/activation";

suite("Status bar user item command", () => {
  let authManager: AuthManager;
  let statusBarManager: StatusBarManager;

  suiteSetup(async () => {
    await activateExtension();
    const api = await getTestApi();
    authManager = api.authManager;
    statusBarManager = api.statusBarManager;
  });

  test("logged-out item invokes the login command", async () => {
    await authManager.logout();
    await statusBarManager.updateUserStatusBar();
    await waitFor(
      () => statusBarManager.userStatusBarCommand === "prismatic.login",
    );

    assert.strictEqual(
      statusBarManager.userStatusBarCommand,
      "prismatic.login",
    );
  });
});
