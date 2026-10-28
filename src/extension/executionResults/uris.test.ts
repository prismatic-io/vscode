import { describe, expect, it } from "vitest";
import { buildLogsUri, buildStepUri, parseLogsUri, parseStepUri } from "./uris";

describe("logs URIs", () => {
  it("roundtrips execution ids", () => {
    const uri = buildLogsUri("abc-123");
    expect(parseLogsUri(uri)).toEqual({
      executionId: "abc-123",
      batchId: null,
    });
  });

  it("roundtrips execution + batch ids", () => {
    const uri = buildLogsUri("exec/1", "batch/2");
    expect(parseLogsUri(uri)).toEqual({
      executionId: "exec/1",
      batchId: "batch/2",
    });
  });

  it("roundtrips execution ids containing special characters", () => {
    const uri = buildLogsUri("weird/id with spaces");
    expect(parseLogsUri(uri)).toEqual({
      executionId: "weird/id with spaces",
      batchId: null,
    });
  });

  it("returns null for foreign schemes", () => {
    expect(
      parseLogsUri({ scheme: "file", path: "/foo.log" } as never),
    ).toBeNull();
  });
});

describe("step URIs", () => {
  it("roundtrips execution + step ids", () => {
    const uri = buildStepUri("exec-1", "step-1", "fetchUsers");
    expect(parseStepUri(uri)).toEqual({
      executionId: "exec-1",
      stepId: "step-1",
    });
  });

  it("falls back to a generic step filename when stepName is null", () => {
    const uri = buildStepUri("exec-1", "step-1", null);
    expect(uri.toString()).toContain("step.json");
  });

  it("sanitizes step names that contain slashes", () => {
    const uri = buildStepUri("exec-1", "step-1", "some/weird name");
    expect(uri.toString()).toContain("some_weird_name.json");
  });
});
