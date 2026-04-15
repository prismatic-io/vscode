import { log } from "@/extension";
import type { StateManager } from "@/extension/StateManager";

export const syncPrismaticUrl = async (
  stateManager: StateManager,
): Promise<void> => {
  // step 1. check if prismatic url is already in global state
  const globalStatePrismaticUrl = (await stateManager.getGlobalState())
    ?.prismaticUrl;

  // step 2. get env prismatic url
  const envVariablePrismaticUrl = process.env.PRISMATIC_URL;

  if (envVariablePrismaticUrl) {
    // check if in sync
    if (envVariablePrismaticUrl === globalStatePrismaticUrl) {
      return;
    }

    log(
      "INFO",
      `Prismatic URL is out of sync, updating global state...
    - Global State: ${globalStatePrismaticUrl}
    - Env Variable: ${envVariablePrismaticUrl} (new)
    `,
    );

    // update global state
    await stateManager.updateGlobalState({
      prismaticUrl: envVariablePrismaticUrl,
    });
  }
};
