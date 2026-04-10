import type { CuratedModelKey } from "../constants/models.js";
import { isJsonObjectRecord } from "../json.js";
import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationMismatch,
  EffectiveConfigVerificationSuccess,
} from "./contracts/effective-config.js";
import type { ManagedConfigScope } from "./contracts/managed-config.js";
import type { ResolvedInstallContext } from "./context.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError, isInstallErrorCode } from "./errors.js";
import { getNestedConfigValue } from "./config-value.js";
import {
  createResolvedConfigVerificationPolicy,
  createSecretBindingVerificationPolicy,
  type ProviderVerificationPolicy,
  type RequiredNestedObjectVerification,
  type ResolvedConfigVerificationPolicy,
} from "./effective-config-policy.js";
import { formatConfigPath, tryParseJsoncObject } from "./jsonc.js";
import { createRedactedDiagnosticValue } from "./redact.js";
import {
  inspectVerificationLayers,
  inspectSecretBindingVerificationLayers,
  selectHighestPrecedenceInspectableBlockers,
} from "./verify-layers.js";
import {
  collectManagedOverlapBlockers,
  collectProviderActivationBlockers,
  collectSecretBindingProvenanceBlockers,
} from "./verification-blockers.js";
import {
  collectValueCheckMismatches,
  createConfigValueMismatchAtPath,
} from "./verification-mismatches.js";

export interface EffectiveConfigVerificationRequest {
  context: Pick<ResolvedInstallContext, "opencode" | "workspace">;
  model: CuratedModelKey;
  scope: ManagedConfigScope;
}

const EFFECTIVE_CONFIG_VERIFICATION_COMMAND = Object.freeze([
  "debug",
  "config",
  "--pure",
] as const);
const OPENCODE_CONFIG_CONTENT_ENV_KEY = "OPENCODE_CONFIG_CONTENT";
const CURRENT_SESSION_BLOCKER_REASON =
  "OPENCODE_CONFIG_CONTENT changes the current session away from the intended GonkaGate setup.";

export async function verifyEffectiveConfig(
  request: EffectiveConfigVerificationRequest,
  dependencies: InstallDependencies,
): Promise<EffectiveConfigVerificationSuccess> {
  const verificationPolicy = createResolvedConfigVerificationPolicy(
    request.model,
  );
  const { target } = verificationPolicy;
  const durableSecretBindingBlockers =
    await inspectDurableSecretBindingVerificationBlockers(
      request,
      dependencies,
      target.providerId,
    );
  const resolvedConfig = await readResolvedConfigForVerification(
    request.context,
    dependencies,
    createDurableVerificationEnv(dependencies.runtime.env),
  );
  const resolvedProviderActivationBlockers =
    collectDurableResolvedProviderActivationBlockers(
      resolvedConfig,
      target.providerId,
    );
  const mismatches = collectResolvedConfigMismatches(
    resolvedConfig,
    verificationPolicy,
  );
  const blockers = await collectDurableVerificationBlockers(
    request,
    dependencies,
    target.providerId,
    durableSecretBindingBlockers,
    resolvedProviderActivationBlockers,
    mismatches,
  );

  if (blockers.length > 0) {
    throw createInstallError("effective_config_blocked", {
      blockers,
      target,
    });
  }

  if (mismatches.length > 0) {
    throw createInstallError("effective_config_mismatch", {
      mismatches,
      target,
    });
  }

  return {
    blockers: [],
    ok: true,
    resolvedMatch: true,
    target,
  };
}

