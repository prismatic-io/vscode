import path from "node:path";
import {
  FLOW_DIR,
  FLOW_PAYLOADS_DIR,
  SPECTRAL_DIR,
} from "@/extension/constants";
import { getJsonFiles, pathsToUris } from "@/extension/lib/getFiles";
import { getWorkspacePath } from "@/extension/lib/getWorkspacePath";

interface FlowPayloadFile {
  fileName: string;
}

/**
 * Get all flow payloads
 * @returns {FlowPayloadFile[]} The flow payloads
 */
export const getProjectFlowPayloads = async (
  flowId?: string,
): Promise<FlowPayloadFile[]> => {
  if (!flowId) {
    return [];
  }

  const payloadsDir = path.join(
    getWorkspacePath(),
    SPECTRAL_DIR,
    FLOW_DIR,
    flowId,
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
