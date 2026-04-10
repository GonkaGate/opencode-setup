import { isJsonObjectRecord } from "../json.js";
import type {
  ManagedConfigMutation,
  ManagedConfigMutationInputs,
  ManagedConfigTargetPlan,
} from "./contracts/managed-config.js";

export const OPENCODE_CONFIG_SCHEMA_URL = "https://opencode.ai/config.json";

export interface ManagedConfigMutationRequest {
  currentConfig: Record<string, unknown>;
  mutationInputs: ManagedConfigMutationInputs;
  targetPlan: ManagedConfigTargetPlan;
}

export function createManagedConfigMutations(
  request: ManagedConfigMutationRequest,
): ManagedConfigMutation[] {
  const mutations: ManagedConfigMutation[] = [];
  const providerRemovalMutation =
    request.targetPlan.provider === "remove"
      ? createManagedProviderRemovalMutation(request.currentConfig)
      : undefined;

  if (providerRemovalMutation !== undefined) {
    mutations.push(providerRemovalMutation);
  }

  if (request.targetPlan.provider === "write") {
    mutations.push({
      kind: "set",
      path: ["provider", "gonkagate"],
      value: request.mutationInputs.providerConfig,
    });
  }

  if (request.targetPlan.activation === "write") {
    mutations.push(
      {
        kind: "set",
        path: ["model"],
        value: request.mutationInputs.activationModelRef,
      },
      {
        kind: "set",
        path: ["small_model"],
        value: request.mutationInputs.activationModelRef,
      },
    );
  }

  if (request.targetPlan.activation === "remove") {
    mutations.push(
      ...createOwnedActivationRemovalMutations(
        request.currentConfig,
        ["model", "small_model"],
        request.mutationInputs.ownedActivationModelRefs,
      ),
    );
  }

  if (
    !Object.hasOwn(request.currentConfig, "$schema") &&
    mutations.some((mutation) => mutation.kind === "set")
  ) {
    mutations.unshift({
      kind: "set",
      path: ["$schema"],
      value: OPENCODE_CONFIG_SCHEMA_URL,
    });
  }

  return mutations;
}

function createManagedProviderRemovalMutation(
  currentConfig: Record<string, unknown>,
): ManagedConfigMutation | undefined {
  const providerValue = currentConfig.provider;

  if (
    !isJsonObjectRecord(providerValue) ||
    !Object.hasOwn(providerValue, "gonkagate")
  ) {
    return undefined;
  }

  const providerKeys = Object.keys(providerValue).filter(
    (key) => key !== "gonkagate",
  );

  return {
    kind: "delete",
    path: providerKeys.length === 0 ? ["provider"] : ["provider", "gonkagate"],
  };
}

function createOwnedActivationRemovalMutations(
  currentConfig: Record<string, unknown>,
  keys: readonly ("model" | "small_model")[],
  ownedActivationModelRefs: readonly string[],
): ManagedConfigMutation[] {
  const ownedActivationRefs = new Set(ownedActivationModelRefs);
  const mutations: ManagedConfigMutation[] = [];

  for (const key of keys) {
    if (!isOwnedActivationValue(currentConfig[key], ownedActivationRefs)) {
      continue;
    }

    mutations.push({
      kind: "delete",
      path: [key],
    });
  }

  return mutations;
}

function isOwnedActivationValue(
  value: unknown,
  ownedActivationRefs: ReadonlySet<string>,
): value is string {
  return typeof value === "string" && ownedActivationRefs.has(value);
}