export async function verifyCurrentSessionEffectiveConfig(
  request: EffectiveConfigVerificationRequest,
  dependencies: InstallDependencies,
): Promise<EffectiveConfigVerificationSuccess> {
  const inlineLayer = readInlineVerificationLayer(dependencies.runtime.env);

  if (inlineLayer === undefined) {
    return createEffectiveConfigVerificationSuccess(request.model);
  }

  const verificationPolicy = createResolvedConfigVerificationPolicy(
    request.model,
  );
  const { target } = verificationPolicy;
  const inlineSecretBindingBlockers = collectSecretBindingProvenanceBlockers(
    inlineLayer,
    "OPENCODE_CONFIG_CONTENT",
    createSecretBindingVerificationPolicy(target.providerId),
  );

  if (inlineSecretBindingBlockers.length > 0) {
    throw createInstallError("effective_config_blocked", {
      blockers: inlineSecretBindingBlockers,
      target,
    });
  }

  const resolvedConfig = await readResolvedConfigForVerification(
    request.context,
    dependencies,
    dependencies.runtime.env,
  );
  const mismatches = collectResolvedConfigMismatches(
    resolvedConfig,
    verificationPolicy,
  );

  if (mismatches.length === 0) {
    return {
      blockers: [],
      ok: true,
      resolvedMatch: true,
      target,
    };
  }

  throw createInstallError("effective_config_blocked", {
    blockers: collectCurrentSessionBlockers(
      inlineLayer,
      target.providerId,
      mismatches,
    ),
    target,
  });
}

async function readResolvedConfigForVerification(
  context: EffectiveConfigVerificationRequest["context"],
  dependencies: InstallDependencies,
  env: NodeJS.ProcessEnv,
) {
  return parseResolvedConfig(
    (await runEffectiveConfigCommand(context, dependencies, env)).stdout,
  );
}

async function runEffectiveConfigCommand(
  context: EffectiveConfigVerificationRequest["context"],
  dependencies: InstallDependencies,
  env: NodeJS.ProcessEnv,
) {
  try {
    const result = await dependencies.commands.run(
      context.opencode.command,
      EFFECTIVE_CONFIG_VERIFICATION_COMMAND,
      {
        cwd: context.workspace.resolvedCwd,
        env,
      },
    );

    if (result.exitCode !== 0) {
      throw createInstallError("effective_config_command_failed", {
        command: EFFECTIVE_CONFIG_VERIFICATION_COMMAND,
        exitCode: result.exitCode,
        signal: result.signal,
      });
    }

    return result;
  } catch (error) {
    if (isInstallErrorCode(error, "effective_config_command_failed")) {
      throw error;
    }

    throw createInstallError("effective_config_command_failed", {
      cause: error,
      command: EFFECTIVE_CONFIG_VERIFICATION_COMMAND,
    });
  }
}

function parseResolvedConfig(stdout: string): Record<string, unknown> {
  const result = tryParseJsoncObject(stdout);

  if (!result.ok) {
    throw createInstallError("effective_config_parse_failed", {
      reason: result.error.reason,
    });
  }

  return result.value;
}

function createDurableVerificationEnv(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  if (env[OPENCODE_CONFIG_CONTENT_ENV_KEY] === undefined) {
    return env;
  }

  return Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => key !== OPENCODE_CONFIG_CONTENT_ENV_KEY,
    ),
  );
}

function createEffectiveConfigVerificationSuccess(
  model: CuratedModelKey,
): EffectiveConfigVerificationSuccess {
  return {
    blockers: [],
    ok: true,
    resolvedMatch: true,
    target: createResolvedConfigVerificationPolicy(model).target,
  };
}

function readInlineVerificationLayer(
  env: NodeJS.ProcessEnv,
): Record<string, unknown> | undefined {
  const inlineLayerContents = env[OPENCODE_CONFIG_CONTENT_ENV_KEY];

  if (inlineLayerContents === undefined) {
    return undefined;
  }

  const result = tryParseJsoncObject(inlineLayerContents);

  if (!result.ok) {
    throw createInstallError("effective_config_layer_parse_failed", {
      kind: "inline",
      layer: "OPENCODE_CONFIG_CONTENT",
      reason: result.error.reason,
    });
  }

  return result.value;
}

