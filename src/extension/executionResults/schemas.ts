import { z } from "zod";

export const ConcurrencyLimitSourceSchema = z.union([
  z.literal("TENANT"),
  z.literal("CUSTOMER"),
  z.literal("FIFO"),
]);

export const BatchProgressSchema = z.object({
  discovered: z.number().int().nonnegative().default(0),
  discoveryComplete: z.boolean().default(false),
  completed: z.number().int().nonnegative().default(0),
  failed: z.number().int().nonnegative().default(0),
  canceled: z.number().int().nonnegative().default(0),
  queued: z.number().int().nonnegative().default(0),
  running: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
  concurrencyLimit: z.number().int().nullable().default(null),
  concurrencyLimitSource: ConcurrencyLimitSourceSchema.nullable().default(null),
});

export const ExecutionBatchNodeSchema = z.object({
  id: z.string(),
  key: z.string().nullable().optional(),
  displayKey: z.string(),
  role: z.union([z.literal("processing"), z.literal("discovery")]),
  status: z.union([
    z.literal("success"),
    z.literal("fail"),
    z.literal("running"),
    z.literal("queued"),
    z.literal("partial"),
  ]),
  recordCount: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  label: z.string(),
});

export const BatchPageInfoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export const ExecutionBatchesConnectionSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  nodes: z.array(ExecutionBatchNodeSchema),
  pageInfo: BatchPageInfoSchema,
});
