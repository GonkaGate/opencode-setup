import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationBlockingLayer,
} from "./contracts/effective-config.js";
import {
  getNestedConfigValue,
  getStringArrayConfigValue,
  hasNestedConfigValue,
} from "./config-value.js";
import type { SecretBindingVerificationPolicy } from "./effective-config-policy.js";

interface ManagedOverlapCheck {
  key: string;
  path: readonly string[];
  reason: string;
}

const MANAGED_OVERLAP_CHECKS = Object.freeze([
  {
    key: "provider.gonkagate",
    path: ["provider", "gonkagate"],
    reason:
      "Higher-precedence config overlaps GonkaGate-managed provider settings.",
  },
  {
    key: "model",
    path: ["model"],
    reason:
      "Higher-precedence config overlaps the GonkaGate-managed model selection.",
  },
  {
    key: "small_model",
    path: ["small_model"],
    reason:
      "Higher-precedence config overlaps the GonkaGate-managed small_model selection.",
  },
] as const satisfies readonly ManagedOverlapCheck[]);

const USER_SECRET_BINDING_REASON =
  "user_config must own provider.gonkagate.options.apiKey with the canonical {file:~/.gonkagate/opencode/api-key} binding.";
const HIGHER_PRECEDENCE_SECRET_BINDING_REASON =
  "Higher-precedence config must not override the installer-managed GonkaGate secret binding.";
const PROJECT_SECRET_BINDING_REASON =
  "project_config must not define provider.gonkagate.options.apiKey because project scope stays secret-free and commit-safe.";
const INLINE_SECRET_BINDING_REASON =
  "OPENCODE_CONFIG_CONTENT must not define provider.gonkagate.options.apiKey during v1 current-session verification.";

export function collectManagedOverlapBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
): EffectiveConfigVerificationBlocker[] {
  return MANAGED_OVERLAP_CHECKS.flatMap((check) =>
    hasNestedConfigValue(config, check.path)
      ? [
          {
            key: check.key,
            layer,
            reason: check.reason,
          },
        ]
      : [],
  );
}

export function collectProviderActivationBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  providerId: string,
): EffectiveConfigVerificationBlocker[] {
  const disabledProviders = getStringArrayConfigValue(config, [
    "disabled_providers",
  ]);

  if (disabledProviders?.includes(providerId) === true) {
    return [
      {
        key: "disabled_providers",
        layer,
        reason: `disabled_providers excludes ${providerId}.`,
      },
    ];
  }

  const enabledProviders = getStringArrayConfigValue(config, [
    "enabled_providers",
  ]);

  if (
    enabledProviders !== undefined &&
    enabledProviders.includes(providerId) === false
  ) {
    return [
      {
        key: "enabled_providers",
        layer,
        reason: `enabled_providers does not include ${providerId}.`,
      },
    ];
  }

  return [];
}

export function collectSecretBindingProvenanceBlockers(
  config: Record<string, unknown> | undefined,
  layer: EffectiveConfigVerificationBlockingLayer,
  policy: SecretBindingVerificationPolicy,
): EffectiveConfigVerificationBlocker[] {
  const secretBindingValue =
    config === undefined
      ? undefined
      : getNestedConfigValue(config, policy.path);

  switch (layer) {
    case "user_config":
      return secretBindingValue === policy.canonicalBinding
        ? []
        : [
            {
              key: policy.key,
              layer,
              reason: USER_SECRET_BINDING_REASON,
            },
          ];
    case "project_config":
      return secretBindingValue === undefined
        ? []
        : [
            {
              key: policy.key,
              layer,
              reason: PROJECT_SECRET_BINDING_REASON,
            },
          ];
    case "OPENCODE_CONFIG":
    case "system_managed_config":
      return secretBindingValue === undefined
        ? []
        : [
            {
              key: policy.key,
              layer,
              reason: HIGHER_PRECEDENCE_SECRET_BINDING_REASON,
            },
          ];
    case "OPENCODE_CONFIG_CONTENT":
      return secretBindingValue === undefined
        ? []
        : [
            {
              key: policy.key,
              layer,
              reason: INLINE_SECRET_BINDING_REASON,
            },
          ];
    case "inferred_higher_precedence":
      return [];
  }
}
