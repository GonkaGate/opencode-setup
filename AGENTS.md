# AGENTS.md

## What This Repository Is

`opencode-setup` is the public open-source onboarding repository for the
GonkaGate CLI that configures local `opencode` to use GonkaGate as a
custom provider without requiring users to hand-edit `opencode.json`, export
secrets through shell profiles, or understand OpenCode provider internals.

Recommended public flow:

```bash
npx @gonkagate/opencode-setup
```

Current honest state:

- the real end-to-end public installer flow is implemented
- the public CLI validates local `opencode`, resolves a curated model and
  scope, collects a GonkaGate API key through the supported safe inputs before
  managed writes, verifies both the durable and current-session effective
  OpenCode config, and ends with plain `opencode`
- the product docs, CI, package contract, and PRD are implemented and now
  describe the shipped runtime
- the public curated model picker is shipped and currently exposes one
  validated model
- native Windows support is part of the current contract and is backed by
  native Windows CI and integration proof, not only simulated `win32` tests
- the minimum verified OpenCode version remains `1.4.0`, and the latest
  audited stable upstream OpenCode release is `opencode-ai` `1.4.1` as of
  April 9, 2026

If the implementation status, package name, security flow, config locations,
transport contract, or verified OpenCode baseline changes, this file must be
updated immediately so it stays truthful.

## Product Goal

The intended happy path is:

1. user runs `npx @gonkagate/opencode-setup`
2. installer validates local `opencode`
3. installer offers the public curated model picker in interactive mode and
   accepts recommended defaults through `--yes` or safe non-interactive
   selection rules
4. installer asks for `user` or `project` scope
5. installer collects a GonkaGate `gp-...` key through a hidden prompt,
   `GONKAGATE_API_KEY`, or `--api-key-stdin`
6. installer writes the minimum safe OpenCode config layers
7. installer verifies the durable OpenCode config and the current session's
   effective OpenCode config
8. user returns to plain `opencode`

For `project` scope, the user-level config owns the provider definition and
secret binding, while the repository-local `opencode.json` contains only
activation settings.

## Fixed Product Invariants

These decisions are part of the repo contract. Changing them is not a small
refactor; it is a product change.

- the npm package is `@gonkagate/opencode-setup`
- the intended public npm entrypoint is `npx @gonkagate/opencode-setup`
- the stable provider id is `gonkagate`
- the canonical base URL is `https://api.gonkagate.com/v1`
- the current transport target is `chat/completions`
- future `/v1/responses` support should be added by migration, not by product
  rename
- durable global config target is `~/.config/opencode/opencode.json`
- `OPENCODE_CONFIG` is an additional higher-precedence override layer, not a
  replacement for the global config target
- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override layer,
  not a durable install target
- interactive mode keeps the public curated model picker visible even when only
  one validated model is currently available
- `--yes` and safe non-interactive flows may accept the recommended validated
  model without showing the picker
- project config target is `opencode.json`
- the managed user-level provider key is `provider.gonkagate`
- `project` scope writes only activation settings
- repo-local `opencode.json` rewrites must keep rollback backups under
  `~/.gonkagate/opencode/backups/project-config` instead of beside the
  repository file
