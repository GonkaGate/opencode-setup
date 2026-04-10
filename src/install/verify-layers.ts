import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationFileBackedLayer,
  EffectiveConfigVerificationFileLayerSource,
  EffectiveConfigVerificationInputLayerSource,
} from "./contracts/effective-config.js";
import type { ManagedConfigScope } from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createSecretBindingVerificationPolicy } from "./effective-config-policy.js";
import { createInstallError } from "./errors.js";
import { tryParseJsoncObject } from "./jsonc.js";
import {
  resolveInspectableSystemManagedConfigPaths,
  type ManagedPaths,
} from "./paths.js";
import {
  collectManagedOverlapBlockers,
  collectProviderActivationBlockers,
  collectSecretBindingProvenanceBlockers,
} from "./verification-blockers.js";

const OPENCODE_CONFIG_ENV_KEY = "OPENCODE_CONFIG";
const INSPECTABLE_LAYER_PRECEDENCE = Object.freeze({
  OPENCODE_CONFIG: 1,
  project_config: 2,
  system_managed_config: 3,
  user_config: 0,
} satisfies Record<EffectiveConfigVerificationFileBackedLayer, number>);

export interface VerificationLayerInspectionRequest {
  managedPaths: ManagedPaths;
  providerId: string;
  scope: ManagedConfigScope;
}

interface ParsedLayerConfig {
  config: Record<string, unknown>;
  source: EffectiveConfigVerificationInputLayerSource;
}

export async function inspectVerificationLayers(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  const blockers: EffectiveConfigVerificationBlocker[] = [];
  const providerId = request.providerId;
  const layerConfigs = await collectInspectableLayerConfigs(
    request,
    dependencies,
  );

  for (const layerConfig of layerConfigs) {
    blockers.push(
      ...inspectLayerBlockers(layerConfig, providerId, request.scope),
    );
  }

  return blockers;
}

export async function inspectSecretBindingVerificationLayers(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  const layerConfigs = await collectInspectableLayerConfigs(
    request,
    dependencies,
  );
  const secretBindingPolicy = createSecretBindingVerificationPolicy(
    request.providerId,
  );
  const blockers: EffectiveConfigVerificationBlocker[] = [];
  let sawUserConfig = false;

  for (const layerConfig of layerConfigs) {
    if (layerConfig.source.layer === "user_config") {
      sawUserConfig = true;
    }

    blockers.push(
      ...collectSecretBindingProvenanceBlockers(
        layerConfig.config,
        layerConfig.source.layer,
        secretBindingPolicy,
      ),
    );
  }

  if (!sawUserConfig) {
    blockers.push(
      ...collectSecretBindingProvenanceBlockers(
        undefined,
        "user_config",
        secretBindingPolicy,
      ),
    );
  }

  return blockers;
}

export function selectHighestPrecedenceInspectableBlockers(
  blockers: readonly EffectiveConfigVerificationBlocker[],
): readonly EffectiveConfigVerificationBlocker[] {
  const selectedByKey = new Map<string, EffectiveConfigVerificationBlocker>();

  for (const blocker of blockers) {
    if (!isInspectableFileBackedLayer(blocker.layer)) {
      continue;
    }

    const currentSelection = selectedByKey.get(blocker.key);

    if (
      currentSelection === undefined ||
      (isInspectableFileBackedLayer(currentSelection.layer) &&
        getInspectableLayerPrecedence(blocker.layer) >
          getInspectableLayerPrecedence(currentSelection.layer))
    ) {
      selectedByKey.set(blocker.key, blocker);
    }
  }

  return [...selectedByKey.values()].sort(compareInspectableBlockers);
}

async function collectInspectableLayerConfigs(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
): Promise<readonly ParsedLayerConfig[]> {
  const layerConfigs: ParsedLayerConfig[] = [];

  for (const path of resolveInspectableSystemManagedConfigPaths(
    dependencies.runtime.env,
    dependencies.runtime.platform,
  )) {
    if (await dependencies.fs.pathExists(path)) {
      layerConfigs.push(
        await readLayerFromFile("system_managed_config", path, dependencies),
      );
    }
  }

  const opencodeConfigPath = dependencies.runtime.env[OPENCODE_CONFIG_ENV_KEY];

  if (opencodeConfigPath !== undefined) {
    layerConfigs.push(
      await readLayerFromFile(
        "OPENCODE_CONFIG",
        opencodeConfigPath,
        dependencies,
      ),
    );
  }

  if (
    await dependencies.fs.pathExists(request.managedPaths.projectConfigPath)
  ) {
    layerConfigs.push(
      await readLayerFromFile(
        "project_config",
        request.managedPaths.projectConfigPath,
        dependencies,
      ),
    );
  }

  if (await dependencies.fs.pathExists(request.managedPaths.userConfigPath)) {
    layerConfigs.push(
      await readLayerFromFile(
        "user_config",
        request.managedPaths.userConfigPath,
        dependencies,
      ),
    );
  }

  return layerConfigs;
}