function collectCurrentSessionBlockers(
  inlineLayer: Record<string, unknown>,
  providerId: string,
  mismatches: readonly EffectiveConfigVerificationMismatch[],
): readonly EffectiveConfigVerificationBlocker[] {
  const providerActivationBlockers = collectProviderActivationBlockers(
    inlineLayer,
    "OPENCODE_CONFIG_CONTENT",
    providerId,
  );

  if (providerActivationBlockers.length > 0) {
    return providerActivationBlockers;
  }

  const managedOverlapBlockers = collectManagedOverlapBlockers(
    inlineLayer,
    "OPENCODE_CONFIG_CONTENT",
  ).filter((blocker) =>
    mismatches.some((mismatch) =>
      doesManagedOverlapBlockerExplainMismatch(blocker.key, mismatch.key),
    ),
  );

  if (managedOverlapBlockers.length > 0) {
    return managedOverlapBlockers;
  }

  const fallbackMismatch = mismatches[0];

  return [
    {
      key: fallbackMismatch?.key ?? OPENCODE_CONFIG_CONTENT_ENV_KEY,
      layer: "OPENCODE_CONFIG_CONTENT",
      reason: CURRENT_SESSION_BLOCKER_REASON,
    },
  ];
}

async function collectDurableVerificationBlockers(
  request: EffectiveConfigVerificationRequest,
  dependencies: InstallDependencies,
  providerId: string,
  durableSecretBindingBlockers: readonly EffectiveConfigVerificationBlocker[],
  resolvedProviderActivationBlockers: readonly EffectiveConfigVerificationBlocker[],
  mismatches: readonly EffectiveConfigVerificationMismatch[],
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  const blockers: EffectiveConfigVerificationBlocker[] = [
    ...durableSecretBindingBlockers,
  ];

  if (
    resolvedProviderActivationBlockers.length === 0 &&
    mismatches.length === 0
  ) {
    return blockers;
  }

  const inspectableLayerBlockers = await inspectVerificationLayers(
    {
      managedPaths: request.context.workspace.managedPaths,
      providerId,
      scope: request.scope,
    },
    dependencies,
  );

  if (resolvedProviderActivationBlockers.length > 0) {
    const attributableProviderActivationBlockers =
      selectHighestPrecedenceInspectableBlockers(
        inspectableLayerBlockers.filter((blocker) =>
          resolvedProviderActivationBlockers.some(
            (resolvedBlocker) => resolvedBlocker.key === blocker.key,
          ),
        ),
      );

    blockers.push(
      ...(attributableProviderActivationBlockers.length > 0
        ? attributableProviderActivationBlockers
        : resolvedProviderActivationBlockers),
    );

    return blockers;
  }

  blockers.push(
    ...selectHighestPrecedenceInspectableBlockers(
      inspectableLayerBlockers.filter((blocker) =>
        mismatches.some((mismatch) =>
          doesManagedOverlapBlockerExplainMismatch(blocker.key, mismatch.key),
        ),
      ),
    ),
  );

  return blockers;
}

function collectDurableResolvedProviderActivationBlockers(
  resolvedConfig: Record<string, unknown>,
  providerId: string,
): readonly EffectiveConfigVerificationBlocker[] {
  return collectProviderActivationBlockers(
    resolvedConfig,
    "inferred_higher_precedence",
    providerId,
  ).map((blocker) => ({
    ...blocker,
    reason:
      `Resolved config proves ${blocker.key} blocks ${providerId}, but no locally inspectable ` +
      "OPENCODE_CONFIG, user_config, project_config, or file-based system managed config layer explained it.",
  }));
}

function doesManagedOverlapBlockerExplainMismatch(
  blockerKey: string,
  mismatchKey: string,
): boolean {
  return (
    mismatchKey === blockerKey ||
    (blockerKey === "provider.gonkagate" &&
      mismatchKey.startsWith(`${blockerKey}.`))
  );
}

