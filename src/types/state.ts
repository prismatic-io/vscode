import { z } from "zod";
import type { Connection } from "./connections";
import type { Flow } from "./flows";

export enum InstanceConfigState {
  FULLY_CONFIGURED = "FULLY_CONFIGURED",
  NEEDS_INSTANCE_CONFIGURATION = "NEEDS_INSTANCE_CONFIGURATION",
  NEEDS_USER_LEVEL_CONFIGURATION = "NEEDS_USER_LEVEL_CONFIGURATION",
}

export const GlobalStateSchema = z.object({
  prismaticUrl: z.string().optional(),
});
export type GlobalState = z.infer<typeof GlobalStateSchema>;

export const WorkspaceStateSchema = z.object({
  activeIntegrationPath: z.string().optional(),
  integrationId: z.string().optional(),
  systemInstanceId: z.string().optional(),
  flow: z
    .object({
      id: z.string(),
      name: z.string(),
      stableKey: z.string(),
    })
    .optional(),
  debugMode: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  payload: z.string().optional(),
  configState: z.enum(InstanceConfigState).optional(),
  flows: z.array(z.custom<Flow>()).optional(),
  connections: z.array(z.custom<Connection>()).optional(),
});
export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;
