import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagedProviderCatalogConfig,
  buildManagedProviderConfig,
  type ManagedProviderSourceModel,
} from "../../src/install/managed-provider-config.js";

const BASE_VALIDATED_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Compat Test Model",
  key: "compat-test-model",
  modelId: "vendor/compat-test-model",
  recommended: false,
  transport: "chat_completions",
  validationStatus: "validated",
} as const satisfies ManagedProviderSourceModel;

test("buildManagedProviderConfig maps compatibility fragments and limits into the provider model entry", () => {
  const providerConfig = buildManagedProviderConfig({
    ...BASE_VALIDATED_MODEL,
    limits: {
      context: 128000,
      output: 32768,
    },
    runtimeCompatibility: {
      modelHeaders: {
        "x-gonkagate-mode": "validated",
      },
      modelOptions: {
        reasoningEffort: "high",
      },
      modelProvider: {
        api: "chat_completions",
        npm: "@ai-sdk/openai-compatible",
      },
      providerOptions: {
        timeout: 60_000,
      },
    },
  });
  const modelConfig = providerConfig.models[BASE_VALIDATED_MODEL.key];

  assert.equal(
    providerConfig.options.apiKey,
    "{file:~/.gonkagate/opencode/api-key}",
  );
  assert.equal(providerConfig.options.baseURL, "https://api.gonkagate.com/v1");
  assert.equal(providerConfig.options.timeout, 60_000);
  assert.equal(modelConfig?.limit?.context, 128000);
  assert.equal(modelConfig?.limit?.output, 32768);
  assert.equal(modelConfig?.options?.reasoningEffort, "high");
  assert.equal(modelConfig?.headers?.["x-gonkagate-mode"], "validated");
  assert.equal(modelConfig?.provider?.api, "chat_completions");
  assert.equal(modelConfig?.provider?.npm, "@ai-sdk/openai-compatible");
});

test("buildManagedProviderCatalogConfig exposes every validated model for OpenCode model selection", () => {
  const providerConfig = buildManagedProviderCatalogConfig();

  assert.ok(
    providerConfig.models["qwen3-235b-a22b-instruct-2507-fp8"] !== undefined,
  );
  assert.equal(
    providerConfig.models["qwen3-235b-a22b-instruct-2507-fp8"]?.id,
    "qwen/qwen3-235b-a22b-instruct-2507-fp8",
  );
  assert.ok(providerConfig.models["kimi-k2.6"] !== undefined);
  assert.equal(providerConfig.models["kimi-k2.6"]?.id, "moonshotai/Kimi-K2.6");
  assert.ok(providerConfig.models["minimax-m2.7"] !== undefined);
  assert.equal(
    providerConfig.models["minimax-m2.7"]?.id,
    "minimaxai/minimax-m2.7",
  );
});

test("buildManagedProviderConfig rejects compatibility metadata that conflicts with canonical provider keys", () => {
  assert.throws(
    () =>
      buildManagedProviderConfig({
        ...BASE_VALIDATED_MODEL,
        displayName: "Conflicting Provider Options",
        key: "conflict-test-model",
        modelId: "vendor/conflict-test-model",
        runtimeCompatibility: {
          providerOptions: {
            baseURL: "https://example.invalid/v1",
          },
        },
      }),
    /must not override options\.baseURL/i,
  );
});
