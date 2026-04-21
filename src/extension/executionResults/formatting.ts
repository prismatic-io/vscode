import type { ExecutionLog } from "./types";

export const formatExecutionLogs = (logs: ExecutionLog[]): string => {
  if (logs.length === 0) {
    return "<no logs yet>";
  }

  return logs.map(formatExecutionLog).join("\n");
};

export const formatExecutionLog = (log: ExecutionLog): string => {
  const parts: string[] = [formatTimestamp(log.timestamp)];
  parts.push(`[${log.severity}]`);
  if (log.stepName) {
    parts.push(`[${log.stepName}]`);
  }
  parts.push(log.message);
  return parts.join(" ");
};

// Logs come back as full ISO timestamps with microsecond precision and tz —
// e.g. `2026-04-21T23:14:32.493000+00:00`. The platform only tracks seconds
// meaningfully, and ordering is done server-side, so we render `HH:mm:ss`.
export const formatTimestamp = (raw: string): string => {
  const match = /T(\d{2}:\d{2}:\d{2})/.exec(raw);
  return match ? match[1] : raw;
};

export const formatStepOutput = (
  data: unknown,
  message: string | null,
): string => {
  if (message) {
    return `// ${message}\n${stringify(data)}`;
  }
  return stringify(data);
};

const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
