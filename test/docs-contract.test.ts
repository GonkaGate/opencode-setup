import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import {
  CURRENT_TRANSPORT,
  FUTURE_TRANSPORT,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_ID,
} from "../src/constants/gateway.js";
import {
  assertMatchesAll,
  escapeRegExp,
  readText,
} from "./contract-helpers.js";

test("README captures the shipped runtime truth and current opencode contract", () => {
  const readme = readText("README.md");

  assertMatchesAll(readme, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
    new RegExp(escapeRegExp(GONKAGATE_BASE_URL)),
    /~\/\.config\/opencode\/opencode\.json/,
    /OPENCODE_CONFIG.*override layer/i,
    /OPENCODE_CONFIG_CONTENT/,
    /enabled_providers|disabled_providers/,
    /opencode\.json/,
    new RegExp(escapeRegExp(`provider.${GONKAGATE_PROVIDER_ID}`)),
    new RegExp(escapeRegExp(CONTRACT_METADATA.verifiedOpencode.minVersion)),
    /chat\/completions/,
    /public curated model picker/i,
    /qwen\/qwen3-235b-a22b-instruct-2507-fp8/,
    /rerunning the installer is the official safe update path/i,
    /lastDurableSetupAt/,
    /durably verified setup/i,
    /compatibility metadata|provider options|model options|headers/i,
    /opencode debug config\s+--pure/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /locally\s+inspectable/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /repair.*owner-only|reruns?.*repair.*secret/i,
    /user config[\s\S]*OPENCODE_CONFIG[\s\S]*project config[\s\S]*system managed/i,
    /redacted.*resolved-config|resolved-config.*raw/i,
    /durable plain-`opencode` outcome|current session's effective OpenCode outcome/i,
    /interactive mode keeps the public curated model picker visible/i,
    /fallback entrypoint error handling/i,
    /native Windows/i,
    /Windows CI|native Windows CI|integration coverage/i,
    /WSL/i,
    /--api-key-stdin/,
    /GONKAGATE_API_KEY/,
    /~\/\.gonkagate\/opencode\/backups\/project-config/,
  ]);

  assert.doesNotMatch(readme, /not implemented yet/i);
  assert.doesNotMatch(
    readme,
    /v1 support target is macOS, Linux, and WSL-based OpenCode usage on Windows/i,
  );
});

test("AGENTS captures the repository contract anchors for the shipped runtime", () => {
  const agents = readText("AGENTS.md");

  assertMatchesAll(agents, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.packageName)),
    /src\/cli\.ts/,
    /docs\/specs\/opencode-setup-prd\/spec\.md/,
    /~\/\.config\/opencode\/opencode\.json/,
    /OPENCODE_CONFIG.*override layer/i,
    /OPENCODE_CONFIG_CONTENT/,
    /enabled_providers|disabled_providers/,
    /opencode\.json/,
    new RegExp(escapeRegExp(`provider.${GONKAGATE_PROVIDER_ID}`)),
    /compatibility metadata|required for validated OpenCode flows/i,
    /end-to-end public installer flow is implemented/i,
    /public curated model picker is shipped/i,
    /effective OpenCode config/i,
    /current session's runtime-resolved outcome/i,
    /lastDurableSetupAt/,
    /last durably verified setup/i,
    /opencode debug config\s+--pure/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /locally\s+inspectable/i,
    /user config[\s\S]*OPENCODE_CONFIG[\s\S]*project config[\s\S]*system managed/i,
    /repair drifted.*secret|without rewriting the secret/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /interactive mode keeps the public curated model picker visible/i,
    /raw resolved config/i,
    /native Windows/i,
    /native Windows CI|Windows runners|runner-backed proof/i,
    /WSL/i,
    /--api-key-stdin/,
    /GONKAGATE_API_KEY/,
    /no plain CLI flag/i,
    /~\/\.gonkagate\/opencode\/backups\/project-config/,
  ]);
  assert.doesNotMatch(agents, /should not be claimed until validated/i);
});