function collectResolvedConfigMismatches(
  resolvedConfig: Record<string, unknown>,
  verificationPolicy: ResolvedConfigVerificationPolicy,
): EffectiveConfigVerificationMismatch[] {
  return [
    ...collectValueCheckMismatches(
      resolvedConfig,
      verificationPolicy.rootValueChecks,
    ),
    ...collectProviderPolicyMismatchesFromResolvedConfig(
      resolvedConfig,
      verificationPolicy.provider,
    ),
  ];
}

function collectProviderPolicyMismatchesFromResolvedConfig(
  resolvedConfig: Record<string, unknown>,
  providerPolicy: ProviderVerificationPolicy,
): EffectiveConfigVerificationMismatch[] {
  const actualProviderObject = getNestedConfigValue(
    resolvedConfig,
    providerPolicy.object.path,
  );

  if (!isJsonObjectRecord(actualProviderObject)) {
    return [
      createMissingObjectMismatchAtConfiguredPath(
        resolvedConfig,
        providerPolicy.object,
      ),
    ];
  }

  // Provider policy checks stay rooted at the full resolved config document.
  const valueMismatches = collectValueCheckMismatches(
    resolvedConfig,
    providerPolicy.valueChecks,
  );
  const nestedObjectMismatches =
    collectRequiredNestedObjectPolicyMismatchesFromResolvedConfig(
      resolvedConfig,
      providerPolicy.requiredNestedObjects,
    );

  if (valueMismatches.length === 0 && nestedObjectMismatches.length === 0) {
    return [];
  }

  return [
    createProviderSummaryMismatch(
      actualProviderObject,
      providerPolicy.summaryOnMismatch,
    ),
    ...nestedObjectMismatches,
    ...valueMismatches,
  ];
}

function collectRequiredNestedObjectPolicyMismatchesFromResolvedConfig(
  resolvedConfig: Record<string, unknown>,
  nestedObjectPolicies: readonly RequiredNestedObjectVerification[] | undefined,
): EffectiveConfigVerificationMismatch[] {
  const mismatches: EffectiveConfigVerificationMismatch[] = [];

  for (const nestedObjectPolicy of nestedObjectPolicies ?? []) {
    const actualNestedObject = getNestedConfigValue(
      resolvedConfig,
      nestedObjectPolicy.object.path,
    );

    if (!isJsonObjectRecord(actualNestedObject)) {
      mismatches.push(
        createMissingObjectMismatchAtConfiguredPath(
          resolvedConfig,
          nestedObjectPolicy.object,
        ),
      );
      continue;
    }

    mismatches.push(
      ...collectValueCheckMismatches(
        resolvedConfig,
        nestedObjectPolicy.valueChecks,
      ),
    );
  }

  return mismatches;
}

function createMissingObjectMismatchAtConfiguredPath(
  root: Record<string, unknown>,
  check: {
    expected: Record<string, unknown>;
    path: readonly string[];
    reason: string;
  },
): EffectiveConfigVerificationMismatch {
  return createConfigValueMismatchAtPath(root, {
    expected: check.expected,
    path: check.path,
    reason: check.reason,
  });
}

function createProviderSummaryMismatch(
  actualValue: Record<string, unknown>,
  check: ProviderVerificationPolicy["summaryOnMismatch"],
): EffectiveConfigVerificationMismatch {
  return {
    actualValue: createRedactedDiagnosticValue(actualValue, check.path),
    expectedValue: createRedactedDiagnosticValue(check.expected, check.path),
    key: formatConfigPath(check.path),
    layer: "resolved_config",
    reason: check.reason,
  };
}

async function inspectDurableSecretBindingVerificationBlockers(
  request: EffectiveConfigVerificationRequest,
  dependencies: InstallDependencies,
  providerId: string,
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  return selectHighestPrecedenceInspectableBlockers(
    await inspectSecretBindingVerificationLayers(
      {
        managedPaths: request.context.workspace.managedPaths,
        providerId,
        scope: request.scope,
      },
      dependencies,
    ),
  );
}
