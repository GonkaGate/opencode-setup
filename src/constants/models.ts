import type { JsonObject, JsonValue } from "../json.js";

export const CURATED_MODEL_TRANSPORTS = Object.freeze([
  "chat_completions",
  "responses",
] as const);

export type CuratedModelTransport = (typeof CURATED_MODEL_TRANSPORTS)[number];
export type CuratedModelValidationStatus = "planned" | "validated";

export type CuratedModelJsonValue = JsonValue;

export interface CuratedModelProviderOverride {
  api?: CuratedModelTransport;
  npm?: string;
}

export interface CuratedModelCompatibility {
  modelHeaders?: Readonly<Record<string, string>>;
  modelOptions?: Readonly<JsonObject>;
  modelProvider?: Readonly<CuratedModelProviderOverride>;
  notes?: readonly string[];
  providerOptions?: Readonly<JsonObject>;
}

export interface CuratedModelLimits {
  context?: number;
  output?: number;
}

export interface CuratedModelMigrationMetadata {
  adapterPackage?: string;
  transport?: CuratedModelTransport;
}

export interface CuratedModelDefinition {
  adapterPackage: string;
  displayName: string;
  limits?: CuratedModelLimits;
  migrationMetadata?: CuratedModelMigrationMetadata;
  modelId: string;
  recommended: boolean;
  runtimeCompatibility?: CuratedModelCompatibility;
  transport: CuratedModelTransport;
  validationStatus: CuratedModelValidationStatus;
}

export interface CuratedModelRegistry {
  readonly [key: string]: CuratedModelDefinition;
}

export type CuratedModelRecord<TKey extends string = string> =
  CuratedModelDefinition & {
    key: TKey;
  };

type CuratedModelKeyOf<TRegistry extends CuratedModelRegistry> = Extract<
  keyof TRegistry,
  string
>;
type CuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = TRegistry[TKey] & {
  key: TKey;
};
type ValidatedCuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = Extract<
  CuratedModelRecordFor<TRegistry, TKey>,
  { validationStatus: "validated" }
>;
type RecommendedValidatedCuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = Extract<
  ValidatedCuratedModelRecordFor<TRegistry, TKey>,
  { recommended: true }
>;

export interface CuratedModelIndex<
  TRegistry extends CuratedModelRegistry = CuratedModelRegistry,
> {
  modelKeys: readonly CuratedModelKeyOf<TRegistry>[];
  models: readonly CuratedModelRecordFor<TRegistry>[];
  recommendedValidatedModel:
    | RecommendedValidatedCuratedModelRecordFor<TRegistry>
    | undefined;
  validatedModelKeys: readonly ValidatedCuratedModelRecordFor<TRegistry>["key"][];
  validatedModels: readonly ValidatedCuratedModelRecordFor<TRegistry>[];
}

export type OpencodeModelRef<TKey extends string = string> =
  `gonkagate/${TKey}`;

export const CURATED_MODEL_REGISTRY = Object.freeze({
  "qwen3-235b-a22b-instruct-2507-fp8": {
    adapterPackage: "@ai-sdk/openai-compatible",
    displayName: "Qwen3 235B A22B Instruct 2507 FP8",
    modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    recommended: true,
    transport: "chat_completions",
    validationStatus: "validated",
  },
} as const satisfies CuratedModelRegistry);

function toCuratedModelRecord<
  TKey extends string,
  TDefinition extends CuratedModelDefinition,
>(key: TKey, definition: TDefinition): TDefinition & { key: TKey } {
  return {
    ...definition,
    key,
  };
}

export function isValidatedModel<
  TModel extends { validationStatus: CuratedModelValidationStatus },
>(model: TModel): model is Extract<TModel, { validationStatus: "validated" }> {
  return model.validationStatus === "validated";
}

export function isRecommendedCuratedModel<
  TModel extends { recommended: boolean },
>(model: TModel): model is Extract<TModel, { recommended: true }> {
  return model.recommended;
}

