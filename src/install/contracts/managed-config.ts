import type { CuratedModelKey } from "../../constants/models.js";
import type { JsonObject, JsonValue } from "../../json.js";
import type { ManagedPaths } from "../paths.js";
import type { ManagedArtifactWriteResult } from "./managed-artifact.js";

export const MANAGED_CONFIG_TARGETS = Object.freeze([
  "project_config",
  "user_config",
] as const);

export const MANAGED_CONFIG_SCOPES = Object.freeze([
  "project",
  "user",
] as const);

export type ManagedConfigTarget = (typeof MANAGED_CONFIG_TARGETS)[number];
export type ManagedConfigScope = (typeof MANAGED_CONFIG_SCOPES)[number];

export interface ManagedConfigDocument<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> {
  contents: string;
  eol: "\n" | "\r\n";
  exists: boolean;
  initialValue: Record<string, unknown>;
  path: string;
  target: TTarget;
}

type ManagedConfigActivationMode = "preserve" | "remove" | "write";
type ManagedConfigProviderMode = "preserve" | "remove" | "write";

export interface ManagedConfigTargetPlan<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> {
  readonly activation: ManagedConfigActivationMode;
  readonly provider: ManagedConfigProviderMode;
  readonly target: TTarget;
}

export type ManagedConfigTargetStep =
  | ManagedConfigTargetPlan<"project_config">
  | ManagedConfigTargetPlan<"user_config">;

export interface ManagedConfigScopePlan {
  readonly scope: ManagedConfigScope;
  readonly steps: readonly ManagedConfigTargetStep[];
}

export const MANAGED_CONFIG_PLANS = Object.freeze({
  project: {
    scope: "project",
    steps: [
      {
        activation: "remove",
        provider: "write",
        target: "user_config",
      },
      {
        activation: "write",
        provider: "remove",
        target: "project_config",
      },
    ],
  },
  user: {
    scope: "user",
    steps: [
      {
        activation: "write",
        provider: "write",
        target: "user_config",
      },
      {
        activation: "remove",
        provider: "remove",
        target: "project_config",
      },
    ],
  },
} as const satisfies Record<ManagedConfigScope, ManagedConfigScopePlan>);

export type ManagedConfigPlan =
  (typeof MANAGED_CONFIG_PLANS)[ManagedConfigScope];

export interface ScopeWriteRequest {
  managedPaths: ManagedPaths;
  model: CuratedModelKey;
  previousManagedModelKey?: CuratedModelKey;
  scope: ManagedConfigScope;
}

export interface ManagedConfigMutationInputs {
  activationModelRef: string;
  ownedActivationModelRefs: readonly string[];
  providerConfig: JsonObject;
}

export interface ManagedConfigWriteContext extends ManagedConfigMutationInputs {
  managedPaths: ManagedPaths;
}

export type ManagedConfigWriteResult<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> = ManagedArtifactWriteResult & {
  target: TTarget;
};

export interface ManagedConfigWriteResultsByTarget {
  project_config?: ManagedConfigWriteResult<"project_config">;
  user_config?: ManagedConfigWriteResult<"user_config">;
}

export interface ScopeWriteResult {
  projectConfig?: ManagedConfigWriteResult<"project_config">;
  userConfig: ManagedConfigWriteResult<"user_config">;
}

export interface ManagedConfigMutationDelete {
  kind: "delete";
  path: readonly string[];
}

export interface ManagedConfigMutationSet {
  kind: "set";
  path: readonly string[];
  value: JsonValue;
}

export type ManagedConfigMutation =
  | ManagedConfigMutationDelete
  | ManagedConfigMutationSet;

export function isManagedConfigScope(
  value: unknown,
): value is ManagedConfigScope {
  return (
    typeof value === "string" &&
    MANAGED_CONFIG_SCOPES.includes(value as ManagedConfigScope)
  );
}
