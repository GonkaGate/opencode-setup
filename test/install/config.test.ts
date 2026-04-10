import assert from "node:assert/strict";
import test from "node:test";
import {
  applyManagedConfigMutations,
  readManagedConfigDocument,
} from "../../src/install/config.js";
import { OPENCODE_CONFIG_SCHEMA_URL } from "../../src/install/managed-config-mutations.js";
import { createTestInstallDependencies } from "./test-deps.js";
import { expectInstallErrorCode } from "./test-helpers.js";

const TARGET_PATH = "/workspace/repo/opencode.json";
const VALIDATED_MODEL_REF = "gonkagate/qwen3-235b-a22b-instruct-2507-fp8";
const JSONC_CONFIG_WITH_COMMENT =
  '{\r\n  // keep this comment\r\n  "provider": {\r\n    "anthropic": {},\r\n  },\r\n}\r\n';
const CUSTOM_SCHEMA_CONFIG =
  '{\n  "$schema": "https://example.com/custom.json",\n  "model": "old/model"\n}\n';
const INVALID_JSONC_CONFIG = '{\n  "model": ,\n}\n';
const NON_OBJECT_ROOT_CONFIG = '["not", "an", "object"]\n';
const SCALAR_PROVIDER_CONFIG = '{\n  "provider": "oops"\n}\n';
const ACTIVATION_MUTATIONS = [
  {
    kind: "set",
    path: ["$schema"],
    value: OPENCODE_CONFIG_SCHEMA_URL,
  },
  {
    kind: "set",
    path: ["model"],
    value: VALIDATED_MODEL_REF,
  },
  {
    kind: "set",
    path: ["small_model"],
    value: VALIDATED_MODEL_REF,
  },
] as const;
const EXPECTED_ACTIVATION_CONFIG = `{\n  "$schema": "${OPENCODE_CONFIG_SCHEMA_URL}",\n  "model": "${VALIDATED_MODEL_REF}",\n  "small_model": "${VALIDATED_MODEL_REF}"\n}\n`;

function createTargetDependencies(contents?: string) {
  if (contents === undefined) {
    return createTestInstallDependencies();
  }

  return createTestInstallDependencies({
    seedFiles: [
      {
        contents,
        path: TARGET_PATH,
      },
    ],
  });
}

async function readTestDocument(
  options: {
    contents?: string;
    target?: "project_config" | "user_config";
  } = {},
) {
  return readManagedConfigDocument(
    options.target ?? "user_config",
    TARGET_PATH,
    createTargetDependencies(options.contents),
  );
}

test("readManagedConfigDocument treats a missing target as an empty config object", async () => {
  const document = await readTestDocument();

  assert.equal(document.exists, false);
  assert.equal(document.contents, "");
  assert.equal(document.eol, "\n");
  assert.deepEqual(document.initialValue, {});
});

test("applyManagedConfigMutations writes stable output for planned mutations", async () => {
  const document = await readTestDocument();
  const output = applyManagedConfigMutations(document, ACTIVATION_MUTATIONS);

  assert.equal(output, EXPECTED_ACTIVATION_CONFIG);
});

test("applyManagedConfigMutations preserves JSONC comments, trailing commas, and CRLF formatting", async () => {
  const document = await readTestDocument({
    contents: JSONC_CONFIG_WITH_COMMENT,
  });

  const output = applyManagedConfigMutations(document, [
    {
      kind: "set",
      path: ["$schema"],
      value: OPENCODE_CONFIG_SCHEMA_URL,
    },
    {
      kind: "set",
      path: ["provider", "gonkagate"],
      value: {
        name: "GonkaGate",
      },
    },
  ]);

  assert.match(output, /keep this comment/u);
  assert.match(output, /\r\n/u);
  assert.match(output, /"anthropic"/u);
  assert.match(output, /"gonkagate"/u);
  assert.match(output, /\$schema/u);
});

test("applyManagedConfigMutations leaves contents unchanged when no mutations are planned", async () => {
  const document = await readTestDocument({
    contents: CUSTOM_SCHEMA_CONFIG,
  });

  const output = applyManagedConfigMutations(document, []);

  assert.equal(output, CUSTOM_SCHEMA_CONFIG);
});

test("readManagedConfigDocument rejects JSON or JSONC parse failures as typed install errors", async () => {
  await assert.rejects(
    () => readTestDocument({ contents: INVALID_JSONC_CONFIG }),
    expectInstallErrorCode("managed_config_parse_failed"),
  );
});

test("readManagedConfigDocument rejects non-object roots as typed install errors", async () => {
  await assert.rejects(
    () =>
      readTestDocument({
        contents: NON_OBJECT_ROOT_CONFIG,
        target: "project_config",
      }),
    expectInstallErrorCode("managed_config_parse_failed"),
  );
});

test("applyManagedConfigMutations rejects impossible merges when a parent path is scalar", async () => {
  const document = await readTestDocument({
    contents: SCALAR_PROVIDER_CONFIG,
  });

  assert.throws(
    () =>
      applyManagedConfigMutations(document, [
        {
          kind: "set",
          path: ["provider", "gonkagate"],
          value: {
            name: "GonkaGate",
          },
        },
      ]),
    expectInstallErrorCode("managed_config_merge_failed"),
  );
});
