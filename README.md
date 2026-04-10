# @gonkagate/opencode-setup

Onboarding CLI for configuring local `opencode` to use GonkaGate as a custom
provider without manual edits to `opencode.json`, shell profile exports, or
direct interaction with OpenCode auth internals.

## Current State

This repository now ships the real installer runtime.

- the public npm entrypoint is:

```bash
npx @gonkagate/opencode-setup
```

- the CLI validates local `opencode`, resolves a curated model and scope,
  collects a GonkaGate API key through a hidden prompt,
  `GONKAGATE_API_KEY`, or `--api-key-stdin` before managed writes, verifies
  both the durable and current-session effective OpenCode config, and ends with
  plain `opencode`
- the public curated model picker is now shipped and currently exposes one
  validated model:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- rerunning the installer is the official safe update path and will refresh
  GonkaGate-managed config, secret storage, and install-state metadata,
  including the durable migration timestamp used for future reruns; on POSIX
  platforms reruns also repair drifted owner-only secret protections without
  rewriting unchanged secret contents
- native Windows is now a supported runtime path alongside macOS, Linux, and
  WSL-based OpenCode usage on Windows, backed by native Windows CI and
  integration coverage

## Product Goal

The intended happy path is:

1. user runs `npx @gonkagate/opencode-setup`
2. installer validates local `opencode`
3. installer shows the public curated model picker in interactive mode and
   accepts recommended defaults through `--yes` or safe non-interactive
   selection rules
4. installer activates GonkaGate in `user` or `project` scope
5. installer accepts a GonkaGate API key through a hidden prompt,
   `GONKAGATE_API_KEY`, or `--api-key-stdin`
6. installer verifies the durable OpenCode config and the current session's
   effective OpenCode config
7. user goes back to plain `opencode`

## Fixed Product Decisions

- package name: `@gonkagate/opencode-setup`
- stable provider id: `gonkagate`
- canonical base URL: `https://api.gonkagate.com/v1`
- current transport target: `chat/completions`
- future migration path reserved for `responses`
- durable global config target:
  `~/.config/opencode/opencode.json`
- `OPENCODE_CONFIG` is an additional higher-precedence override layer, not a
  replacement for the global target
- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override, not a
  durable install target
- interactive mode keeps the public curated model picker visible even when one
  validated model is currently available
- `--yes` and safe non-interactive runs may accept the recommended validated
  model without showing the picker
- supported project config target:
  `opencode.json`
- managed user-level provider key:
  `provider.gonkagate`
- project scope writes only activation settings
- if an existing repo-local `opencode.json` must be rewritten, its rollback
  backup is stored under `~/.gonkagate/opencode/backups/project-config`
  instead of beside the repository file
- user scope owns provider definition and secret binding
- the canonical installer-owned secret binding is exactly
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`
- durable secret-binding provenance is verified separately from resolved-config
  verification, and user config is the only durable layer allowed to own the
  canonical GonkaGate binding
- scope normalization removes only installer-owned GonkaGate activation from
  the old target; unrelated `model` and `small_model` values are preserved and
  surfaced by verification if they still override the intended scope
- installer success is based on effective OpenCode config, not only file writes
- durable effective-config verification uses `opencode debug config --pure` as
  the final truth source instead of reimplementing the full upstream merge
  engine
- resolved effective-config verification stays responsible for `model`,
  `small_model`, `provider.gonkagate`, validated transport and base URL shape,
  curated model-entry shape, and provider allow/deny gating
- secret-binding provenance verification separately enforces
  `provider.gonkagate.options.apiKey` ownership instead of inferring secret
  provenance from redacted resolved-config output
- installer success requires both the durable plain-`opencode` outcome and the
  current session's effective OpenCode outcome to match the intended
  GonkaGate setup
- effective-config verification treats provider allow/deny lists such as
  `enabled_providers` and `disabled_providers` as blocker surfaces
- durable blocker attribution is exact only for locally inspectable
  `OPENCODE_CONFIG`, user config, project config, and file-based system managed
  config layers
- when more than one locally inspectable layer conflicts on the same managed
  key, durable blocker attribution follows current OpenCode precedence:
  user config, then `OPENCODE_CONFIG`, then project config, then file-based
  system managed config
- if the resolved config proves that provider gating blocks `gonkagate` but no
  locally inspectable layer explains it, the installer reports an inferred
  higher-precedence or managed blocker instead of a generic mismatch
- effective-config verification treats `OPENCODE_CONFIG_CONTENT` as a runtime-
  only session layer: identical inline overrides are only tolerated for
  non-secret resolved keys that still preserve the intended outcome, while any
  inline `provider.gonkagate.options.apiKey` override blocks current-session
  verification in v1
- effective-config verification redacts secret-bearing resolved-config output
  instead of printing it raw
- `install-state.json` remains the durable migration anchor, and
  `lastDurableSetupAt` records the last durably verified setup even if a later
  current-session `OPENCODE_CONFIG_CONTENT` check still reports `blocked` or
  `failed`
- v1 supports macOS, Linux, native Windows, and WSL-based OpenCode usage on
  Windows
- WSL remains the upstream-recommended Windows path for the best experience
- secret handling never relies on plain `--api-key`
- the installer does not write directly to `auth.json`
- the installer does not depend on `gonkagate doctor`

## Current OpenCode Baseline

The minimum verified OpenCode version for this repository contract remains
`1.4.0`.

The latest stable upstream release audited against this repository contract is
stable `opencode-ai` `1.4.1` as of April 9, 2026.

## Curated Model Strategy

The shipped runtime is curated-model-first.

- the public picker exposes validated models only
- the current public picker contains one recommended validated model
- the picker UI is already public even though the list currently contains one
  entry, so more validated models can be added later without redesigning the
  CLI contract
- validated registry entries can carry compatibility metadata and managed config
  fragments beyond the visible model id, including provider options, model
  options, or headers

## Security Shape

Safe secret inputs:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

On macOS, Linux, and WSL, the installer enforces owner-only modes on the
managed secret file and its managed directory, and reruns repair drifted modes
in place without rewriting unchanged secret contents or creating backups.

On native Windows, the installer keeps managed secret and install-state files
under the current user's profile at `~/.gonkagate/opencode/...` and relies on
the inherited ACLs of those profile directories instead of claiming portable
`chmod`-style enforcement.

If an existing repo-local `opencode.json` must be rewritten, the installer
keeps the rollback backup under
`~/.gonkagate/opencode/backups/project-config` rather than creating
`opencode.json.bak-*` inside the repository.

Out of scope:

- plain `--api-key`
- shell profile mutation
- `.env` file generation
- writing secrets into repository-local config
- durable or inline secret-binding overrides outside
  `user_config.provider.gonkagate.options.apiKey`

Resolved-config inspection output must never be echoed raw to the user because
it can include substituted secret values.

Every user-facing CLI error path must redact secret-bearing text before it is
printed, including fallback entrypoint error handling.

## Docs

- [Documentation Index](docs/README.md)
- [Architecture Decisions](docs/architecture-decisions.md)
- [How It Works](docs/how-it-works.md)
- [Model Validation](docs/model-validation.md)
- [Security Notes](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [PRD](docs/specs/opencode-setup-prd/spec.md)

## Development

```bash
npm install
npm run ci
```

Useful commands:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run format`
- `npm run package:check`

## Repository Truth

The current package is a shipped installer runtime with a public validated model
picker, end-to-end managed config writes, redacted effective-config
verification, and rerun-safe rollback behavior. Keep docs and tests aligned
with the real runtime contract whenever behavior changes.
