import { fromPromise } from "xstate";
import { decode } from "@msgpack/msgpack";
import { isValid } from "date-fns";

const MAX_PREVIEW_SIZE = 1048576;

export interface GetStepOutputsOutput {
  stepOutputs: {
    data: unknown;
    message: string | null;
  };
}

interface GetStepOutputsInput {
  resultsMetadataUrl: string;
  resultsUrl: string;
  responseType?: "json" | "msgpack";
}

export const getStepOutputs = fromPromise<
  GetStepOutputsOutput,
  GetStepOutputsInput
>(async ({ input }) => {
  const metaDataResults = await fetch(input.resultsMetadataUrl, {
    method: "HEAD",
  });

  if (!metaDataResults.ok) {
    return {
      stepOutputs: {
        data: "<Unable to load preview>",
        message: `Step outputs head request failed. Received status: ${metaDataResults.status}`,
      },
    };
  }

  const contentLengthBase = metaDataResults.headers.get("content-length");
  const contentLength = Number(contentLengthBase);

  if (!contentLengthBase || !contentLength) {
    return {
      stepOutputs: {
        data: "<Unable to load preview>",
        message: `Step outputs head request received invalid content-length header: ${contentLengthBase}`,
      },
    };
  }

  if (contentLength > MAX_PREVIEW_SIZE) {
    return {
      stepOutputs: {
        data: `<data (${contentLength} bytes)>`,
        message: `Step outputs head request received content-length header greater than ${MAX_PREVIEW_SIZE}: ${contentLength}`,
      },
    };
  }

  const results = await fetch(input.resultsUrl, {
    method: "GET",
  });

  if (!results.ok) {
    return {
      stepOutputs: {
        data: "<Unable to load preview>",
        message: `Step outputs get request failed. Received status: ${results.status}`,
      },
    };
  }

  const resultsJson =
    input.responseType === "json"
      ? await results.json()
      : deserialize(new Uint8Array(await results.arrayBuffer()));

  const transformedResultsJson = transformResultJson(resultsJson);

  return {
    stepOutputs: {
      data:
        "data" in (transformedResultsJson as object)
          ? (transformedResultsJson as { data: unknown }).data
          : transformedResultsJson,
      message: null,
    },
  };
});

export interface DeserializeResult {
  data: unknown;
  contentType?: string;
}

const deserialize = (data: Uint8Array): DeserializeResult | unknown =>
  decode(data);

const isValidDate = (input: unknown): input is Date => isValid(input);

const getDataUri = (input: Uint8Array, contentType: string) => {
  const base64 = uint8ToBase64(input);

  return `data:${contentType};base64,${base64}`;
};

const transformResultJson = (result: unknown): unknown => {
  if (Array.isArray(result)) {
    return result.map(transformResultJson);
  }

  if (result instanceof Object && "data" in result) {
    const { data, contentType } = result as DeserializeResult;

    if (data instanceof Uint8Array) {
      return contentType?.startsWith("image")
        ? getDataUri(data, contentType)
        : `<data (${data.byteLength} bytes)>`;
    }
  }

  if (result instanceof Object) {
    if (isValidDate(result)) {
      return result.toISOString();
    }

    return Object.fromEntries(
      Object.entries(result).map(([k, v]) => [k, transformResultJson(v)])
    );
  }

  return result;
};

const uint8ToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};