async function readLayerFromFile(
  layer: EffectiveConfigVerificationFileBackedLayer,
  path: string,
  dependencies: InstallDependencies,
): Promise<ParsedLayerConfig> {
  const source: EffectiveConfigVerificationFileLayerSource = {
    kind: "file",
    layer,
    path,
  };
  const exists = await dependencies.fs.pathExists(path);

  if (!exists) {
    throw createInstallError("effective_config_layer_read_failed", {
      cause: new Error(`ENOENT: ${path}`),
      ...source,
    });
  }

  let contents: string;

  try {
    contents = await dependencies.fs.readFile(path, "utf8");
  } catch (cause) {
    throw createInstallError("effective_config_layer_read_failed", {
      cause,
      ...source,
    });
  }

  return {
    config: parseLayerContents(source, contents),
    source,
  };
}

function parseLayerContents(
  source: EffectiveConfigVerificationInputLayerSource,
  contents: string,
): Record<string, unknown> {
  const result = tryParseJsoncObject(contents);

  if (!result.ok) {
    throw createInstallError("effective_config_layer_parse_failed", {
      reason: result.error.reason,
      ...source,
    });
  }

  return result.value;
}

function inspectLayerForProviderActivation(
  layerConfig: ParsedLayerConfig,
  providerId: string,
): EffectiveConfigVerificationBlocker[] {
  return collectProviderActivationBlockers(
    layerConfig.config,
    layerConfig.source.layer,
    providerId,
  );
}

function inspectLayerForProviderActivationAndManagedOverlap(
  layerConfig: ParsedLayerConfig,
  providerId: string,
): EffectiveConfigVerificationBlocker[] {
  const blockers = inspectLayerForProviderActivation(layerConfig, providerId);

  blockers.push(
    ...collectManagedOverlapBlockers(
      layerConfig.config,
      layerConfig.source.layer,
    ),
  );

  return blockers;
}

function inspectLayerBlockers(
  layerConfig: ParsedLayerConfig,
  providerId: string,
  scope: ManagedConfigScope,
): EffectiveConfigVerificationBlocker[] {
  switch (layerConfig.source.layer) {
    case "system_managed_config":
    case "OPENCODE_CONFIG":
      return inspectLayerForProviderActivationAndManagedOverlap(
        layerConfig,
        providerId,
      );
    case "project_config":
      return inspectProjectLayerBlockers(layerConfig, providerId, scope);
    case "user_config":
      return inspectUserLayerBlockers(layerConfig, providerId);
    default:
      return [];
  }
}

function inspectProjectLayerBlockers(
  layerConfig: ParsedLayerConfig,
  providerId: string,
  scope: ManagedConfigScope,
): EffectiveConfigVerificationBlocker[] {
  return scope === "user"
    ? inspectLayerForProviderActivationAndManagedOverlap(
        layerConfig,
        providerId,
      )
    : inspectLayerForProviderActivation(layerConfig, providerId);
}

function inspectUserLayerBlockers(
  layerConfig: ParsedLayerConfig,
  providerId: string,
): EffectiveConfigVerificationBlocker[] {
  return inspectLayerForProviderActivation(layerConfig, providerId);
}

function isInspectableFileBackedLayer(
  layer: EffectiveConfigVerificationBlocker["layer"],
): layer is EffectiveConfigVerificationFileBackedLayer {
  return layer in INSPECTABLE_LAYER_PRECEDENCE;
}

function getInspectableLayerPrecedence(
  layer: EffectiveConfigVerificationFileBackedLayer,
): number {
  return INSPECTABLE_LAYER_PRECEDENCE[layer];
}

function compareInspectableBlockers(
  left: EffectiveConfigVerificationBlocker,
  right: EffectiveConfigVerificationBlocker,
): number {
  if (
    !isInspectableFileBackedLayer(left.layer) ||
    !isInspectableFileBackedLayer(right.layer)
  ) {
    return left.key.localeCompare(right.key);
  }

  return (
    getInspectableLayerPrecedence(right.layer) -
      getInspectableLayerPrecedence(left.layer) ||
    left.key.localeCompare(right.key)
  );
}