export function createCuratedModelIndex<TRegistry extends CuratedModelRegistry>(
  registry: TRegistry,
): CuratedModelIndex<TRegistry> {
  type RegistryKey = CuratedModelKeyOf<TRegistry>;
  type RegistryModel = CuratedModelRecordFor<TRegistry>;
  type ValidatedRegistryModel = ValidatedCuratedModelRecordFor<TRegistry>;
  type RecommendedValidatedRegistryModel =
    RecommendedValidatedCuratedModelRecordFor<TRegistry>;

  const modelKeys = Object.keys(registry) as RegistryKey[];
  const models: RegistryModel[] = [];
  const validatedModels: ValidatedRegistryModel[] = [];
  const validatedModelKeys: ValidatedRegistryModel["key"][] = [];
  const recommendedValidatedModels: RecommendedValidatedRegistryModel[] = [];

  for (const key of modelKeys) {
    const model = toCuratedModelRecord(key, registry[key]);
    models.push(model);

    if (!isValidatedModel(model)) {
      continue;
    }

    validatedModels.push(model);
    validatedModelKeys.push(model.key);

    if (isRecommendedCuratedModel(model)) {
      recommendedValidatedModels.push(model);
    }
  }

  if (recommendedValidatedModels.length > 1) {
    throw new Error(
      "Curated model registry must not expose more than one recommended validated model.",
    );
  }

  return {
    modelKeys: Object.freeze(modelKeys),
    models: Object.freeze(models),
    recommendedValidatedModel: recommendedValidatedModels[0],
    validatedModelKeys: Object.freeze(validatedModelKeys),
    validatedModels: Object.freeze(validatedModels),
  };
}

type DefaultCuratedModelRegistry = typeof CURATED_MODEL_REGISTRY;

export type CuratedModelKey = CuratedModelKeyOf<DefaultCuratedModelRegistry>;
export type CuratedModel = CuratedModelRecordFor<DefaultCuratedModelRegistry>;
export type CuratedModelByKey<TKey extends CuratedModelKey> =
  CuratedModelRecordFor<DefaultCuratedModelRegistry, TKey>;
export type ValidatedCuratedModel =
  ValidatedCuratedModelRecordFor<DefaultCuratedModelRegistry>;
export type RecommendedValidatedCuratedModel =
  RecommendedValidatedCuratedModelRecordFor<DefaultCuratedModelRegistry>;

const DEFAULT_CURATED_MODEL_INDEX = createCuratedModelIndex(
  CURATED_MODEL_REGISTRY,
);

export const SUPPORTED_MODELS: readonly CuratedModel[] =
  DEFAULT_CURATED_MODEL_INDEX.models;

export const SUPPORTED_MODEL_KEYS: readonly CuratedModelKey[] =
  DEFAULT_CURATED_MODEL_INDEX.modelKeys;

export function isCuratedModelKey(key: string): key is CuratedModelKey {
  return key in CURATED_MODEL_REGISTRY;
}

export function isCuratedModelTransport(
  value: unknown,
): value is CuratedModelTransport {
  return (
    typeof value === "string" &&
    CURATED_MODEL_TRANSPORTS.includes(value as CuratedModelTransport)
  );
}

export function getCuratedModelByKey<TKey extends CuratedModelKey>(
  key: TKey,
): CuratedModelByKey<TKey>;
export function getCuratedModelByKey(key: string): CuratedModel | undefined;
export function getCuratedModelByKey(key: string): CuratedModel | undefined {
  if (!isCuratedModelKey(key)) {
    return undefined;
  }

  return toCuratedModelRecord(key, CURATED_MODEL_REGISTRY[key]);
}

export function getValidatedModels(): readonly ValidatedCuratedModel[] {
  return DEFAULT_CURATED_MODEL_INDEX.validatedModels;
}

export function getValidatedModelKeys(): readonly ValidatedCuratedModel["key"][] {
  return DEFAULT_CURATED_MODEL_INDEX.validatedModelKeys;
}

export function getRecommendedValidatedModel():
  | RecommendedValidatedCuratedModel
  | undefined {
  return DEFAULT_CURATED_MODEL_INDEX.recommendedValidatedModel;
}

export function formatOpencodeModelRef<TKey extends string>(
  model: TKey | { key: TKey },
): OpencodeModelRef<TKey> {
  const modelKey = typeof model === "string" ? model : model.key;
  return `gonkagate/${modelKey}`;
}
