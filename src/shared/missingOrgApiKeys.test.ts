import type { Flow } from "@/types/flows";
import {
  getFlowNamesMissingOrgApiKeys,
  getMissingOrgApiKeysMessage,
} from "./missingOrgApiKeys";

const buildFlow = (overrides: Partial<Flow>): Flow => ({
  id: "flow-id",
  name: "Flow",
  stableKey: "flow",
  isSynchronous: false,
  usesFifoQueue: false,
  endpointSecurityType: "UNSECURED",
  testUrl: "https://example.com",
  hasOrganizationApiKeys: false,
  ...overrides,
});

describe("getFlowNamesMissingOrgApiKeys", () => {
  it("names an organization-secured flow with no keys", () => {
    expect(
      getFlowNamesMissingOrgApiKeys([
        buildFlow({ name: "Secured", endpointSecurityType: "ORGANIZATION" }),
      ]),
    ).toEqual(["Secured"]);
  });

  it("ignores an organization-secured flow that has a key", () => {
    expect(
      getFlowNamesMissingOrgApiKeys([
        buildFlow({
          name: "Secured",
          endpointSecurityType: "ORGANIZATION",
          hasOrganizationApiKeys: true,
        }),
      ]),
    ).toEqual([]);
  });

  it("ignores flows with other endpoint security types", () => {
    expect(
      getFlowNamesMissingOrgApiKeys([
        buildFlow({ name: "Open", endpointSecurityType: "UNSECURED" }),
        buildFlow({
          name: "Customer",
          endpointSecurityType: "CUSTOMER_REQUIRED",
        }),
      ]),
    ).toEqual([]);
  });

  it("ignores flows persisted before key presence was tracked", () => {
    expect(
      getFlowNamesMissingOrgApiKeys([
        buildFlow({
          name: "Stale",
          endpointSecurityType: "ORGANIZATION",
          hasOrganizationApiKeys: undefined,
        }),
      ]),
    ).toEqual([]);
  });

  it("matches the endpoint security type regardless of case", () => {
    expect(
      getFlowNamesMissingOrgApiKeys([
        buildFlow({ name: "Secured", endpointSecurityType: "organization" }),
      ]),
    ).toEqual(["Secured"]);
  });
});

describe("getMissingOrgApiKeysMessage", () => {
  it("is null when no flows are missing keys", () => {
    expect(getMissingOrgApiKeysMessage([])).toBeNull();
  });

  it("names the single flow missing a key", () => {
    expect(getMissingOrgApiKeysMessage(["Alpha"])).toBe(
      'Flow "Alpha" requires an Organization API key because its endpoint security type is "organization"',
    );
  });

  it("counts and lists every flow missing a key", () => {
    expect(getMissingOrgApiKeysMessage(["Alpha", "Bravo"])).toBe(
      '2 flows require an Organization API key because their endpoint security type is "organization": Alpha, Bravo',
    );
  });
});
