import type { JsonObject } from "../json.js";
import {
  getCuratedModelByKey,
  type CuratedModelCompatibility,
  type CuratedModelKey,
  type CuratedModelProviderOverride,
  type CuratedModelRecord,
  type CuratedModelTransport,
} from "../constants/models.js";
import {
  CURRENT_TRANSPORT,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_ID,
  GONKAGATE_PROVIDER_NAME,
} from "../constants/gateway.js";

export const GONKAGATE_SECRET_FILE_REFERENCE =
  "{file:~/.gonkagate/opencode/api-key}";
const OPENAI_COMPATIBLE_ADAPTER = "@ai-sdk/openai-compatible";

export type ManagedProviderSourceModel = CuratedModelRecord<string> & {
  validationStatus: "validated";
};

type ManagedProviderLimit = JsonObject & {
  context: number;
  output: number;
};

type ManagedProviderModelConfig = JsonObject & {
  headers?: Record<string, string>;
  id: string;
  limit?: ManagedProviderLimit;
  name: string;
  options?: JsonObject;
  provider?: CuratedModelProviderOverride;
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

export function resolveValidatedModel(
  modelKey: CuratedModelKey,
): ManagedProviderSourceModel {
  const model = getCuratedModelByKey(modelKey);

  if (model === undefined || model.validationStatus !== "validated") {
    throw new Error(`Unknown validated GonkaGate model key: ${modelKey}`);
  }

  return model;
}

export function buildManagedProviderConfig(
  model: ManagedProviderSourceModel,
): ManagedProviderConfig {
  assertCanonicalModelContract(model);

  return {
    api: model.transport,
    models: {
      [model.key]: buildManagedProviderModelConfig(model),
    },
    name: GONKAGATE_PROVIDER_NAME,
    npm: model.adapterPackage,
    options: buildManagedProviderOptions(model.runtimeCompatibility),
  };
}

function buildManagedProviderOptions(
  compatibility: CuratedModelCompatibility | undefined,
): JsonObject {
  const providerOptions: JsonObject = {
    apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
    baseURL: GONKAGATE_BASE_URL,
  };

  for (const [key, value] of Object.entries(
    compatibility?.providerOptions ?? {},
  )) {
    if (key === "apiKey" && value !== GONKAGATE_SECRET_FILE_REFERENCE) {
      throw new Error(
        `Validated model compatibility for ${GONKAGATE_PROVIDER_ID} must not override options.apiKey.`,
      );
    }

    if (key === "baseURL" && value !== GONKAGATE_BASE_URL) {
      throw new Error(
        `Validated model compatibility for ${GONKAGATE_PROVIDER_ID} must not override options.baseURL.`,
      );
    }

    if (key === "apiKey" || key === "baseURL") {
      continue;
    }

    providerOptions[key] = value;
  }

  return providerOptions;
}

function buildManagedProviderModelConfig(
  model: ManagedProviderSourceModel,
): ManagedProviderModelConfig {
  const managedModel: ManagedProviderModelConfig = {
    id: model.modelId,
    name: model.displayName,
  };
  const compatibility = model.runtimeCompatibility;

  if (model.limits !== undefined) {
    if (
      model.limits.context === undefined ||
      model.limits.output === undefined
    ) {
      throw new Error(
        `Validated model ${model.key} must define both limit.context and limit.output together.`,
      );
    }

    managedModel.limit = {
      context: model.limits.context,
      output: model.limits.output,
    };
  }

  if (compatibility?.modelOptions !== undefined) {
    managedModel.options = { ...compatibility.modelOptions };
  }

  if (compatibility?.modelHeaders !== undefined) {
    managedModel.headers = { ...compatibility.modelHeaders };
  }

  if (compatibility?.modelProvider !== undefined) {
    assertModelProviderOverride(model, compatibility.modelProvider);
    managedModel.provider = { ...compatibility.modelProvider };
  }

  return managedModel;
}

function assertCanonicalModelContract(model: ManagedProviderSourceModel): void {
  if (model.adapterPackage !== OPENAI_COMPATIBLE_ADAPTER) {
    throw new Error(
      `Validated model ${model.key} must use ${OPENAI_COMPATIBLE_ADAPTER} during Phase 3.`,
    );
  }

  if (model.transport !== CURRENT_TRANSPORT) {
    throw new Error(
      `Validated model ${model.key} must use ${CURRENT_TRANSPORT} during Phase 3.`,
    );
  }
}

function assertModelProviderOverride(
  model: ManagedProviderSourceModel,
  override: Readonly<CuratedModelProviderOverride>,
): void {
  if (override.npm !== undefined && override.npm !== model.adapterPackage) {
    throw new Error(
      `Validated model ${model.key} must not override provider.npm during Phase 3.`,
    );
  }

  if (override.api !== undefined && override.api !== model.transport) {
    throw new Error(
      `Validated model ${model.key} must not override provider.api during Phase 3.`,
    );
  }
}
