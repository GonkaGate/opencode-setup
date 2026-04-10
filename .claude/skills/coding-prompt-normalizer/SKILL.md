---
name: coding-prompt-normalizer
description: "Turn rough, mixed-language, speech-to-text-like, or partially specified coding requests into strong prompts for agents working inside opencode-setup. Use when the user asks to rewrite, normalize, package, or clarify a task for Codex, Claude, or another coding agent in this repository, even if the input is messy, repetitive, nonlinear, or only partly grounded; the job is intent reconstruction plus repo-aware prompt composition, not literal translation."
---

# Coding Prompt Normalizer

## Purpose

Turn noisy user task descriptions into clean prompts that help a coding agent
start in the right place in `opencode-setup`.

Reconstruct intent, strip filler, preserve exact technical literals, choose the
right task mode, and inject only the repository context that materially changes
execution.

Be honest about the current state of the repository:

- this repo is currently a scaffold, not a shipped OpenCode installer runtime
- `README.md`, `AGENTS.md`, `docs/`, `src/cli.ts`, and the PRD are the main
  product-contract surfaces today
- the public `npx @gonkagate/opencode-setup` flow is defined but not yet
  implemented end to end
- `src/install/` is reserved future runtime space and should not be described
  as already implemented
- the current verified OpenCode baseline is `opencode-ai` `1.4.0`

Do not normalize a prompt into a fake implementation brief for runtime files or
behaviors that do not exist unless the user is explicitly asking to create
them.

## Use This Skill For

- rough notes, pasted chat fragments, or dictated transcripts
- mixed-language coding requests
- requests like "turn this into a normal prompt", "package this for an agent",
  or "rewrite this for Codex"
- repetitive, nonlinear, partially explained tasks where the downstream agent
  still needs a strong starting prompt

## Do Not Use It For

- generic translation with no repository work
- writing the code, spec, or review itself; this skill prepares the prompt
- inventing files, behaviors, or product decisions that the repo does not
  support

## Relationship To Neighbor Skills

- Use this skill first when the main problem is poor task phrasing.
- After the prompt is reconstructed, downstream work may use repo skills such
  as `typescript-coder`, `technical-design-review`,
  `verification-before-completion`, or `spec-first-brainstorming`.
- Do not turn this skill into a replacement for those domain skills. Its job is
  to create a better starting prompt, not to own the whole workflow.

## Workflow

1. Normalize the raw input.
   - Load `references/input-normalization.md`.
   - Remove filler, loops, false starts, and duplicated fragments.
   - Keep code-like literals verbatim.
2. Infer the task mode.
   - Choose one primary mode:
     `implementation`, `bug-investigation`, `review-read-only`, `refactor`,
     `planning-spec`, `architecture-analysis`, `docs-and-messaging`, or
     `tooling-prompting`.
   - If two modes are present, choose the one that changes the downstream
     agent's first action.
3. Decide whether the request is ready for direct execution.
   - Use a direct coding prompt only when the requested change, likely target
     surface, and success criteria are sufficiently inferable, and the work
     looks like a bounded local change.
   - Default to `bug-investigation` when symptoms are clear but the fix is not.
   - Default to `planning-spec` or `architecture-analysis` when the request is
     too ambiguous for safe coding.
   - Default to `planning-spec` for non-trivial or hard-to-reverse work such as
     provider-wiring changes, auth strategy changes, secret-handling changes,
     user-vs-project scope behavior, transport migration, or broad
     repository-wide refactors.
   - Review requests stay read-only.
4. Select repository context.
   - Load `references/repo-context-routing.md`.
   - Include only the repo facts, docs, constraints, and code areas that
     materially affect this task.
   - Prefer `2-5` targeted points over a project summary.
5. Compose the prompt.
   - Do not mention the source language unless the user explicitly asks.
   - Default the output prompt to English because the repo docs, code, and
     agent instructions are English-first.
   - If the user explicitly requests another output language, honor that.
   - Write for an agent that already has repo access and knows how to inspect
     files, edit code, and navigate the workspace.
   - Keep the prompt dense and action-oriented.
6. Run a final quality gate.
   - No hallucinated files, requirements, or product decisions.
   - No generic stack dump.
   - Exact literals preserved.
   - Assumptions and open questions explicit where certainty is weak.

