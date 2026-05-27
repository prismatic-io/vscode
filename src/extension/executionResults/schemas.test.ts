import { describe, expect, it } from "vitest";
import {
  BatchPageInfoSchema,
  BatchProgressSchema,
  ExecutionBatchesConnectionSchema,
  ExecutionBatchNodeSchema,
} from "./schemas";

describe("BatchProgressSchema", () => {
  it("parses a fully-populated snapshot", () => {
    const parsed = BatchProgressSchema.parse({
      discovered: 10,
      discoveryComplete: true,
      completed: 8,
      failed: 1,
      canceled: 0,
      queued: 0,
      running: 1,
      total: 10,
      concurrencyLimit: 5,
      concurrencyLimitSource: "TENANT",
    });
    expect(parsed.concurrencyLimitSource).toBe("TENANT");
  });

  it("defaults nullable concurrency fields and counts", () => {
    const parsed = BatchProgressSchema.parse({
      discovered: 0,
      discoveryComplete: false,
      completed: 0,
      failed: 0,
      canceled: 0,
      queued: 0,
      running: 0,
      total: 0,
      concurrencyLimit: null,
      concurrencyLimitSource: null,
    });
    expect(parsed.concurrencyLimit).toBeNull();
    expect(parsed.concurrencyLimitSource).toBeNull();
  });
});

describe("ExecutionBatchNodeSchema", () => {
  it("parses a discovery node with null timestamps", () => {
    const parsed = ExecutionBatchNodeSchema.parse({
      id: "node:1",
      key: null,
      displayKey: "abc123",
      role: "discovery",
      status: "queued",
      recordCount: 0,
      stepCount: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      label: "discovery",
    });
    expect(parsed.role).toBe("discovery");
    expect(parsed.startedAt).toBeNull();
  });

  it("accepts a processing node with error", () => {
    const parsed = ExecutionBatchNodeSchema.parse({
      id: "node:2",
      key: "batch-0001",
      displayKey: "batch-0001",
      role: "processing",
      status: "fail",
      recordCount: 100,
      stepCount: 5,
      errorMessage: "boom",
      startedAt: "2026-05-20T00:00:00Z",
      completedAt: "2026-05-20T00:01:00Z",
      label: "100 records",
    });
    expect(parsed.status).toBe("fail");
    expect(parsed.errorMessage).toBe("boom");
  });
});

describe("BatchPageInfoSchema", () => {
  it("parses null cursor", () => {
    const parsed = BatchPageInfoSchema.parse({
      endCursor: null,
      hasNextPage: false,
    });
    expect(parsed.endCursor).toBeNull();
  });
});

describe("ExecutionBatchesConnectionSchema", () => {
  it("parses an empty connection", () => {
    const parsed = ExecutionBatchesConnectionSchema.parse({
      totalCount: 0,
      nodes: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });
    expect(parsed.totalCount).toBe(0);
    expect(parsed.nodes).toEqual([]);
  });
});
