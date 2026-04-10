import assert from "node:assert/strict";
import test from "node:test";
import { MANAGED_CONFIG_PLANS } from "../../src/install/contracts/managed-config.js";
import {
  createManagedConfigMutations,
  OPENCODE_CONFIG_SCHEMA_URL,
} from "../../src/install/managed-config-mutations.js";

const MUTATION_INPUTS = {
  activationModelRef: "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
  ownedActivationModelRefs: [
    "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
    "gonkagate/legacy-curated-model",
  ],
  providerConfig: {
    name: "GonkaGate",
  },
} as const;

test("createManagedConfigMutations plans schema, provider, and activation edits for the user scope write", () => {
  const mutations = createManagedConfigMutations({
    currentConfig: {},
    mutationInputs: MUTATION_INPUTS,
    targetPlan: MANAGED_CONFIG_PLANS.user.steps[0],
  });

  assert.deepEqual(mutations, [
    {
      kind: "set",
      path: ["$schema"],
      value: OPENCODE_CONFIG_SCHEMA_URL,
    },
    {
      kind: "set",
      path: ["provider", "gonkagate"],
      value: MUTATION_INPUTS.providerConfig,
    },
    {
      kind: "set",
      path: ["model"],
      value: MUTATION_INPUTS.activationModelRef,
    },
    {
      kind: "set",
      path: ["small_model"],
      value: MUTATION_INPUTS.activationModelRef,
    },
  ]);
});

test("createManagedConfigMutations does not add a schema mutation when the config already declares one", () => {
  const mutations = createManagedConfigMutations({
    currentConfig: {
      $schema: "https://example.com/custom.json",
    },
    mutationInputs: MUTATION_INPUTS,
    targetPlan: MANAGED_CONFIG_PLANS.user.steps[0],
  });

  assert.equal(
    mutations.some(
      (mutation) =>
        mutation.kind === "set" &&
        mutation.path.length === 1 &&
        mutation.path[0] === "$schema",
    ),
    false,
  );
});

test("createManagedConfigMutations plans provider removal plus activation for the project config write", () => {
  const mutations = createManagedConfigMutations({
    currentConfig: {
      provider: {
        gonkagate: {
          name: "Old GonkaGate",
        },
        openai: {
          name: "OpenAI",
        },
      },
    },
    mutationInputs: MUTATION_INPUTS,
    targetPlan: MANAGED_CONFIG_PLANS.project.steps[1],
  });

  assert.deepEqual(mutations, [
    {
      kind: "set",
      path: ["$schema"],
      value: OPENCODE_CONFIG_SCHEMA_URL,
    },
    {
      kind: "delete",
      path: ["provider", "gonkagate"],
    },
    {
      kind: "set",
      path: ["model"],
      value: MUTATION_INPUTS.activationModelRef,
    },
    {
      kind: "set",
      path: ["small_model"],
      value: MUTATION_INPUTS.activationModelRef,
    },
  ]);
});

test("createManagedConfigMutations removes only installer-owned activation values during cleanup", () => {
  const mutations = createManagedConfigMutations({
    currentConfig: {
      model: "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
      provider: {
        gonkagate: {
          name: "Old GonkaGate",
        },
      },
      small_model: "gonkagate/legacy-curated-model",
    },
    mutationInputs: MUTATION_INPUTS,
    targetPlan: MANAGED_CONFIG_PLANS.user.steps[1],
  });

  assert.deepEqual(mutations, [
    {
      kind: "delete",
      path: ["provider"],
    },
    {
      kind: "delete",
      path: ["model"],
    },
    {
      kind: "delete",
      path: ["small_model"],
    },
  ]);
});

test("createManagedConfigMutations preserves non-owned activation values during cleanup", () => {
  const mutations = createManagedConfigMutations({
    currentConfig: {
      model: "openai/gpt-4.1",
      provider: {
        gonkagate: {
          name: "Old GonkaGate",
        },
      },
      small_model: "gonkagate/manual-custom",
    },
    mutationInputs: MUTATION_INPUTS,
    targetPlan: MANAGED_CONFIG_PLANS.user.steps[1],
  });

  assert.deepEqual(mutations, [
    {
      kind: "delete",
      path: ["provider"],
    },
  ]);
});
