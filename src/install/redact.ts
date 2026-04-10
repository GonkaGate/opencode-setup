import { isJsonObjectRecord } from "../json.js";
import type {
  EffectiveConfigDiagnosticData,
  EffectiveConfigDiagnosticValue,
} from "./contracts/effective-config.js";

const REDACTED_VALUE = "[REDACTED]";
const SECRET_KEY_PATTERN = /(api[-_]?key|authorization|token|secret)/iu;
const SECRET_TEXT_PATTERNS = [
  /\bgp-[A-Za-z0-9_-]+\b/gu,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gu,
];

export function isSecretBearingKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function redactSecretBearingText(text: string): string {
  let redacted = text;

  for (const pattern of SECRET_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED_VALUE);
  }

  return redacted;
}

export function redactSecretBearingValue(
  value: unknown,
  path: readonly string[] = [],
): EffectiveConfigDiagnosticData {
  if (path.some((segment) => isSecretBearingKey(segment))) {
    return REDACTED_VALUE;
  }

  if (typeof value === "string") {
    return redactSecretBearingText(value);
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecretBearingValue(entry, path));
  }

  if (!isJsonObjectRecord(value)) {
    return String(value);
  }

  const redactedValue: Record<string, EffectiveConfigDiagnosticData> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    redactedValue[key] = redactSecretBearingValue(nestedValue, [...path, key]);
  }

  return redactedValue;
}

export function createRedactedDiagnosticValue(
  value: unknown,
  path: readonly string[] = [],
): EffectiveConfigDiagnosticValue {
  if (value === undefined) {
    return {
      kind: "undefined",
    };
  }

  return {
    kind: "value",
    value: redactSecretBearingValue(value, path),
  };
}

export function formatRedactedDiagnosticValue(
  value: EffectiveConfigDiagnosticValue,
): string {
  if (value.kind === "undefined") {
    return "undefined";
  }

  return typeof value.value === "string"
    ? value.value
    : JSON.stringify(value.value);
}
