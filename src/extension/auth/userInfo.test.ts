import { describe, expect, it, vi } from "vitest";
import { fetchPrismaticUser, fetchUserTenants } from "./userInfo";

describe("fetchPrismaticUser", () => {
  it("fetches and maps org user info from the GraphQL API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            authenticatedUser: {
              name: "Jane Doe",
              email: "jane@example.com",
              tenantId: "tenant-1",
              org: { name: "Prismatic" },
              customer: null,
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchPrismaticUser(
      "https://app.prismatic.io",
      "test-token",
    );

    expect(result).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      organization: "Prismatic",
      endpointUrl: "https://app.prismatic.io",
      tenantId: "tenant-1",
    });
  });

  it("falls back to customer name when org is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            authenticatedUser: {
              name: "Jane Doe",
              email: "jane@example.com",
              customer: { name: "Acme Corp" },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchPrismaticUser(
      "https://app.prismatic.io",
      "test-token",
    );

    expect(result.organization).toBe("Acme Corp");
  });

  it("sends the correct authorization header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            authenticatedUser: {
              name: "Test",
              email: "test@test.com",
              customer: { name: "Org" },
            },
          },
        }),
        { status: 200 },
      ),
    );

    await fetchPrismaticUser("https://app.prismatic.io", "my-token");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://app.prismatic.io/api");
    expect(init?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer my-token",
      }),
    );
  });

  it("falls back to empty strings for missing optional fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            authenticatedUser: {},
          },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchPrismaticUser(
      "https://app.prismatic.io",
      "token",
    );

    expect(result).toEqual({
      name: "",
      email: "",
      organization: "",
      endpointUrl: "https://app.prismatic.io",
      tenantId: undefined,
    });
  });

  it("throws on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    await expect(
      fetchPrismaticUser("https://app.prismatic.io", "bad-token"),
    ).rejects.toThrow("GraphQL request failed: 401");
  });

  it("throws on GraphQL errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: "Not authorized" }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchPrismaticUser("https://app.prismatic.io", "token"),
    ).rejects.toThrow("GraphQL error: Not authorized");
  });

  it("throws when authenticatedUser is missing from response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    await expect(
      fetchPrismaticUser("https://app.prismatic.io", "token"),
    ).rejects.toThrow("No user data returned from API");
  });
});

describe("fetchUserTenants", () => {
  it("fetches and returns tenant list", async () => {
    const tenants = [
      {
        tenantId: "t-1",
        url: "app.prismatic.io",
        orgName: "Acme",
        awsRegion: "us-east-2",
      },
      {
        tenantId: "t-2",
        url: "app.eu.prismatic.io",
        orgName: "Acme EU",
        awsRegion: "eu-west-1",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { listUserTenants: { nodes: tenants } },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchUserTenants("https://app.prismatic.io", "token");
    expect(result).toEqual(tenants);
  });

  it("returns empty array when no tenants", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: { listUserTenants: { nodes: [] } } }),
        { status: 200 },
      ),
    );

    const result = await fetchUserTenants("https://app.prismatic.io", "token");
    expect(result).toEqual([]);
  });

  it("returns empty array when response shape is unexpected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    const result = await fetchUserTenants("https://app.prismatic.io", "token");
    expect(result).toEqual([]);
  });

  it("throws on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );

    await expect(
      fetchUserTenants("https://app.prismatic.io", "token"),
    ).rejects.toThrow("GraphQL request failed: 403");
  });

  it("throws on GraphQL errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Unauthorized" }] }), {
        status: 200,
      }),
    );

    await expect(
      fetchUserTenants("https://app.prismatic.io", "token"),
    ).rejects.toThrow("GraphQL error: Unauthorized");
  });
});
