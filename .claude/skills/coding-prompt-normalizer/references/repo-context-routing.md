# Repo Context Routing

Use this file to choose only the repository context that materially changes the
generated context handoff prompt.

Do not dump the whole repo summary into the output. Pull only the relevant
points.

## Always-True Defaults

- The downstream agent already works inside this repository.
- Do not explain how to inspect files, edit code, create folders, or run
  ordinary repo commands.
- `opencode-setup` is an implemented TypeScript/Node installer for configuring
  local OpenCode to use GonkaGate.
- Canonical surfaces today are `src/cli.ts`, `src/install/`, `src/constants/`,
  `README.md`, `AGENTS.md`, `docs/`, `test/package-contract.test.ts`,
  `test/docs-contract.test.ts`, `test/skills-contract.test.ts`,
  `scripts/run-tests.mjs`, `.github/workflows/`, `package.json`,
  `release-please-config.json`, `.claude/skills/`, and `.agents/skills/`.
- `README.md`, `AGENTS.md`, and the files under `docs/` are the main current
  contract surfaces for product and security behavior.
- Avoid generic tool instructions like "inspect the repo" unless the request
  explicitly needs them.

## Use Repo Constraints Selectively

Include a repository constraint only when it changes the task:

- the target public UX is `npx @gonkagate/opencode-setup`, and the current CLI
  implements the end-to-end public installer flow
- user-level config target is `~/.config/opencode/opencode.json`
- project activation target is `opencode.json`
- the managed provider key is `provider.gonkagate`
- project scope should write only activation settings
- safe secret inputs are hidden prompt, `GONKAGATE_API_KEY`, or
  `--api-key-stdin`
- plain `--api-key` is intentionally unsupported
- secrets should stay under `~/.gonkagate/opencode/...`, not inside the
  repository
- the installer should not write directly to `auth.json`
- current transport target is `chat/completions`
- future migration path is reserved for `responses`
- the product should not depend on `gonkagate doctor`
- if public behavior changes, `README.md`, `AGENTS.md`, `docs/`, and
  `CHANGELOG.md` may need updates to stay truthful

## Routing By Task Signal

### CLI, Package, Release, Public UX

Use when the request mentions CLI flags, help output, package entrypoints,
release automation, publish flow, or user-facing onboarding.

Useful context:

- `src/cli.ts`
- `bin/gonkagate-opencode.js`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`
- `README.md`
- `CHANGELOG.md`

### Provider Architecture, Config Scope, Auth, Transport

Use when the request mentions custom providers,
`~/.config/opencode/opencode.json`, `opencode.json`, `provider.gonkagate`,
`small_model`, `GONKAGATE_API_KEY`, `--api-key-stdin`, `auth.json`,
`chat_completions`, `responses`, or secret-handling boundaries.

Useful context:

- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `docs/specs/opencode-setup-prd/spec.md`
- `test/docs-contract.test.ts`

Relevant reminders:

- the runtime exists under `src/install/`
- config and provider rules live in docs, tests, constants, and runtime modules
- prompts should inspect existing runtime modules before proposing new seams

### Docs, Product Messaging, Truthfulness

Use when the task is mainly about repository documentation, public flow
description, security wording, troubleshooting, changelog accuracy, or PRD
alignment.

Useful context:

- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `docs/specs/opencode-setup-prd/spec.md`
- `CHANGELOG.md`
- `src/cli.ts`

Relevant reminders:

- docs should distinguish shipped installer behavior from future product intent
- product-surface changes are not just copy edits; they may imply architecture
  or implementation work

### Tests, Tooling, Contract Integrity

Use when the request mentions test coverage, repository contract checks, CI,
formatting, or package quality.

Useful context:

- `test/package-contract.test.ts`
- `test/docs-contract.test.ts`
- `test/skills-contract.test.ts`
- `scripts/run-tests.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `.nvmrc`

Relevant reminders:

- repository tests protect shipped runtime and doc-contract expectations
- `npm run ci` is the primary local verification command

### Skills, Prompts, Agent Workflow

Use when the request is about local skills, prompt rewriting, agent
instructions, or repo-local workflow assets.

Useful context:

- `.claude/skills/`
- `.agents/skills/`
- the specific local skill folder touched by the request
- `test/skills-contract.test.ts` when the repo should enforce the new
  expectation

Relevant reminders:

- many skill assets are mirrored under both `.claude` and `.agents`
- prompt assets should stay aligned with the actual current repo state
- if a skill is repo-specific, examples and literals should point to OpenCode
  and current repo surfaces rather than stale Codex paths

## Output Discipline

When you include repo context in the final handoff prompt:

- prefer short bullets or short paragraphs
- name the most relevant docs or code areas first
- keep background only if it changes the downstream agent's first decisions
- avoid repeating repo facts unless they change the downstream agent's first
  decisions