- provider definition and secret binding live in user scope
- the canonical installer-owned secret binding is exactly
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`
- durable secret-binding provenance must be verified separately from resolved-
  config verification, and `user_config` is the only durable layer allowed to
  own that binding
- scope normalization must remove only installer-owned GonkaGate activation
  from the old target; unrelated top-level `model` / `small_model` values must
  be preserved and surfaced by verification if they still block the intended
  scope
- installer success must be based on effective OpenCode config, not only file
  writes
- durable effective-config verification must keep `opencode debug config
--pure` as the final truth source instead of reimplementing the full
  upstream merge engine
- resolved effective-config verification must stay responsible for `model`,
  `small_model`, `provider.gonkagate`, validated transport and base URL shape,
  curated model-entry shape, and provider allow/deny gating
- secret-binding provenance verification must separately enforce
  `provider.gonkagate.options.apiKey` ownership instead of inferring it from
  redacted resolved-config output
- effective-config verification must separately prove the durable plain-
  `opencode` outcome and the current session's runtime-resolved outcome
- `install-state.json` must remain the durable migration anchor, and
  `lastDurableSetupAt` must mean "last durably verified setup" rather than
  "full success including later current-session verification"
- effective-config verification must account for provider allow/deny lists
  such as `enabled_providers` and `disabled_providers` when they disable
  `gonkagate`
- exact durable blocker attribution is guaranteed only for locally inspectable
  `OPENCODE_CONFIG`, user config, project config, and file-based system managed
  config layers
- within those inspectable layers, durable blocker attribution must follow
  current OpenCode precedence: user config, then `OPENCODE_CONFIG`, then
  project config, then file-based system managed config
- if the resolved config proves provider gating but no locally inspectable
  layer explains it, the installer must report an inferred higher-precedence
  or managed blocker instead of a generic mismatch
- `OPENCODE_CONFIG_CONTENT` must not be treated as a durable install target;
  identical inline overrides may still pass for non-secret resolved keys, but
  any inline `provider.gonkagate.options.apiKey` override must block the
  current-session check in v1
- effective-config verification must not print raw resolved config containing
  substituted secrets
- v1 supports macOS, Linux, native Windows, and WSL-based OpenCode usage on
  Windows
- WSL remains the upstream-recommended Windows path for the best experience,
  but native Windows is a supported runtime path
- the installer must not write directly to `auth.json`
- no plain CLI flag may carry the secret
- secrets must not be accepted through a plain CLI flag such as `--api-key`
- safe secret inputs are:
  - hidden interactive prompt
  - `GONKAGATE_API_KEY`
  - `--api-key-stdin`
- shell profile mutation is out of scope
- `.env` file generation is out of scope
- arbitrary custom base URLs are out of scope for v1
- arbitrary custom model ids are out of scope for v1
- the installer must not depend on `gonkagate doctor`
- `small_model` is explicitly set by the runtime
- the curated model registry contract must be able to carry compatibility
  metadata required for validated OpenCode flows, not only model ids

## Security Invariants

- never print the GonkaGate `gp-...` key
- never accept secrets through plain `--api-key`
- never store the secret in repository-local files
- keep the secret under `~/.gonkagate/opencode/...`; enforce owner-only
  permissions where the platform supports POSIX modes, and on native Windows
  keep managed user files inside the current user's profile so they inherit
  per-user ACLs
- keep the canonical GonkaGate secret binding only in user config; `project`
  config, `OPENCODE_CONFIG`, file-based system managed config, and
  `OPENCODE_CONFIG_CONTENT` must not define
  `provider.gonkagate.options.apiKey`
- on POSIX-supported platforms, reruns must repair drifted managed-secret file
  and directory permissions in place when the secret contents already match,
  without rewriting the secret or creating a backup
- never print raw resolved-config output from `opencode debug config`
- redact secret-bearing fields from diagnostics or logs
- redact secret-bearing text on every user-facing CLI error path, including
  fallback entrypoint error handling
- preserve unrelated OpenCode config when editing user config
- create backups before replacing managed user files; when rewriting repo-local
  `opencode.json`, keep the rollback backup under
  `~/.gonkagate/opencode/backups/project-config` instead of beside the
  repository file
- project config must stay commit-safe by default
- repo-local activation config must not contain the secret path
- higher-precedence custom or managed config must be checked before reporting
  setup success

## Current Repository Truth

These are implementation facts today, not future plans:

- `src/cli.ts` is the shipped public runtime entrypoint and renders both
  human-readable and machine-readable installer results
- `bin/gonkagate-opencode.js` is a thin wrapper over `dist/cli.js`
- `src/install/` now contains the shipped runtime foundations and orchestration
  for dependency injection, OpenCode detection, path resolution, platform
  classification, safe secret intake, managed secret/install-state
  persistence, managed config parse/merge/write, rerun-safe rollback,
  locally inspectable higher-precedence layer attribution, inferred fallback
  blocker reporting, installer-owned scope normalization, separate resolved-
  config versus secret-binding provenance verification, redacted effective-
  config diagnostics, and the end-to-end installer flow
- the curated model registry under `src/constants/models.ts` now includes one
  pinned public validated entry for
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`, and the public picker is designed
  to grow as more validated models land
