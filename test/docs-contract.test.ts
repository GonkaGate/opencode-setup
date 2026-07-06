import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import {
  FUTURE_TRANSPORT,
  GONKAGATE_BASE_URL,
  GONKAGATE_MODELS_URL,
  GONKAGATE_PROVIDER_ID,
} from "../src/constants/gateway.js";
import {
  assertMatchesAll,
  escapeRegExp,
  readText,
} from "./contract-helpers.js";

const OLD_MODEL_ID_PATTERNS = [
  /qwen\/qwen3-235b-a22b-instruct-2507-fp8/i,
  /moonshotai\/Kimi-K2\.6/i,
  /minimaxai\/minimax-m2\.7/i,
] as const;

function assertNoHardcodedPublicCatalog(text: string): void {
  for (const pattern of OLD_MODEL_ID_PATTERNS) {
    assert.doesNotMatch(text, pattern);
  }

  assert.doesNotMatch(text, /curated model registry/i);
  assert.doesNotMatch(text, /public curated model picker/i);
}

test("README captures shipped live model catalog contract", () => {
  const readme = readText("README.md");

  assertMatchesAll(readme, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
    new RegExp(escapeRegExp(GONKAGATE_BASE_URL)),
    new RegExp(escapeRegExp(GONKAGATE_MODELS_URL)),
    /Bearer auth/i,
    /live GonkaGate model picker/i,
    /--model.*fetched model id|fetched model id.*--model/i,
    /provider\.gonkagate\.models/i,
    /opencode debug config\s+--pure/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /OPENCODE_CONFIG_CONTENT/,
    /enabled_providers|disabled_providers/,
    /lastDurableSetupAt/,
    /native Windows|run directly on Windows/i,
    /WSL/i,
  ]);
  assertNoHardcodedPublicCatalog(readme);
});

test("current docs describe /v1/models as source of truth", () => {
  const docs = [
    readText("AGENTS.md"),
    readText("docs/how-it-works.md"),
    readText("docs/model-validation.md"),
    readText("docs/troubleshooting.md"),
    readText("docs/specs/opencode-setup-prd/spec.md"),
    readText("docs/architecture-decisions.md"),
  ].join("\n\n");

  assertMatchesAll(docs, [
    new RegExp(escapeRegExp(GONKAGATE_MODELS_URL)),
    /source of truth/i,
    /first fetched model/i,
    /--model[\s\S]*fetched model id|fetched model id[\s\S]*--model/i,
    /provider\.gonkagate\.models/i,
    /adding or removing|new or removed|adds or removes/i,
    /chat\/completions/,
    new RegExp(escapeRegExp(FUTURE_TRANSPORT)),
    new RegExp(escapeRegExp(`provider.${GONKAGATE_PROVIDER_ID}`)),
  ]);
  assertNoHardcodedPublicCatalog(docs);
});

test("security docs preserve secret-handling and verification contracts", () => {
  const security = readText("docs/security.md");

  assertMatchesAll(security, [
    /--api-key-stdin/,
    /GONKAGATE_API_KEY/,
    /plain `--api-key`|--api-key/i,
    /auth\.json/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /redacted/i,
    /opencode debug config --pure/i,
    /OPENCODE_CONFIG_CONTENT/,
  ]);
});

test("implementation plan explicitly marked historical", () => {
  const implementationPlan = readText("docs/implementation-plan.md");

  assertMatchesAll(implementationPlan, [
    /^# Historical Implementation Plan/m,
    /historical context/i,
  ]);
});

test("transport constants stay aligned with docs", () => {
  const readme = readText("README.md");

  assert.match(readme, /chat\/completions/);
});
