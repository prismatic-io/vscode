import type { Flow } from "@/types/flows";

/**
 * The API refuses to consider the dev instance deployable while any
 * organization-secured flow lacks a key, so its config state never reaches
 * FULLY_CONFIGURED and no amount of config wizard input will unblock a test
 * run.
 */
export const getFlowNamesMissingOrgApiKeys = (flows: Flow[]): string[] =>
  flows
    .filter(
      (flow) =>
        flow.endpointSecurityType?.toLowerCase() === "organization" &&
        // Absent on flows persisted before this field existed; only a known
        // false blocks, so stale state falls through to the config wizard.
        flow.hasOrganizationApiKeys === false,
    )
    .map((flow) => flow.name);

export const getMissingOrgApiKeysMessage = (
  flowNames: string[],
): string | null => {
  const [firstFlowName] = flowNames;

  if (!firstFlowName) {
    return null;
  }

  if (flowNames.length === 1) {
    return `Flow "${firstFlowName}" requires an Organization API key because its endpoint security type is "organization"`;
  }

  return `${flowNames.length} flows require an Organization API key because their endpoint security type is "organization": ${flowNames.join(", ")}`;
};
