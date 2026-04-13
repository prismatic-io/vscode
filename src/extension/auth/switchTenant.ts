import type { Tenant } from "./types";

export interface TenantPickItem {
  label: string;
  description: string;
  detail?: string;
  tenantId: string;
}

export type SwitchTenantOutcome =
  | { kind: "single"; message: string }
  | { kind: "pick"; items: TenantPickItem[] };

export const resolveSwitchTenantOutcome = (
  tenants: Tenant[],
  currentTenantId?: string,
): SwitchTenantOutcome => {
  if (tenants.length <= 1) {
    return {
      kind: "single",
      message: "Only one tenant available to your account.",
    };
  }

  const items: TenantPickItem[] = tenants.map((t) => ({
    label: t.orgName,
    description: `${t.url} (${t.awsRegion})`,
    detail: t.tenantId === currentTenantId ? "Current" : undefined,
    tenantId: t.tenantId,
  }));

  return { kind: "pick", items };
};
