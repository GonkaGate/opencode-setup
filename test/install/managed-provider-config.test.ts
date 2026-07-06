import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagedProviderCatalogConfig,
  buildManagedProviderConfig,
} from "../../src/install/managed-provider-config.js";
import {
  EXTRA_LIVE_MODEL,
  EXTRA_LIVE_MODEL_ID,
  LIVE_MODELS,
  LIVE_MODEL_ID,
  SECOND_LIVE_MODEL_ID,
} from "./model-fixtures.js";

test("buildManagedProviderConfig maps a fetched model into the provider model entry", () => {
  const providerConfig = buildManagedProviderConfig(LIVE_MODELS[0]);
  const modelConfig = providerConfig.models[LIVE_MODEL_ID];

  assert.equal(
    providerConfig.options.apiKey,
    "{file:~/.gonkagate/opencode/api-key}",
  );
  assert.equal(providerConfig.options.baseURL, "https://api.gonkagate.com/v1");
  assert.equal(modelConfig?.id, LIVE_MODEL_ID);
  assert.equal(modelConfig?.name, "Dynamic Alpha");
});

test("buildManagedProviderCatalogConfig exposes every fetched model for OpenCode model selection", () => {
  const providerConfig = buildManagedProviderCatalogConfig([
    ...LIVE_MODELS,
    EXTRA_LIVE_MODEL,
  ]);

  assert.equal(providerConfig.models[LIVE_MODEL_ID]?.id, LIVE_MODEL_ID);
  assert.equal(
    providerConfig.models[SECOND_LIVE_MODEL_ID]?.id,
    SECOND_LIVE_MODEL_ID,
  );
  assert.equal(
    providerConfig.models[EXTRA_LIVE_MODEL_ID]?.id,
    EXTRA_LIVE_MODEL_ID,
  );
});
