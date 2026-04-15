import path from "node:path";
import {
  FLOW_DIR,
  FLOW_PAYLOADS_DIR,
  SPECTRAL_DIR,
} from "@/extension/constants";
import { getJsonFiles, pathsToUris } from "@/extension/lib/getFiles";

interface FlowPayloadFile {
  fileName: string;
}

/**
 * Get all flow payloads
 * @param integrationPath - The path to the active integration (parent of .spectral)
 * @param stableKey - The flow stable key to get the payloads for
 * @returns {FlowPayloadFile[]} The flow payloads
 */
export const getProjectFlowPayloads = async (
  integrationPath: string,
  stableKey?: string,
): Promise<FlowPayloadFile[]> => {
  if (!stableKey) {
    return [];
  }

  const payloadsDir = path.join(
    integrationPath,
    SPECTRAL_DIR,
    FLOW_DIR,
    stableKey,
    FLOW_PAYLOADS_DIR,
  );

  try {
    const files = await getJsonFiles(pathsToUris([payloadsDir]));

    return files.map((file) => ({ fileName: file.fileName }));
  } catch (error) {
    console.error(error);

    return [];
  }
};
