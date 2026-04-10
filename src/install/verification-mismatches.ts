import { isDeepStrictEqual } from "node:util";
import type { EffectiveConfigVerificationMismatch } from "./contracts/effective-config.js";
import { formatConfigPath } from "./jsonc.js";
import { createRedactedDiagnosticValue } from "./redact.js";
import { getNestedConfigValue } from "./config-value.js";

export interface EffectiveConfigValueCheck {
  expected: unknown;
  path: readonly string[];
  reason: string;
}

export function compareConfigValueAtPath(
  root: Record<string, unknown>,
  check: EffectiveConfigValueCheck,
): EffectiveConfigVerificationMismatch | undefined {
  const actualValue = getNestedConfigValue(root, check.path);

  if (isDeepStrictEqual(actualValue, check.expected)) {
    return undefined;
  }

  return createConfigValueMismatchAtPath(root, check);
}

export function createConfigValueMismatchAtPath(
  root: Record<string, unknown>,
  check: EffectiveConfigValueCheck,
): EffectiveConfigVerificationMismatch {
  const actualValue = getNestedConfigValue(root, check.path);

  return {
    actualValue: createRedactedDiagnosticValue(actualValue, check.path),
    expectedValue: createRedactedDiagnosticValue(check.expected, check.path),
    key: formatConfigPath(check.path),
    layer: "resolved_config",
    reason: check.reason,
  };
}

export function collectValueCheckMismatches(
  root: Record<string, unknown>,
  checks: readonly EffectiveConfigValueCheck[],
): EffectiveConfigVerificationMismatch[] {
  return checks.flatMap((check) => {
    const mismatch = compareConfigValueAtPath(root, check);
    return mismatch === undefined ? [] : [mismatch];
  });
}
