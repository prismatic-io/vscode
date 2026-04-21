import { encode } from "@msgpack/msgpack";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStepOutput, transformStepOutput } from "./api";

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
