import assert from "node:assert/strict";
import test from "node:test";
import {
  CURATED_MODEL_REGISTRY,
  createCuratedModelIndex,
  formatOpencodeModelRef,
  getRecommendedValidatedModel,
  getValidatedModels,
  type CuratedModelRecord,
  type CuratedModelRegistry,
} from "../../src/constants/models.js";

test("the default curated registry exposes validated entries through the validated-model helpers", () => {
  const validatedModels = getValidatedModels();

  assert.equal(validatedModels.length, 1);
  assert.equal(validatedModels[0]?.key, "qwen3-235b-a22b-instruct-2507-fp8");
  assert.equal(validatedModels[0]?.validationStatus, "validated");
});

test("createCuratedModelIndex derives keyed records and picks the recommended validated model by metadata", () => {
  const testRegistry = {
    alpha: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Alpha",
      modelId: "gonkagate/alpha",
      recommended: false,
      transport: "chat_completions",
      validationStatus: "validated",
    },
    beta: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Beta",
      modelId: "gonkagate/beta",
      recommended: true,
      transport: "chat_completions",
      validationStatus: "validated",
    },
    gamma: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Gamma",
      modelId: "gonkagate/gamma",
      recommended: true,
      transport: "responses",
      validationStatus: "planned",
    },
  } as const satisfies CuratedModelRegistry;

  const index = createCuratedModelIndex(testRegistry);

  assert.deepEqual(index.modelKeys, ["alpha", "beta", "gamma"]);
  assert.equal(index.models[0]?.key, "alpha");
  assert.equal(index.recommendedValidatedModel?.key, "beta");
  assert.deepEqual(index.validatedModelKeys, ["alpha", "beta"]);
});

test("createCuratedModelIndex rejects more than one recommended validated model", () => {
  const invalidRegistry = {
    alpha: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Alpha",
      modelId: "gonkagate/alpha",
      recommended: true,
      transport: "chat_completions",
      validationStatus: "validated",
    },
    beta: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Beta",
      modelId: "gonkagate/beta",
      recommended: true,
      transport: "responses",
      validationStatus: "validated",
    },
  } as const satisfies CuratedModelRegistry;

  assert.throws(
    () => createCuratedModelIndex(invalidRegistry),
    /must not expose more than one recommended validated model/i,
  );
});

test("the recommended validated model is selected by explicit metadata, not array order", () => {
  const recommendedModel = getRecommendedValidatedModel();

  assert.equal(recommendedModel?.key, "qwen3-235b-a22b-instruct-2507-fp8");
  assert.equal(recommendedModel?.recommended, true);
});

test("the formatted OpenCode model reference uses the stable provider/model key shape", () => {
  assert.equal(
    formatOpencodeModelRef("qwen3-235b-a22b-instruct-2507-fp8"),
    "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
  );
});

test("the curated model contract can carry compatibility and migration metadata", () => {
  const metadataRichRecord: CuratedModelRecord = {
    adapterPackage: "@ai-sdk/openai-compatible",
    runtimeCompatibility: {
      modelHeaders: {
        "x-gonkagate-mode": "validated",
      },
      modelOptions: {
        reasoningEffort: "high",
      },
      notes: ["Validated against the OpenCode 1.4.0 baseline."],
      providerOptions: {
        baseURL: "https://api.gonkagate.com/v1",
      },
    },
    displayName: "Metadata Rich Test Record",
    key: "metadata-rich-test-record",
    migrationMetadata: {
      adapterPackage: "@ai-sdk/openai",
      transport: "responses",
    },
    modelId: "gonkagate/metadata-rich-test-record",
    recommended: false,
    transport: "chat_completions",
    validationStatus: "planned",
  };

  assert.equal(
    metadataRichRecord.runtimeCompatibility?.providerOptions?.baseURL,
    "https://api.gonkagate.com/v1",
  );
  assert.equal(metadataRichRecord.migrationMetadata?.transport, "responses");
});

test("the shipped registry stays wired through the default derived index", () => {
  const index = createCuratedModelIndex(CURATED_MODEL_REGISTRY);

  assert.equal(index.models.length, 1);
  assert.equal(index.models[0]?.key, "qwen3-235b-a22b-instruct-2507-fp8");
});
