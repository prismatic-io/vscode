import { useSelector } from "@xstate/react";
import { type ActorRef, createEmptyActor, type Subscribable } from "xstate";

const fallbackActor = createEmptyActor();

export const useConditionalSelector = <
  // biome-ignore lint/suspicious/noExplicitAny: XState ActorRef requires any for generic constraints
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never,
>(
  actor: TActor | null | undefined,
  selector: (emitted: TEmitted) => T,
  fallback: T,
  compare?: (a: T, b: T) => boolean,
): T => {
  return useSelector(
    actor ?? (fallbackActor as TActor),
    actor ? selector : () => fallback,
    compare,
  );
};
