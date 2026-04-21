import { describe, expect, it } from "vitest";
import { formatExecutionLogs, formatStepOutput } from "./formatting";
import { LogSeverityLevel } from "./types";

describe("formatExecutionLogs", () => {
  it("returns a placeholder when logs are empty", () => {
    expect(formatExecutionLogs([])).toBe("<no logs yet>");
  });

  it("formats timestamp as HH:mm:ss with severity, step name, and message", () => {
    const out = formatExecutionLogs([
      {
        id: "1",
        timestamp: "2026-04-21T23:14:32.493000+00:00",
        severity: LogSeverityLevel.INFO,
        stepName: "fetchUsers",
        message: "starting",
        requiredConfigVariableKey: null,
        fromPreprocessFlow: null,
      },
    ]);

    expect(out).toBe("23:14:32 [INFO] [fetchUsers] starting");
  });

  it("omits the step tag when stepName is null", () => {
    const out = formatExecutionLogs([
      {
        id: "1",
        timestamp: "2026-04-21T23:14:32.493000+00:00",
        severity: LogSeverityLevel.ERROR,
        stepName: null,
        message: "boom",
        requiredConfigVariableKey: null,
        fromPreprocessFlow: null,
      },
    ]);

    expect(out).toBe("23:14:32 [ERROR] boom");
  });

  it("handles timestamps with no sub-second component", () => {
    const out = formatExecutionLogs([
      {
        id: "1",
        timestamp: "2026-04-21T23:14:32Z",
        severity: LogSeverityLevel.INFO,
        stepName: null,
        message: "msg",
        requiredConfigVariableKey: null,
        fromPreprocessFlow: null,
      },
    ]);

    expect(out).toBe("23:14:32 [INFO] msg");
  });
});

describe("formatStepOutput", () => {
  it("pretty-prints JSON data when no message", () => {
    expect(formatStepOutput({ foo: 1 }, null)).toBe('{\n  "foo": 1\n}');
  });

  it("prepends a comment line when a message is present", () => {
    expect(formatStepOutput({ foo: 1 }, "truncated")).toBe(
      '// truncated\n{\n  "foo": 1\n}',
    );
  });

  it("renders string data as-is", () => {
    expect(formatStepOutput("hello", null)).toBe("hello");
  });
});
