import { formatOpencodeModelRef } from "../constants/models.js";
import {
  MANAGED_CONFIG_PLANS,
  type ManagedConfigTarget,
  type ManagedConfigTargetStep,
  type ManagedConfigWriteContext,
  type ManagedConfigWriteResult,
  type ManagedConfigWriteResultsByTarget,
  type ScopeWriteRequest,
  type ScopeWriteResult,
} from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  buildManagedProviderConfig,
  resolveValidatedModel,
} from "./managed-provider-config.js";
import { writeManagedConfigTarget } from "./write-target-config.js";

export async function writeScopeManagedConfigs(
  request: ScopeWriteRequest,
  dependencies: InstallDependencies,
): Promise<ScopeWriteResult> {
  const plan = MANAGED_CONFIG_PLANS[request.scope];
  const results = await writePlanTargets(
    plan.steps,
    createManagedConfigWriteContext(request),
    dependencies,
  );

  return {
    projectConfig: results.project_config,
    userConfig: requireTargetWriteResult(results, "user_config", request.scope),
  };
}

function createManagedConfigWriteContext(
  request: ScopeWriteRequest,
): ManagedConfigWriteContext {
  const model = resolveValidatedModel(request.model);

  return {
    activationModelRef: formatOpencodeModelRef(model),
    managedPaths: request.managedPaths,
    ownedActivationModelRefs: createOwnedActivationModelRefs(request),
    providerConfig: buildManagedProviderConfig(model),
  };
}

function createOwnedActivationModelRefs(
  request: ScopeWriteRequest,
): readonly string[] {
  const ownedActivationModelRefs = new Set<string>([
    formatOpencodeModelRef(request.model),
  ]);

  if (request.previousManagedModelKey !== undefined) {
    ownedActivationModelRefs.add(
      formatOpencodeModelRef(request.previousManagedModelKey),
    );
  }

  return Object.freeze([...ownedActivationModelRefs]);
}

async function writePlanTargets(
  steps: readonly ManagedConfigTargetStep[],
  writeContext: ManagedConfigWriteContext,
  dependencies: InstallDependencies,
): Promise<ManagedConfigWriteResultsByTarget> {
  const results: ManagedConfigWriteResultsByTarget = {};

  for (const targetPlan of steps) {
    if (targetPlan.target === "user_config") {
      results.user_config = await writeManagedConfigTarget(
        {
          targetPlan,
          writeContext,
        },
        dependencies,
      );
      continue;
    }

    results.project_config = await writeManagedConfigTarget(
      {
        targetPlan,
        writeContext,
      },
      dependencies,
    );
  }

  return results;
}

function requireTargetWriteResult<TTarget extends ManagedConfigTarget>(
  results: ManagedConfigWriteResultsByTarget,
  target: TTarget,
  scope: ScopeWriteRequest["scope"],
): ManagedConfigWriteResult<TTarget> {
  const result = results[target];

  if (result === undefined) {
    throw createInstallError("managed_config_plan_invalid", {
      missingTarget: target,
      scope,
    });
  }

  return result as ManagedConfigWriteResult<TTarget>;
}