test("implementation docs capture the shipped setup architecture and boundaries", () => {
  const howItWorks = readText("docs/how-it-works.md");
  const troubleshooting = readText("docs/troubleshooting.md");
  const prd = readText("docs/specs/opencode-setup-prd/spec.md");

  assertMatchesAll(howItWorks, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
    new RegExp(escapeRegExp(CONTRACT_METADATA.verifiedOpencode.minVersion)),
    new RegExp(escapeRegExp(CURRENT_TRANSPORT)),
    /OPENCODE_CONFIG.*higher-precedence/i,
    /OPENCODE_CONFIG_CONTENT/,
    /enabled_providers|disabled_providers/,
    /opencode debug config\s+--pure/i,
    /provider options|model options|headers|compatibility metadata/i,
    /locally\s+inspectable/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /user config[\s\S]*OPENCODE_CONFIG[\s\S]*project[\s\S]*system managed/i,
    /repair drifted.*owner-only|without rewriting unchanged secret/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /must not print raw.*debug config|parsed internally.*redacted/i,
    /durable verification|current-session verification/i,
    /lastDurableSetupAt/,
    /runtime is implemented and shipped/i,
    /public curated model picker/i,
    /rollback/i,
    /run directly on Windows|native Windows/i,
    /Windows CI|native Windows CI|integration tests/i,
    /WSL/i,
    /inherited user-profile ACLs|does not attempt to rewrite Windows ACLs/i,
    /project scope writes only activation settings/i,
    /~\/\.gonkagate\/opencode\/backups\/project-config/,
  ]);

  assert.doesNotMatch(
    howItWorks,
    /native Windows writes[\s\S]*repair drifted secret file and directory modes/i,
  );

  assertMatchesAll(troubleshooting, [
    /--api-key-stdin/,
    /GONKAGATE_API_KEY/,
    /chat\/completions/,
    new RegExp(escapeRegExp(FUTURE_TRANSPORT)),
    /public model picker only show one option right now/i,
    /durable plain-`opencode` result/i,
    /lastDurableSetupAt/,
    /scope.*--yes/i,
    /enabled_providers|disabled_providers/,
    /locally\s+inspectable/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /provider options|model options|headers|compatibility metadata/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /raw `opencode debug config` output/i,
  ]);

  assertMatchesAll(prd, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.packageName)),
    new RegExp(escapeRegExp(GONKAGATE_BASE_URL)),
    new RegExp(escapeRegExp(CONTRACT_METADATA.verifiedOpencode.minVersion)),
    /small_model/,
    /GONKAGATE_API_KEY/,
    /--api-key-stdin/,
    /OPENCODE_CONFIG.*not a replacement/i,
    /OPENCODE_CONFIG_CONTENT/,
    /enabled_providers/,
    /disabled_providers/,
    /effective OpenCode config/i,
    /interactive mode keeps the public curated model picker visible/i,
    /durable plain-`opencode` outcome/i,
    /current-session blockers/i,
    /locally\s+inspectable/i,
    /user config[\s\S]*OPENCODE_CONFIG[\s\S]*project config[\s\S]*system managed/i,
    /without rewriting the secret contents|without rewriting unchanged secret/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /lastDurableSetupAt/,
    /providers login/i,
    /provider options|model options|model headers|compatibility metadata/i,
    /redact secret-bearing fields|printing raw.*stdout or stderr/i,
    /native Windows/i,
    /native Windows CI|integration proof/i,
    /WSL/i,
    /project scope/i,
    /chat_completions/,
    new RegExp(escapeRegExp(FUTURE_TRANSPORT)),
    /does not write directly to `auth\.json`/i,
    /does not depend on `gonkagate doctor`/i,
    /~\/\.gonkagate\/opencode\/backups\/project-config/,
  ]);

  assert.doesNotMatch(prd, /opencode auth login/i);
});

test("security docs capture the shipped secret-handling constraints", () => {
  const security = readText("docs/security.md");

  assertMatchesAll(security, [
    /GONKAGATE_API_KEY/,
    /--api-key-stdin/,
    /never accept `--api-key`/i,
    /owner-only permissions/i,
    /inherited ACLs|profile-directory ACL/i,
    /~\/\.gonkagate\/opencode\/api-key/,
    /OPENCODE_CONFIG.*not a replacement/i,
    /OPENCODE_CONFIG_CONTENT/,
    /resolved-config inspection output/i,
    /provider\.gonkagate\.options\.apiKey/i,
    /\{file:~\/\.gonkagate\/opencode\/api-key\}/i,
    /redact secret-bearing fields/i,
    /fallback entrypoint error handling/i,
    /durable verification for plain `opencode`/i,
    /locally\s+inspectable/i,
    /user config[\s\S]*OPENCODE_CONFIG[\s\S]*project config[\s\S]*system managed/i,
    /repair drifted modes|without rewriting unchanged secret/i,
    /inferred\s+higher-precedence|inferred[\s\S]*managed blocker/i,
    /lastDurableSetupAt/,
    /roll back changed managed files automatically/i,
    /native Windows/i,
    /native Windows CI|integration coverage/i,
    /WSL/i,
    /auth\.json/,
    /~\/\.gonkagate\/opencode\/backups\/project-config/,
  ]);
  assert.doesNotMatch(security, /not part of the v1 verified contract yet/i);
});

test("docs index separates current contract docs from historical planning docs", () => {
  const docsIndex = readText("docs/README.md");

  assertMatchesAll(docsIndex, [
    /Current Contract Documents/i,
    /Architecture Decisions/i,
    /Model Validation/i,
    /Historical Context/i,
    /Implementation Plan.*historical execution record/i,
    /historical documents must be labeled explicitly/i,
  ]);
});

test("architecture decisions capture the shipped verification and picker strategy", () => {
  const decisions = readText("docs/architecture-decisions.md");

  assertMatchesAll(decisions, [
    /public curated picker visible in interactive mode/i,
    /--yes.*safe non-interactive flows may auto-select/i,
    /Separate durable verification from current-session verification/i,
    /identical inline\s+override/i,
    /inline[\s\S]*provider\.gonkagate\.options\.apiKey[\s\S]*block/i,
    /Centralize user-facing error redaction/i,
    /opencode debug config --pure/i,
    /auth\.json/i,
  ]);
});

test("model validation doc matches the shipped small_model and picker contract", () => {
  const modelValidation = readText("docs/model-validation.md");

  assertMatchesAll(modelValidation, [
    /qwen3-235b-a22b-instruct-2507-fp8/,
    /@ai-sdk\/openai-compatible/,
    /writes both `model` and `small_model`/i,
    /public curated picker visible/i,
  ]);

  assert.doesNotMatch(modelValidation, /once write behavior exists/i);
});

test("implementation plan is explicitly marked historical", () => {
  const implementationPlan = readText("docs/implementation-plan.md");

  assertMatchesAll(implementationPlan, [
    /^# Historical Implementation Plan/m,
    /historical context, not the current product contract/i,
    /scaffold-era wording below is preserved as an execution record/i,
  ]);
});