## Literal Preservation Rules

- Preserve exact file paths, CLI commands, env vars, code identifiers, config
  keys, model ids, field names, and domain terms verbatim.
- Wrap preserved literals in backticks inside the final prompt.
- Do not "improve" or rename tokens like
  `~/.config/opencode/opencode.json`, `opencode.json`,
  `npx @gonkagate/opencode-setup`, `provider.gonkagate`,
  `GONKAGATE_API_KEY`, `--api-key-stdin`, `small_model`,
  `@ai-sdk/openai-compatible`, `@ai-sdk/openai`, `auth.json`,
  `chat_completions`, `responses`, `src/cli.ts`,
  `docs/specs/opencode-setup-prd/spec.md`, or
  `docs/plans/opencode-setup-implementation-plan.md`.
- If transcript noise makes a literal uncertain, keep that uncertainty explicit.
  Use a phrase like `Possible original literal:` rather than silently
  normalizing it.
- Preserve user constraints exactly when they change execution:
  `read-only`, `do not edit files`, `no refactor`, `investigate first`,
  `do not touch docs`, `do not add gonkagate doctor`, `keep .claude and .agents in sync`,
  `do not pretend the runtime already exists`, `keep project scope secret-free`.

## Readiness Rules

Emit an `implementation` or `refactor` prompt only when all are true:

- the requested change is understandable
- the likely code area is narrow enough to inspect first
- ambiguity does not materially change the execution path
- the work does not appear to change fixed product invariants, provider auth
  strategy, secret-storage rules, scope behavior, or other hard-to-reverse
  behavior
- the target surface already exists, or the user is explicitly asking to create
  that new surface

Emit a `bug-investigation` prompt when any are true:

- the text is symptom-first or regression-first
- the root cause is unclear
- multiple ownership seams could explain the behavior
- the task may involve mismatch between docs, runtime plans, and repository
  contract tests

Emit a `review-read-only` prompt when the user asks to inspect, review, audit,
or explicitly avoid edits.

Emit a `planning-spec` or `architecture-analysis` prompt when:

- the task is exploratory or cross-cutting
- requirements are incomplete
- the user asks for a plan, spec, or design direction
- the request touches provider configuration, custom auth, secret storage,
  project scope behavior, transport migration, or other product-contract
  decisions
- the repo does not yet contain the implementation surface the request assumes
- resolving ambiguity is more important than coding immediately

Emit a `docs-and-messaging` prompt when the task is mainly about `README.md`,
`AGENTS.md`, `docs/`, `CHANGELOG.md`, or keeping the scaffold truthfully
described.

Emit a `tooling-prompting` prompt when the task is about local skills, prompt
rewriting, agent instructions, mirrored `.claude` and `.agents` assets, or
repo-local workflow surfaces.

When ambiguity remains high, keep `Assumptions` and `Open questions` short but
explicit. Do not hide uncertainty behind polished wording.

## Output Template

Adapt the sections to the mode. Default order:

- `Objective`
- `Relevant repository context`
- `Likely relevant code areas / files`
- `Problem statement` or `Requested change`
- `Constraints / preferences / non-goals`
- `Acceptance criteria` or `Expected outcome`
- `Validation / verification`
- `Assumptions / open questions`

Mode-specific adjustments:

- `review-read-only`
  - say the task is read-only
  - ask for findings first
  - replace implementation acceptance criteria with review deliverable
    expectations
- `bug-investigation`
  - ask the agent to confirm the symptom path and identify root cause before
    coding
  - describe the expected evidence, likely seams, and what should be verified
- `planning-spec` and `architecture-analysis`
  - emphasize boundaries, risks, missing information, and candidate decisions
    rather than edits
- `docs-and-messaging`
  - emphasize user-visible truthfulness and keeping `README.md`, `AGENTS.md`,
    `docs/`, and `CHANGELOG.md` aligned when behavior changes
- `tooling-prompting`
  - keep repo context focused on local skills, prompts, mirrored workflow
    assets, and agent-facing support material

Keep the prompt compact. Do not force all sections when `1-2` focused
paragraphs do the job better.

## Prompt Composition Rules

