import type { JsonObject } from "../json.js";
import type {
  CuratedModelTransport,
  ValidatedCuratedModel,
} from "../constants/models.js";
import {
  CURRENT_TRANSPORT,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_NAME,
} from "../constants/gateway.js";

export const GONKAGATE_SECRET_FILE_REFERENCE =
  "{file:~/.gonkagate/opencode/api-key}";
const OPENAI_COMPATIBLE_ADAPTER = "@ai-sdk/openai-compatible";

export type ManagedProviderSourceModel = ValidatedCuratedModel;

type ManagedProviderModelConfig = JsonObject & {
  id: string;
  name: string;
};

type ManagedProviderModelMap = JsonObject &
  Record<string, ManagedProviderModelConfig>;

export type ManagedProviderConfig = JsonObject & {
  api: CuratedModelTransport;
  models: ManagedProviderModelMap;
  name: string;
  npm: string;
  options: JsonObject;
};

export function buildManagedProviderConfig(
  model: ManagedProviderSourceModel,
): ManagedProviderConfig {
  return buildManagedProviderCatalogConfig([model]);
}

export function buildManagedProviderCatalogConfig(
  models: readonly ManagedProviderSourceModel[],
): ManagedProviderConfig {
  if (models.length === 0) {
    throw new Error(
      "GonkaGate provider catalog must include at least one model.",
    );
  }

  const providerModels: ManagedProviderModelMap = {};

  for (const model of models) {
    providerModels[model.key] = {
      id: model.modelId,
      name: model.displayName,
    };
  }

  return {
    api: CURRENT_TRANSPORT,
    models: providerModels,
    name: GONKAGATE_PROVIDER_NAME,
    npm: OPENAI_COMPATIBLE_ADAPTER,
    options: {
      apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
      baseURL: GONKAGATE_BASE_URL,
    },
  };
}
