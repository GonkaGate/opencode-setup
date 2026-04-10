import {
  formatOpencodeModelRef,
  type CuratedModelKey,
} from "../constants/models.js";
import { GONKAGATE_PROVIDER_ID } from "../constants/gateway.js";
import type { EffectiveConfigVerificationTarget } from "./contracts/effective-config.js";
import type { EffectiveConfigValueCheck } from "./verification-mismatches.js";
import {
  buildManagedProviderConfig,
  GONKAGATE_SECRET_FILE_REFERENCE,
  resolveValidatedModel,
} from "./managed-provider-config.js";

interface VerificationSummaryCheck {
  expected: Record<string, unknown>;
  path: readonly string[];
  reason: string;
}

interface RequiredObjectCheck {
  expected: Record<string, unknown>;
  path: readonly string[];
  reason: string;
}

export interface RequiredNestedObjectVerification {
  object: RequiredObjectCheck;
  valueChecks: readonly EffectiveConfigValueCheck[];
}

interface PathReasonRule {
  path: string;
  reason: string;
}

export interface ProviderVerificationPolicy {
  object: RequiredObjectCheck;
  requiredNestedObjects?: readonly RequiredNestedObjectVerification[];
  summaryOnMismatch: VerificationSummaryCheck;
  valueChecks: readonly EffectiveConfigValueCheck[];
}

export interface ResolvedConfigVerificationPolicy {
  provider: ProviderVerificationPolicy;
  rootValueChecks: readonly EffectiveConfigValueCheck[];
  target: EffectiveConfigVerificationTarget;
}

export interface SecretBindingVerificationPolicy {
  canonicalBinding: string;
  key: string;
  path: readonly string[];
}

const PROVIDER_MISMATCH_REASON =
  "Resolved GonkaGate provider settings do not match the curated validated contract.";

const PROVIDER_REASON_RULES = Object.freeze([
  {
    path: `provider.${GONKAGATE_PROVIDER_ID}.npm`,
    reason:
      "Resolved GonkaGate provider adapter package does not match the validated contract.",
  },
  {
    path: `provider.${GONKAGATE_PROVIDER_ID}.api`,
    reason:
      "Resolved GonkaGate transport does not match the validated contract.",
  },
  {
    path: `provider.${GONKAGATE_PROVIDER_ID}.options.baseURL`,
    reason:
      "Resolved GonkaGate baseURL does not match the canonical v1 endpoint.",
  },
] as const satisfies readonly PathReasonRule[]);

function createEffectiveConfigVerificationTarget(
  modelKey: CuratedModelKey,
): EffectiveConfigVerificationTarget {
  const model = resolveValidatedModel(modelKey);

  return {
    modelKey,
    modelRef: formatOpencodeModelRef(modelKey),
    providerId: GONKAGATE_PROVIDER_ID,
    runtimeCompatibility: model.runtimeCompatibility,
    transport: model.transport,
  };
}

export function createResolvedConfigVerificationPolicy(
  modelKey: CuratedModelKey,
): ResolvedConfigVerificationPolicy {
  const target = createEffectiveConfigVerificationTarget(modelKey);
  const selectedModel = resolveValidatedModel(modelKey);
  const expectedProviderConfig = buildManagedProviderConfig(selectedModel);
  const providerPath = ["provider", target.providerId] as const;
  const modelEntryPath = [...providerPath, "models", modelKey] as const;
  const expectedModelEntry = expectedProviderConfig.models[modelKey];

  return {
    provider: {
      object: {
        expected: expectedProviderConfig,
        path: providerPath,
        reason: "Resolved config is missing the GonkaGate provider block.",
      },
      requiredNestedObjects:
        expectedModelEntry === undefined
          ? undefined
          : [
              {
                object: {
                  expected: expectedModelEntry,
                  path: modelEntryPath,
                  reason:
                    "Resolved config is missing the curated GonkaGate model entry.",
                },
                valueChecks: createObjectValueChecks(
                  modelEntryPath,
                  expectedModelEntry,
                  modelKey,
                ),
              },
            ],
      summaryOnMismatch: {
        expected: expectedProviderConfig,
        path: providerPath,
        reason: PROVIDER_MISMATCH_REASON,
      },
      valueChecks: createObjectValueChecks(
        providerPath,
        expectedProviderConfig,
        modelKey,
        {
          skipExactPaths: [[...providerPath, "options", "apiKey"]],
          skipSubtreePaths:
            expectedModelEntry === undefined ? undefined : [modelEntryPath],
        },
      ),
    },
    rootValueChecks: [
      {
        expected: target.modelRef,
        path: ["model"],
        reason: "Resolved model does not match the selected GonkaGate model.",
      },
      {
        expected: target.modelRef,
        path: ["small_model"],
        reason:
          "Resolved small_model does not match the selected GonkaGate model.",
      },
    ],
    target,
  };
}

export function createSecretBindingVerificationPolicy(
  providerId: string,
): SecretBindingVerificationPolicy {
  const path = ["provider", providerId, "options", "apiKey"] as const;

  return {
    canonicalBinding: GONKAGATE_SECRET_FILE_REFERENCE,
    key: path.join("."),
    path,
  };
}

interface FlattenValueCheckOptions {
  skipExactPaths?: readonly (readonly string[])[];
  skipSubtreePaths?: readonly (readonly string[])[];
}

function createObjectValueChecks(
  path: readonly string[],
  value: unknown,
  modelKey: CuratedModelKey,
  options: FlattenValueCheckOptions = {},
): EffectiveConfigValueCheck[] {
  if (shouldSkipExactPath(path, options.skipExactPaths)) {
    return [];
  }

  if (shouldSkipSubtreePath(path, options.skipSubtreePaths)) {
    return [];
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const checks: EffectiveConfigValueCheck[] = [];

    for (const [key, nestedValue] of Object.entries(value)) {
      checks.push(
        ...createObjectValueChecks([...path, key], nestedValue, modelKey, {
          skipExactPaths: options.skipExactPaths,
          skipSubtreePaths: options.skipSubtreePaths,
        }),
      );
    }

    return checks;
  }

  return [
    {
      expected: value,
      path,
      reason: resolveProviderMismatchReason(path, modelKey),
    },
  ];
}

function shouldSkipExactPath(
  path: readonly string[],
  skipPaths: readonly (readonly string[])[] | undefined,
): boolean {
  return skipPaths?.some((skipPath) => arePathsEqual(path, skipPath)) === true;
}

function shouldSkipSubtreePath(
  path: readonly string[],
  skipSubtreePaths: readonly (readonly string[])[] | undefined,
): boolean {
  return (
    skipSubtreePaths?.some((skipPath) =>
      isPathWithinSubtree(path, skipPath),
    ) === true
  );
}

function arePathsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((segment, index) => segment === right[index]);
}

function isPathWithinSubtree(
  path: readonly string[],
  subtreeRoot: readonly string[],
): boolean {
  if (path.length < subtreeRoot.length) {
    return false;
  }

  return subtreeRoot.every((segment, index) => segment === path[index]);
}

function resolveProviderMismatchReason(
  path: readonly string[],
  modelKey: CuratedModelKey,
): string {
  const formattedPath = path.join(".");

  if (
    formattedPath.startsWith(
      `provider.${GONKAGATE_PROVIDER_ID}.models.${modelKey}.`,
    )
  ) {
    return "Resolved GonkaGate model compatibility settings do not match the curated validated contract.";
  }

  for (const rule of PROVIDER_REASON_RULES) {
    if (formattedPath === rule.path) {
      return rule.reason;
    }
  }

  return PROVIDER_MISMATCH_REASON;
}
