import {
  formatOpencodeModelRef,
  type ValidatedCuratedModel,
} from "../constants/models.js";
import type { InstallDependencies, InstallSelectChoice } from "./deps.js";
import { createInstallError } from "./errors.js";
import type { ManagedConfigScope } from "./contracts/managed-config.js";

export interface ModelSelectionRequest {
  modelKey?: string;
  models: readonly ValidatedCuratedModel[];
  yes: boolean;
}

export interface ScopeSelectionRequest {
  insideGitRepository: boolean;
  scope?: ManagedConfigScope;
  yes: boolean;
}

export function canUseInteractiveInstallPrompts(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return dependencies.runtime.stdinIsTTY && dependencies.runtime.stdoutIsTTY;
}

export function getRecommendedInstallScope(
  insideGitRepository: boolean,
): ManagedConfigScope {
  return insideGitRepository ? "project" : "user";
}

export async function resolveInstallModel(
  request: ModelSelectionRequest,
  dependencies: InstallDependencies,
): Promise<ValidatedCuratedModel> {
  const validatedModels = request.models;
  if (validatedModels.length === 0) {
    throw createInstallError("validated_models_unavailable", {});
  }

  if (request.modelKey !== undefined) {
    return requireFetchedModel(request.modelKey, validatedModels);
  }

  const isInteractive = canUseInteractiveInstallPrompts(dependencies);
  const singleValidatedModel =
    validatedModels.length === 1 ? validatedModels[0] : undefined;
  const defaultPromptModel =
    validatedModels[0] ?? raiseValidatedModelsUnavailable();

  if (request.yes) {
    return defaultPromptModel;
  }

  if (!isInteractive) {
    if (singleValidatedModel !== undefined) {
      return singleValidatedModel;
    }

    throw createInstallError("model_selection_required", {
      validatedModelCount: validatedModels.length,
    });
  }

  const selectedModelKey = await dependencies.prompts.selectOption({
    choices: validatedModels.map((model) =>
      createModelChoice(model, defaultPromptModel),
    ),
    defaultValue: defaultPromptModel.key,
    message: "Choose the GonkaGate model to configure for OpenCode",
    pageSize: Math.min(8, validatedModels.length),
  });

  return requireFetchedModel(selectedModelKey, validatedModels);
}

export async function resolveInstallScope(
  request: ScopeSelectionRequest,
  dependencies: InstallDependencies,
): Promise<ManagedConfigScope> {
  if (request.scope !== undefined) {
    return request.scope;
  }

  const recommendedScope = getRecommendedInstallScope(
    request.insideGitRepository,
  );

  if (request.yes) {
    return recommendedScope;
  }

  if (!canUseInteractiveInstallPrompts(dependencies)) {
    throw createInstallError("scope_selection_required", {
      insideGitRepository: request.insideGitRepository,
    });
  }

  return await dependencies.prompts.selectOption({
    choices: createScopeChoices(recommendedScope, request.insideGitRepository),
    defaultValue: recommendedScope,
    message:
      "Where should GonkaGate be activated for OpenCode on this machine?",
  });
}

function createModelChoice(
  model: ValidatedCuratedModel,
  defaultModel: ValidatedCuratedModel,
): InstallSelectChoice<string> {
  return {
    description: formatOpencodeModelRef(model),
    label:
      model.key === defaultModel.key
        ? `${model.displayName} (Default)`
        : model.displayName,
    value: model.key,
  };
}

function createScopeChoices(
  recommendedScope: ManagedConfigScope,
  insideGitRepository: boolean,
): readonly InstallSelectChoice<ManagedConfigScope>[] {
  return [
    {
      description: insideGitRepository
        ? "Keep GonkaGate active for this repository only by writing commit-safe project settings."
        : "Keep GonkaGate active for every local OpenCode session on this machine.",
      label:
        recommendedScope === "project"
          ? "Project only (Recommended)"
          : "Project only",
      value: "project",
    },
    {
      description:
        "Keep GonkaGate active in your user-level OpenCode config for this machine.",
      label:
        recommendedScope === "user"
          ? "This machine (Recommended)"
          : "This machine",
      value: "user",
    },
  ];
}

function requireFetchedModel(
  modelKey: string,
  models: readonly ValidatedCuratedModel[],
): ValidatedCuratedModel {
  const model = models.find((candidate) => candidate.key === modelKey);

  if (model === undefined) {
    throw createInstallError("unsupported_model_key", {
      modelKey,
    });
  }

  return model;
}

function raiseValidatedModelsUnavailable(): never {
  throw createInstallError("validated_models_unavailable", {});
}
