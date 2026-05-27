import { encode } from "@msgpack/msgpack";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adaptBatchNode,
  cancelBatchExecution,
  fetchStepOutput,
  shortIdFromGlobalId,
  toBatchNodeStatus,
  transformStepOutput,
} from "./api";

describe("transformStepOutput", () => {
  it("returns primitives unchanged", () => {
    expect(transformStepOutput(42)).toBe(42);
    expect(transformStepOutput("foo")).toBe("foo");
    expect(transformStepOutput(null)).toBeNull();
  });

  it("walks arrays", () => {
    expect(transformStepOutput([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("replaces binary data with a byte-count placeholder", () => {
    const binary = new Uint8Array([1, 2, 3, 4]);
    const result = transformStepOutput({ data: binary });
    expect(result).toBe("<data (4 bytes)>");
  });

  it("inlines image data as a base64 data URI", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = transformStepOutput({
      data: png,
      contentType: "image/png",
    }) as string;

    expect(result.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("serializes dates to ISO strings", () => {
    const date = new Date("2026-04-17T00:00:00.000Z");
    expect(transformStepOutput(date)).toBe("2026-04-17T00:00:00.000Z");
  });

  it("recurses through nested objects", () => {
    const nested = {
      outer: {
        inner: { data: new Uint8Array([9, 9]) },
      },
    };

    expect(transformStepOutput(nested)).toEqual({
      outer: {
        inner: "<data (2 bytes)>",
      },
    });
  });
});

describe("toBatchNodeStatus", () => {
  it("maps uppercase COMPLETED to success", () => {
    expect(toBatchNodeStatus("COMPLETED", null, null)).toBe("success");
  });

  it("maps uppercase FAILED to fail", () => {
    expect(toBatchNodeStatus("FAILED", null, null)).toBe("fail");
  });

  it("treats a completedAt as success when status is unrecognized", () => {
    expect(toBatchNodeStatus("UNKNOWN", "x", "y")).toBe("success");
  });

  it("returns running when startedAt set without completedAt", () => {
    expect(toBatchNodeStatus("UNKNOWN", "x", null)).toBe("running");
  });

  it("returns queued by default", () => {
    expect(toBatchNodeStatus("UNKNOWN", null, null)).toBe("queued");
  });
});

describe("adaptBatchNode", () => {
  it("uses displayKey when provided", () => {
    const node = adaptBatchNode(
      {
        id: "node:1",
        key: null,
        displayKey: "batch-0007",
        status: "COMPLETED",
        role: "PROCESSING",
        recordCount: 25,
        stepCount: 3,
        errorMessage: null,
        startedAt: "2026-05-20T00:00:00Z",
        completedAt: "2026-05-20T00:00:30Z",
        discoveredBy: null,
      },
      6,
    );
    expect(node.displayKey).toBe("batch-0007");
    expect(node.status).toBe("success");
    expect(node.label).toBe("25 records");
  });

  it("falls back to key, then short id, then ordinal label", () => {
    const noDisplayKey = adaptBatchNode(
      {
        id: "node:k",
        key: "k123",
        displayKey: "",
        status: "FAILED",
        role: "PROCESSING",
        recordCount: 1,
        stepCount: 0,
        errorMessage: "boom",
        startedAt: null,
        completedAt: null,
        discoveredBy: null,
      },
      0,
    );
    expect(noDisplayKey.displayKey).toBe("k123");
    expect(noDisplayKey.status).toBe("fail");
    expect(noDisplayKey.label).toBe("1 record");
  });

  it("derives DISCOVERY role", () => {
    const node = adaptBatchNode(
      {
        id: "discovery:1",
        key: null,
        displayKey: null,
        status: "COMPLETED",
        role: "DISCOVERY",
        recordCount: null,
        stepCount: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        discoveredBy: null,
      },
      0,
    );
    expect(node.role).toBe("discovery");
    expect(node.recordCount).toBe(1);
  });
});

describe("shortIdFromGlobalId", () => {
  it("trims the last 6 chars of an unencoded id", () => {
    expect(shortIdFromGlobalId("0123456789")).toBe("456789");
  });
});

describe("cancelBatchExecution", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the execution id on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            cancelBatchExecutionProcessing: {
              errors: [],
              instanceExecutionResult: {
                id: "exec-1",
                status: "CANCELING",
                cancelRequestedAt: "2026-05-20T00:00:00Z",
                canceledBy: { id: "user-1" },
              },
            },
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await cancelBatchExecution({
      accessToken: "tok",
      prismaticUrl: "https://example",
      executionId: "exec-1",
    });
    expect(result).toEqual({ id: "exec-1" });
  });

  it("surfaces a typed errors[].messages payload", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            cancelBatchExecutionProcessing: {
              errors: [
                {
                  field: "feature",
                  messages: ["LARGE_DATA_SYNC flag disabled"],
                },
              ],
              instanceExecutionResult: null,
            },
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(
      cancelBatchExecution({
        accessToken: "tok",
        prismaticUrl: "https://example",
        executionId: "exec-1",
      }),
    ).rejects.toThrow("LARGE_DATA_SYNC flag disabled");
  });
});

describe("fetchStepOutput", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a placeholder when the HEAD request reports no content-length", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {},
      }),
    ) as unknown as typeof fetch;

    const output = await fetchStepOutput({
      resultsMetadataUrl: "https://example/meta",
      resultsUrl: "https://example/results",
    });

    expect(output.data).toBe("<Unable to load preview>");
    expect(output.message).toContain("Invalid content-length header");
  });

  it("returns a size-limited placeholder for oversized outputs", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": "9999999" },
      }),
    ) as unknown as typeof fetch;

    const output = await fetchStepOutput({
      resultsMetadataUrl: "https://example/meta",
      resultsUrl: "https://example/results",
    });

    expect(output.data).toBe("<data (9999999 bytes)>");
    expect(output.message).toContain("exceeds");
  });

  it("decodes msgpack and unwraps a top-level data field", async () => {
    const body = encode({ data: { users: [1, 2, 3] } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "content-length": String(body.byteLength) },
        }),
      )
      .mockResolvedValueOnce(
        new Response(body, {
          status: 200,
          headers: { "content-length": String(body.byteLength) },
        }),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const output = await fetchStepOutput({
      resultsMetadataUrl: "https://example/meta",
      resultsUrl: "https://example/results",
    });

    expect(output.data).toEqual({ users: [1, 2, 3] });
    expect(output.message).toBeNull();
  });
});
