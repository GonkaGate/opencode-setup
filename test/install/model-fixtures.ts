import {
  createGonkagateModel,
  formatOpencodeModelRef,
  type ValidatedCuratedModel,
} from "../../src/constants/models.js";
import type { InstallHttp } from "../../src/install/deps.js";
import { buildManagedProviderCatalogConfig } from "../../src/install/managed-provider-config.js";

export const LIVE_MODEL_ID = "vendor/dynamic-alpha";
export const SECOND_LIVE_MODEL_ID = "vendor/dynamic-beta";
export const EXTRA_LIVE_MODEL_ID = "vendor/dynamic-extra";

export const LIVE_MODELS = Object.freeze([
  createGonkagateModel(LIVE_MODEL_ID, "Dynamic Alpha"),
  createGonkagateModel(SECOND_LIVE_MODEL_ID, "Dynamic Beta"),
] as const);
export const EXTRA_LIVE_MODEL = createGonkagateModel(
  EXTRA_LIVE_MODEL_ID,
  "Dynamic Extra",
);

export function createModelsHttp(
  models: readonly ValidatedCuratedModel[] = LIVE_MODELS,
): Partial<InstallHttp> {
  return {
    async fetch() {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return JSON.stringify({
            data: models.map((model) => ({
              id: model.modelId,
              name: model.displayName,
            })),
          });
        },
      };
    },
  };
}

export function createResolvedConfigFixture(
  options:
    | {
        modelKey?: string;
        models?: readonly ValidatedCuratedModel[];
        mutate?: (config: Record<string, unknown>) => void;
      }
    | ((config: Record<string, unknown>) => void) = {},
): string {
  const models = typeof options === "function" ? LIVE_MODELS : options.models;
  const modelKey =
    typeof options === "function" ? LIVE_MODEL_ID : options.modelKey;
  const mutate = typeof options === "function" ? options : options.mutate;
  const selectedModelKey = modelKey ?? LIVE_MODEL_ID;
  const resolvedConfig = {
    model: formatOpencodeModelRef(selectedModelKey),
    provider: {
      gonkagate: buildManagedProviderCatalogConfig(models ?? LIVE_MODELS),
    },
    small_model: formatOpencodeModelRef(selectedModelKey),
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}
