import { describe, expect, it } from "vitest";
import { resolveSwitchTenantOutcome } from "./switchTenant";
import type { Tenant } from "./types";

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  tenantId: "tenant-1",
  url: "https://app.prismatic.io",
  orgName: "Prismatic",
  awsRegion: "us-east-1",
  ...overrides,
});

describe("resolveSwitchTenantOutcome", () => {
  it("returns a single-tenant outcome when there are no tenants", () => {
    const outcome = resolveSwitchTenantOutcome([], "tenant-1");

    expect(outcome).toEqual({
      kind: "single",
      message: "Only one tenant available to your account.",
    });
  });

  it("returns a single-tenant outcome when the user has exactly one tenant", () => {
    const outcome = resolveSwitchTenantOutcome(
      [makeTenant({ tenantId: "tenant-1" })],
      "tenant-1",
    );

    expect(outcome).toEqual({
      kind: "single",
      message: "Only one tenant available to your account.",
    });
  });

  it("returns pick items and marks the current tenant when included", () => {
    const tenants: Tenant[] = [
      makeTenant({
        tenantId: "tenant-1",
        orgName: "Acme",
        url: "https://acme.prismatic.io",
        awsRegion: "us-east-1",
      }),
      makeTenant({
        tenantId: "tenant-2",
        orgName: "Globex",
        url: "https://globex.prismatic.io",
        awsRegion: "us-west-2",
      }),
    ];

    const outcome = resolveSwitchTenantOutcome(tenants, "tenant-2");

    expect(outcome).toEqual({
      kind: "pick",
      items: [
        {
          label: "Acme",
          description: "https://acme.prismatic.io (us-east-1)",
          detail: undefined,
          tenantId: "tenant-1",
        },
        {
          label: "Globex",
          description: "https://globex.prismatic.io (us-west-2)",
          detail: "Current",
          tenantId: "tenant-2",
        },
      ],
    });
  });

  it("returns pick items with none marked current when the current tenant isn't in the list", () => {
    const tenants: Tenant[] = [
      makeTenant({ tenantId: "tenant-1" }),
      makeTenant({ tenantId: "tenant-2" }),
    ];

    const outcome = resolveSwitchTenantOutcome(tenants, "tenant-missing");

    expect(outcome.kind).toBe("pick");
    if (outcome.kind !== "pick") return;

    expect(outcome.items.every((item) => item.detail === undefined)).toBe(true);
  });

  it("returns pick items with none marked current when currentTenantId is undefined", () => {
    const tenants: Tenant[] = [
      makeTenant({ tenantId: "tenant-1" }),
      makeTenant({ tenantId: "tenant-2" }),
    ];

    const outcome = resolveSwitchTenantOutcome(tenants);

    expect(outcome.kind).toBe("pick");
    if (outcome.kind !== "pick") return;

    expect(outcome.items).toHaveLength(2);
    expect(outcome.items.every((item) => item.detail === undefined)).toBe(true);
  });
});
