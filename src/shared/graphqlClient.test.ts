import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { graphqlRequest } from "./graphqlClient";

const mockOptions = {
  prismaticUrl: "https://app.prismatic.io",
  accessToken: "test-token",
};

const TestSchema = z.object({
  user: z.object({ name: z.string(), email: z.string() }),
});

describe("graphqlRequest", () => {
  it("returns validated data on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { user: { name: "Jane", email: "jane@example.com" } },
        }),
        { status: 200 },
      ),
    );

    const result = await graphqlRequest(
      "{ user { name email } }",
      TestSchema,
      mockOptions,
    );

    expect(result).toEqual({
      user: { name: "Jane", email: "jane@example.com" },
    });
  });

  it("sends correct headers and body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { user: { name: "Jane", email: "j@e.com" } },
        }),
        { status: 200 },
      ),
    );

    await graphqlRequest(
      "query GetUser($id: ID!) { user(id: $id) { name email } }",
      TestSchema,
      mockOptions,
      { id: "123" },
    );

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://app.prismatic.io/api");
    expect(init?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      }),
    );
    const body = JSON.parse(init?.body as string);
    expect(body.query).toContain("GetUser");
    expect(body.variables).toEqual({ id: "123" });
  });

  it("omits variables from body when not provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { user: { name: "Jane", email: "j@e.com" } },
        }),
        { status: 200 },
      ),
    );

    await graphqlRequest("{ user { name } }", TestSchema, mockOptions);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.variables).toBeUndefined();
  });

  it("throws on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    await expect(
      graphqlRequest("{ user { name } }", TestSchema, mockOptions),
    ).rejects.toThrow("GraphQL request failed: 401");
  });

  it("throws on GraphQL errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ message: "Not authorized" }] }),
        { status: 200 },
      ),
    );

    await expect(
      graphqlRequest("{ user { name } }", TestSchema, mockOptions),
    ).rejects.toThrow("GraphQL error: Not authorized");
  });

  it("throws when data is missing from response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await expect(
      graphqlRequest("{ user { name } }", TestSchema, mockOptions),
    ).rejects.toThrow("No data returned from GraphQL API");
  });

  it("throws on zod validation failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { name: 123 } } }), {
        status: 200,
      }),
    );

    await expect(
      graphqlRequest("{ user { name } }", TestSchema, mockOptions),
    ).rejects.toThrow();
  });

  it("infers return type from schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { count: 42 } }), { status: 200 }),
    );

    const CountSchema = z.object({ count: z.number() });
    const result = await graphqlRequest("{ count }", CountSchema, mockOptions);

    // Type-level check: result.count should be number
    expect(result.count).toBe(42);
  });
});
