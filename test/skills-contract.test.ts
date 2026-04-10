import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMatchesAll,
  assertMirroredSkillDirectory,
  readText,
} from "./contract-helpers.js";

const mirroredSkillDirectories = [
  "opencode-compatibility-audit",
  "code-simplification",
  "coding-prompt-normalizer",
  "node-security-review",
  "planning-and-task-breakdown",
  "spec-first-brainstorming",
  "technical-design-review",
  "typescript-coder",
  "typescript-coder-plan-spec",
  "typescript-error-modeling-and-boundaries",
  "typescript-node-esm-compiler-runtime",
  "typescript-public-api-design",
  "typescript-refactoring-and-simplification-patterns",
  "typescript-runtime-boundary-modeling",
  "typescript-systematic-debugging",
  "typescript-type-safety-review",
  "verification-before-completion",
] as const;

test("mirrored skill assets stay aligned across .agents and .claude", () => {
  for (const skillDirectory of mirroredSkillDirectories) {
    assertMirroredSkillDirectory(skillDirectory);
  }
});

test("AGENTS documents the mirrored skill pack", () => {
  const agents = readText("AGENTS.md");

  assertMatchesAll(agents, [
    /\.agents\/skills\//,
    /\.claude\/skills\//,
    /mirrored skill pack/i,
  ]);
});

test("the imported skill pack includes the expected high-value entries", () => {
  const opencodeCompatibilityAudit = readText(
    ".agents/skills/opencode-compatibility-audit/SKILL.md",
  );
  const opencodeCompatibilityAuditTemplate = readText(
    ".agents/skills/opencode-compatibility-audit/references/report-template.md",
  );
  const codingPromptNormalizer = readText(
    ".agents/skills/coding-prompt-normalizer/SKILL.md",
  );
  const codeSimplification = readText(
    ".agents/skills/code-simplification/SKILL.md",
  );
  const codingPromptRepoRouting = readText(
    ".agents/skills/coding-prompt-normalizer/references/repo-context-routing.md",
  );
  const codingPromptInputNormalization = readText(
    ".agents/skills/coding-prompt-normalizer/references/input-normalization.md",
  );
  const codingPromptEvals = readText(
    ".agents/skills/coding-prompt-normalizer/evals/evals.json",
  );
  const specFirstBrainstorming = readText(
    ".agents/skills/spec-first-brainstorming/SKILL.md",
  );
  const planningAndTaskBreakdown = readText(
    ".agents/skills/planning-and-task-breakdown/SKILL.md",
  );
  const verificationSkill = readText(
    ".agents/skills/verification-before-completion/SKILL.md",
  );

  assert.match(codeSimplification, /Code Simplification/);
  assert.match(codeSimplification, /AGENTS\.md/);
  assert.match(codeSimplification, /npm run ci/);
  assert.match(
    codeSimplification,
    /typescript-refactoring-and-simplification-patterns/,
  );
  assert.match(
    codeSimplification,
    /installer runtime is not yet\s+implemented/,
  );
  assert.match(codingPromptNormalizer, /coding-prompt-normalizer/);
  assert.match(codingPromptNormalizer, /opencode-setup/);
  assert.match(codingPromptNormalizer, /npx @gonkagate\/opencode-setup/);
  assert.match(codingPromptNormalizer, /~\/\.config\/opencode\/opencode\.json/);
  assert.match(codingPromptNormalizer, /GONKAGATE_API_KEY/);
  assert.match(codingPromptNormalizer, /--api-key-stdin/);
  assert.match(codingPromptNormalizer, /provider\.gonkagate/);
  assert.match(codingPromptNormalizer, /chat_completions/);
  assert.match(codingPromptNormalizer, /scaffold/i);
  assert.doesNotMatch(codingPromptNormalizer, /codex-setup/);
  assert.doesNotMatch(codingPromptNormalizer, /\.codex\/config\.toml/);

  assert.match(codingPromptRepoRouting, /opencode-setup/);
  assert.match(codingPromptRepoRouting, /src\/cli\.ts/);
  assert.match(
    codingPromptRepoRouting,
    /docs\/specs\/opencode-setup-prd\/spec\.md/,
  );
  assert.match(codingPromptRepoRouting, /provider\.gonkagate/);
  assert.doesNotMatch(codingPromptRepoRouting, /bin\/gonkagate-codex\.js/);
  assert.doesNotMatch(codingPromptRepoRouting, /\.codex\/config\.toml/);

  assert.match(
    codingPromptInputNormalization,
    /~\/\.config\/opencode\/opencode\.json/,
  );
  assert.match(codingPromptInputNormalization, /GONKAGATE_API_KEY/);
  assert.match(codingPromptInputNormalization, /--api-key-stdin/);
  assert.match(codingPromptInputNormalization, /provider\.gonkagate/);
  assert.doesNotMatch(codingPromptInputNormalization, /wire_api/);
  assert.doesNotMatch(codingPromptInputNormalization, /\.codex\/config\.toml/);

  assert.match(codingPromptEvals, /opencode-setup/);
  assert.match(codingPromptEvals, /~\/\.config\/opencode\/opencode\.json/);
  assert.match(codingPromptEvals, /chat_completions/);
  assert.doesNotMatch(codingPromptEvals, /npx @gonkagate\/codex-setup/);
  assert.doesNotMatch(codingPromptEvals, /\.codex\/config\.toml/);

  assert.match(specFirstBrainstorming, /Spec-First Brainstorming/);
  assert.match(planningAndTaskBreakdown, /Planning and Task Breakdown/);
  assert.match(
    planningAndTaskBreakdown,
    /docs\/specs\/opencode-setup-prd\/spec\.md/,
  );
  assert.match(planningAndTaskBreakdown, /AGENTS\.md/);
  assert.match(planningAndTaskBreakdown, /npm run ci/);
  assert.match(planningAndTaskBreakdown, /typescript-coder-plan-spec/);
  assert.match(verificationSkill, /verification-before-completion/i);
  assert.match(opencodeCompatibilityAudit, /opencode-compatibility-audit/);
  assert.match(opencodeCompatibilityAudit, /opencode-ai/);
  assert.match(opencodeCompatibilityAudit, /opencode\.ai\/docs\/config/);
  assert.match(
    opencodeCompatibilityAudit,
    /~\/\.config\/opencode\/opencode\.json/,
  );
  assert.match(opencodeCompatibilityAudit, /provider\.gonkagate/);
  assert.match(opencodeCompatibilityAudit, /small_model/);
  assert.match(opencodeCompatibilityAudit, /@ai-sdk\/openai-compatible/);
  assert.match(opencodeCompatibilityAudit, /@ai-sdk\/openai/);
  assert.match(opencodeCompatibilityAudit, /providers login/);
  assert.doesNotMatch(opencodeCompatibilityAudit, /@openai\/codex/);
  assert.doesNotMatch(opencodeCompatibilityAudit, /opencode auth login/);
  assert.doesNotMatch(opencodeCompatibilityAudit, /\.codex\/config\.toml/);
  assert.doesNotMatch(opencodeCompatibilityAudit, /wire_api/);
  assert.match(
    opencodeCompatibilityAuditTemplate,
    /Stable `opencode-ai` version audited/,
  );
});