- a mirrored skill pack is present under `.agents/skills/` and
  `.claude/skills/`, imported from `codex-setup` as an initial shared
  engineering baseline
- `docs/specs/opencode-setup-prd/spec.md` is the final product contract
- `test/package-contract.test.ts`, `test/docs-contract.test.ts`, and
  `test/cli.test.ts` protect the shipped runtime contract
- `.github/workflows/ci.yml` now exercises Ubuntu and native Windows runners so
  the native Windows support claim has runner-backed proof
- `test/skills-contract.test.ts` protects mirrored skill integrity

## What The Repo Does And Does Not Do

This repo currently does:

- define the product contract for the OpenCode setup tool
- define security, scope, and transport constraints
- provide npm packaging, CI, release-please, and publish scaffolding
- provide a working public CLI entrypoint with a curated public model picker
- provide end-to-end managed config writes, scope-aware ownership, rerun-safe
  rollback, and redacted effective-config verification under `src/install/`
- provide docs and tests that protect the current contract

This repo currently does not do:

- expose arbitrary custom model ids or arbitrary base URL overrides
- claim `/v1/responses` support today
- verify live GonkaGate sessions

## Repository Structure

```text
.
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.build.json
├── .github/workflows/
├── bin/
│   └── gonkagate-opencode.js
├── docs/
│   ├── README.md
│   ├── model-validation.md
│   ├── how-it-works.md
│   ├── security.md
│   ├── troubleshooting.md
│   ├── specs/
│   │   └── opencode-setup-prd/spec.md
├── scripts/
│   └── run-tests.mjs
├── .agents/skills/
├── .claude/skills/
├── src/
│   ├── cli.ts
│   ├── constants/
│   └── install/
└── test/
    ├── cli.test.ts
    ├── docs-contract.test.ts
    ├── install/
    ├── package-contract.test.ts
    └── contract-helpers.ts
```

## Important Surfaces

### `README.md`

Primary public repository summary. Keep implementation status, package name,
intended `npx` entrypoint, config targets, and security posture truthful.

### `docs/specs/opencode-setup-prd/spec.md`

The product source of truth for the setup tool.

### `docs/how-it-works.md`

Repository-level architecture contract for setup flow, scope behavior, and
future migration path.

### `docs/security.md`

Security and secret-handling contract. Any change to auth flow, secret storage,
or non-interactive setup must be reflected there.

### `src/cli.ts`

Current public runtime entrypoint.

### `src/install/`

Shipped installer runtime including dependency injection, OpenCode detection,
path resolution, platform classification, safe secret intake, managed
secret/install-state persistence, managed config parse/merge/write seams for
user/project ownership, rerun-safe rollback, and read-only effective-config
verification.

### `.agents/skills/` and `.claude/skills/`

Mirrored skill pack imported from `codex-setup` to give the repository a
useful engineering baseline from day one. Mirror updates across both trees when
the shared skill pack changes.

## Change Discipline

When behavior changes:

- update `AGENTS.md`
- update `README.md`
- update relevant files in `docs/`
- update `CHANGELOG.md` when the change is meaningful to users or contributors
- update tests under `test/` if the repository contract changed
- keep mirrored `.agents` and `.claude` skill assets aligned
- keep current-contract docs and historical planning docs explicitly labeled so
  they cannot contradict each other silently

The installer is now real:

- remove or revise any wording that drifts back toward scaffold-only language
- update the curated model registry truth when the public picker changes
- add runtime behavior tests before claiming any new end-user capability

## Validation

Current local validation baseline:

```bash
npm run ci
```

That command should stay green before treating scaffold, contract, or doc
changes as ready.

@RTK.md

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