- Start with the real objective, not with "rewrite this prompt".
- Prefer concrete repo surfaces when they are grounded by the input or the
  repository.
- Turn vague references like "here", "this config", or "that flow" into
  hypotheses only when the repo strongly supports one interpretation.
- Separate grounded repo facts from assumptions.
- Mention the first files or docs to inspect when that is reasonably inferable.
- Keep validation realistic: focused tests, `npm run ci`, targeted doc sync
  checks, or specific workflow checks. Do not default to broad repo-wide
  validation unless the change is broad.
- Do not repeat repo-wide instructions unless they materially affect this task.
- Use the existing `src/` surface when it is materially relevant, but do not
  invent a finished runtime under `src/install/` while the repo is still
  scaffold-only.
- When the task touches a mirrored local skill, prefer keeping the `.claude`
  and `.agents` copies aligned unless the request says otherwise.
- Do not propose product changes like `.env` writing, shell profile edits,
  plain `--api-key`, or direct `auth.json` mutation unless the user explicitly
  asks for a product-contract change and the prompt frames it as such.

## Examples

### Example 1: Implementation Prompt

Input:

```text
Turn this into a clean prompt for an agent. Tighten
`.claude/skills/coding-prompt-normalizer/SKILL.md` and
`test/skills-contract.test.ts` so the skill is OpenCode-specific, preserves
`~/.config/opencode/opencode.json`, and removes stale Codex wording. Keep the
change small and keep `.agents` in sync.
```

Output:

```text
Objective
Make the smallest change needed to adapt the local `coding-prompt-normalizer`
skill to `opencode-setup`, preserving `~/.config/opencode/opencode.json` as an
exact literal, removing stale Codex-specific wording, and keeping the mirrored
`.agents` copy aligned.

Relevant repository context
- This repository is currently scaffold-only; docs, tests, and `src/cli.ts`
  are the main contract surfaces today.
- Local agent-support assets are mirrored under `.claude/skills/` and
  `.agents/skills/`; changes to one copy should normally be reflected in the
  other.
- Repository-contract checks live under `test/package-contract.test.ts`,
  `test/docs-contract.test.ts`, and `test/skills-contract.test.ts`.

Likely relevant code areas / files
- `.claude/skills/coding-prompt-normalizer/SKILL.md`
- `.claude/skills/coding-prompt-normalizer/references/`
- `.claude/skills/coding-prompt-normalizer/evals/evals.json`
- `.agents/skills/coding-prompt-normalizer/`
- `test/skills-contract.test.ts`

Requested change
Inspect the current skill content, replace Codex-specific repo assumptions with
OpenCode-specific ones, update any stale literals or examples, and add the
smallest verification needed so the skill does not regress back to the old
project wording.

Validation / verification
- Run the relevant repository-contract test slice or `npm run ci`.
- Confirm the updated skill preserves exact literals such as
  `~/.config/opencode/opencode.json`.
- Confirm the `.claude` and `.agents` copies remain aligned.
```

### Example 2: Review Prompt

Input:

```text
Package this as a review prompt. Read-only. I think `README.md` and
`docs/how-it-works.md` may overstate what the current placeholder CLI actually
does around `npx @gonkagate/opencode-setup` and `chat_completions`. Need
findings first, severity ordered, with file anchors. Focus on truthfulness and
product contract.
```

Output:

```text
Objective
Perform a read-only truthfulness review of the current public product docs,
with findings first and ordered by severity.

Relevant repository context
- This repository is still scaffold-only, so docs should distinguish current
  placeholder behavior from future installer plans.
- `README.md` and `docs/how-it-works.md` are the main contract surfaces for
  the `npx @gonkagate/opencode-setup` flow.
- `chat_completions` is part of the current planned provider contract and
  should be described accurately alongside the not-yet-implemented runtime.

Likely relevant code areas / files
- `README.md`
- `docs/how-it-works.md`
- `src/cli.ts`
- `docs/specs/opencode-setup-prd/spec.md`
- `test/docs-contract.test.ts`

Review deliverable
Review the current repository in read-only mode. Report findings first,
ordered by severity, with file anchors. Focus on truthfulness, product
contract mismatches, and places where docs or placeholder behavior may mislead
users about what is currently implemented.
```
