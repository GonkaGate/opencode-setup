# GonkaGate `kilo` Setup PRD

Status: draft product contract for feasibility-to-implementation planning.
This document does not describe shipped behavior in this repository yet.

Last upstream check: April 14, 2026.

## Source Baseline

The original investigation request used the literal phrase `kilo-code cli`.
The upstream product should be identified in this PRD as:

- product name in docs: Kilo Code CLI or Kilo CLI
- command name: `kilo`
- secondary command alias: `kilocode`
- npm package: `@kilocode/cli`
- upstream repository: `Kilo-Org/kilocode`
- npm `latest` observed on April 14, 2026: `@kilocode/cli` `7.2.0`
- npm `rc` observed on April 14, 2026: `7.2.5`
- official docs baseline language: Kilo version `1.0` and later

The release-channel mismatch matters. A public GonkaGate installer must not use
the broad `1.0+` docs statement as its only compatibility claim. It must pin a
minimum verified Kilo CLI version after a local config experiment and source
audit.

Primary sources checked:

- Kilo CLI docs:
  <https://kilo.ai/docs/code-with-ai/platforms/cli>
- Kilo CLI command reference:
  <https://kilo.ai/docs/code-with-ai/platforms/cli-reference>
- Kilo settings docs:
  <https://kilo.ai/docs/getting-started/settings>
- Kilo custom models docs:
  <https://kilo.ai/docs/code-with-ai/agents/custom-models>
- Kilo OpenAI-compatible provider docs:
  <https://kilo.ai/docs/ai-providers/openai-compatible>
- Kilo `v7.2.0` source:
  <https://github.com/Kilo-Org/kilocode/tree/v7.2.0>

## Problem

GonkaGate needs a first-class setup utility for Kilo CLI users if Kilo's native
custom-provider path asks too much from end users:

- they need to know that GonkaGate should be configured as a custom provider
- they need to know Kilo's current config file names and precedence
- they need to know which Kilo config file is safe to edit for user or project
  scope
- they need to know the canonical GonkaGate base URL
- they need to know that GonkaGate currently targets `chat/completions`
- they need to define a custom model entry under the provider
- they need to supply the GonkaGate API key without putting it in git, shell
  history, process lists, logs, or Kilo's raw resolved-config output

The intended product pattern is the same class of experience as
`npx @gonkagate/opencode-setup`: one short setup command, safe secret intake,
minimal config writes, effective verification, then normal `kilo` usage.

This is not a straight port from OpenCode. Kilo is an OpenCode fork, but it has
Kilo-specific config names, env vars, docs drift, release channels, state
locations, and verification behavior.

## Desired Behavior

The user runs a GonkaGate setup utility for Kilo CLI, likely:

```bash
npx @gonkagate/kilo-setup
```

The exact package name is a product decision. This PRD uses
`@gonkagate/kilo-setup` as the working name because the executable command is
`kilo` and the official docs use "Kilo CLI". If package naming needs to mirror
the upstream npm scope more literally, `@gonkagate/kilocode-setup` remains an
open alternative.

The tool:

1. validates that local Kilo CLI is installed as `kilo` or `kilocode`
2. identifies the installed Kilo CLI version and channel
3. refuses versions below the verified baseline
4. shows only curated GonkaGate model choices
5. lets the user choose `user` or `project` scope
6. accepts the GonkaGate API key through safe inputs only
7. writes the minimum safe Kilo config layers
8. stores the secret only in GonkaGate-managed user storage
9. verifies the durable plain-`kilo` outcome without printing raw resolved
   config
10. verifies the current shell when `KILO_CONFIG_CONTENT` or other runtime
    overrides are active
11. reports higher-precedence Kilo config blockers clearly
12. sends the user back to plain `kilo`

## Users

Primary user:

- a developer with local Kilo CLI who wants GonkaGate available in `kilo`
  without manually editing provider config

Secondary user:

- a team that wants a repeatable project activation path without storing
  machine-specific provider definitions or secrets in a repository

Tertiary user:

- an automation user who wants a non-interactive setup flow that is safe enough
  for scripts and CI bootstrap steps

## In Scope

- one public npm package for Kilo setup
- configuration of an already installed local Kilo CLI
- support for `kilo` as the primary command and `kilocode` as a fallback alias
- Kilo CLI version detection
- hidden or automation-safe GonkaGate secret input
- curated GonkaGate model picker
- `user` and `project` activation scopes
- managed user secret storage
- managed install-state storage
- JSON/JSONC config reads and conservative writes with backups
- effective-config verification with redacted diagnostics
- blocker attribution for Kilo-specific config layers that are locally
  inspectable
- future-safe migration path if GonkaGate later supports `responses`

## Out Of Scope

- installing Kilo CLI
- upgrading Kilo CLI automatically
- creating or modifying shell profiles
- generating `.env` files
- accepting a plain `--api-key` argument
- writing secrets to repository-local files
- writing directly to Kilo's `auth.json`
- depending on Kilo Gateway or Kilo account login
- runtime `/v1/models` discovery as the primary onboarding UX
- arbitrary custom base URLs
- arbitrary custom model IDs
- claiming GonkaGate `responses` support before validation
- live paid inference verification as the default install success gate
- support for Kilo VS Code extension settings beyond the shared config files
  that the CLI itself resolves

## Constraints

### GonkaGate Constraints

- canonical base URL: `https://api.gonkagate.com/v1`
- current supported transport: `/v1/chat/completions`
- `/v1/responses` is not supported today unless separately revalidated
- setup must expose only curated, validated model choices
- the current validated model inherited from the OpenCode setup baseline is:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`

### Kilo CLI Constraints

Kilo's public config model overlaps with OpenCode but is not identical.

The verified `@kilocode/cli@7.2.0` package:

- exposes `kilo` and `kilocode` binaries
- stores global app paths under the XDG-style `kilo` app name
- reads global config from `~/.config/kilo/...`
- supports Kilo-preferred config files such as `kilo.jsonc` and `kilo.json`
- still reads OpenCode-style config files such as `opencode.jsonc` and
  `opencode.json`
- reads global config in this observed order, with later entries overriding
  earlier entries: `config.json`, `kilo.json`, `kilo.jsonc`,
  `opencode.json`, `opencode.jsonc`
- supports project config from the project root and from `.kilo`,
  `.kilocode`, and `.opencode` directories
- supports `KILO_CONFIG` as a custom config file layer
- supports `KILO_CONFIG_CONTENT` as an inline runtime config layer
- supports file-based system managed config under Kilo-specific system paths
- supports `{env:...}` and `{file:...}` substitution in config text
- supports `provider.<provider_id>.models` for custom model registration
- supports `provider.<provider_id>.options.apiKey`
- supports `provider.<provider_id>.options.baseURL`
- supports `enabled_providers` and `disabled_providers`
- supports provider-level `whitelist` and `blacklist`
- exposes `kilo debug config`, but `@kilocode/cli@7.2.0` does not expose a
  documented `--pure` flag for that command
- prints substituted secret values in `kilo debug config` output

The docs and source do not perfectly agree across channels. Current docs
prefer `~/.config/kilo/kilo.jsonc`, while older Kilo CLI docs and source still
mention or read `config.json`, `opencode.json`, and `opencode.jsonc`. The
installer must therefore choose a safe write target while inspecting the full
effective surface.

### Product Constraints

- setup must be easier than manual Kilo custom-provider configuration
- secrets must stay out of git
- unrelated Kilo config must be preserved
- project scope must be commit-safe by default
- effective Kilo config, not file writes alone, must determine success
- rerunning the installer must be the official migration path
- diagnostics must be clear without printing raw secret-bearing config

## Decisions

### Package Identity

Working package name:

- `@gonkagate/kilo-setup`

Working public command:

```bash
npx @gonkagate/kilo-setup
```

Stable provider identity:

- provider id: `gonkagate`
- display name: `GonkaGate`

The package name remains provisional until product/legal review, but the
provider id should be stable unless Kilo reserves or conflicts with that id.

### Verified Kilo CLI Baseline

Initial implementation must perform a compatibility spike before finalizing the
minimum version.

Tentative baseline:

- audited package: `@kilocode/cli@7.2.0`
- required command: `kilo`
- fallback command: `kilocode`

Installer behavior:

- missing `kilo` and `kilocode`: stop with install guidance
- version below verified baseline: stop and request upgrade
- version at or above verified baseline: continue, but warn internally that
  Kilo's `rc` and GitHub tags may outrun npm `latest`
- unknown version output: stop unless explicitly running in a test harness

The installer must record the Kilo CLI version it verified in the managed
install state.

### Secret Inputs

Allowed:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Disallowed:

- `--api-key`
- positional secret arguments
- writing the key into `.env`
- requiring users to export secrets in shell profiles
- writing the key into Kilo project config
- writing the key into Kilo `auth.json`

Reason:

- plain CLI arguments can leak through shell history, logs, and process
  inspection
- repository-local Kilo config is often commit-eligible
- Kilo's resolved-config output can print substituted secret values

### Secret Storage

The installer stores the secret in GonkaGate-managed user storage:

- POSIX/macOS/WSL: `~/.gonkagate/kilo/api-key`
- native Windows: `%USERPROFILE%\.gonkagate\kilo\api-key`

The canonical installer-owned Kilo secret binding is:

```text
provider.gonkagate.options.apiKey = {file:~/.gonkagate/kilo/api-key}
```

The user-level provider config references the file through Kilo's `{file:...}`
substitution. The project-level activation config must not contain the secret,
the secret value, or the secret file path.

On POSIX-supported platforms, the secret directory and file should use
owner-only permissions. Reruns should repair drifted owner-only modes when the
secret contents already match, without rewriting the secret or creating a
backup.

On native Windows, managed files should stay under the current user's profile
and rely on inherited user-profile ACLs. The installer should not claim to
rewrite Windows ACLs unless that behavior is explicitly implemented and tested.

### Managed State

The installer writes:

- `~/.gonkagate/kilo/install-state.json`
- native Windows resolved path:
  `%USERPROFILE%\.gonkagate\kilo\install-state.json`

The state records:

- installer package name and version
- Kilo CLI command used
- Kilo CLI version detected
- selected GonkaGate model key
- selected scope
- current transport contract
- config write target paths
- `lastDurableSetupAt`
- compatibility audit version

`lastDurableSetupAt` means "last durably verified plain-`kilo` setup", not
"every possible current shell override also succeeded".

### Config Targets

Default durable user config target:

- `~/.config/kilo/kilo.jsonc`

Why:

- current Kilo settings docs describe `kilo.jsonc` as the primary global file
- JSONC preserves user comments
- it is Kilo-specific and avoids creating new OpenCode-named config for a Kilo
  integration

Existing global config handling:

- if `~/.config/kilo/kilo.jsonc` exists, write there
- else if `~/.config/kilo/kilo.json` exists, write there
- else create `~/.config/kilo/kilo.jsonc`
- do not write to `config.json`, `opencode.json`, or `opencode.jsonc` as the
  default target for new installs
- still inspect those files because Kilo may resolve them, and because
  `opencode.json` / `opencode.jsonc` can override the Kilo-preferred write
  target in the observed `7.2.0` global merge order

Default project config target:

- if `.kilo/kilo.jsonc` exists, write project activation there
- else if `.kilo/kilo.json` exists, write project activation there
- else if project-root `kilo.jsonc` exists, write there
- else if project-root `kilo.json` exists, write there
- else create `.kilo/kilo.jsonc`

Rationale:

- `.kilo/kilo.jsonc` is Kilo-specific
- keeping generated project activation under `.kilo/` avoids crowding the repo
  root when no project Kilo config exists yet
- JSONC allows future comment-preserving edits

The installer must inspect but should not default-write legacy KiloCode,
OpenCode, or generic config files unless a user explicitly opts into an
advanced reconciliation flow.

### Scope Model

`user` scope:

- write provider definition to user config
- write activation settings to user config
- keep secret and install state in GonkaGate-managed user storage
- remove only installer-owned stale GonkaGate activation from the old project
  target
- preserve unrelated user config

`project` scope:

- still write provider definition to user config
- still keep secret and install state in GonkaGate-managed user storage
- write only activation settings to Kilo project config
- keep project config secret-free and commit-safe
- remove only installer-owned stale GonkaGate activation from the old user
  activation target
- preserve unrelated project config

Activation settings are:

```jsonc
{
  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
  "small_model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
}
```

`small_model` is included only if Kilo resolves it consistently with the
validated baseline. If a Kilo compatibility spike proves `small_model` behaves
differently or should be left unset, this decision must be updated before
implementation.

### Provider Config Shape

The expected managed provider shape is:

```jsonc
{
  "provider": {
    "gonkagate": {
      "name": "GonkaGate",
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://api.gonkagate.com/v1",
      "options": {
        "apiKey": "{file:~/.gonkagate/kilo/api-key}",
        "baseURL": "https://api.gonkagate.com/v1",
      },
      "models": {
        "qwen3-235b-a22b-instruct-2507-fp8": {
          "id": "qwen/qwen3-235b-a22b-instruct-2507-fp8",
          "name": "Qwen3 235B A22B Instruct 2507 FP8",
          "tool_call": true,
          "limit": {
            "context": 0,
            "output": 0,
          },
        },
      },
    },
  },
}
```

The exact `api` field requires proof before implementation. Kilo's
OpenAI-compatible path can use provider-level `options.baseURL`, model-level
`provider.api`, or provider-level `api` depending on how the resolved model is
constructed. The installer should prefer the smallest validated shape after a
spike proves which fields are required for `@kilocode/cli@7.2.0`.

The curated model registry must be able to carry:

- visible model key
- upstream model id
- display name
- transport kind
- adapter package
- provider-level options
- model-level options
- model headers
- Kilo-specific compatibility notes
- validation status

### Transport Strategy

Current v1 transport:

- `chat_completions`
- Kilo adapter package: `@ai-sdk/openai-compatible`
- GonkaGate base URL: `https://api.gonkagate.com/v1`

Kilo's OpenAI-compatible provider implementation exposes chat and responses
model constructors, but the default language-model path and docs still center
OpenAI-compatible chat behavior. This installer must not claim `responses`
support for GonkaGate until a dedicated GonkaGate/Kilo validation proves it.

Future `/v1/responses` support should be a migration under the same provider id
and package identity, not a product rename.

### Config Precedence

For `@kilocode/cli@7.2.0`, the effective config surface to account for is:

1. legacy KiloCode migrations and organization modes
2. remote `.well-known/opencode` config from well-known auth entries
3. global Kilo config under `~/.config/kilo`
4. `KILO_CONFIG`
5. project root config files
6. `.kilo`, `.kilocode`, and `.opencode` directory config
7. `KILO_CONFIG_CONTENT`
8. file-based system managed config

The installer must not treat a write to `~/.config/kilo/kilo.jsonc` as success
until the resolved Kilo result matches the intended setup.

Exact blocker attribution is guaranteed only for locally inspectable layers:

- global config files under `~/.config/kilo`
- `KILO_CONFIG`
- project root config files
- `.kilo`, `.kilocode`, and `.opencode` directory config files
- `KILO_CONFIG_CONTENT`
- file-based system managed config

If a remote `.well-known/opencode` or Kilo organization-derived layer blocks
GonkaGate and cannot be inspected locally with provenance, the installer should
report an inferred remote or managed blocker instead of a generic mismatch.

### Higher-Precedence Blockers

The installer must detect and report:

- `KILO_CONFIG` overlapping GonkaGate-managed provider or activation keys
- `KILO_CONFIG_CONTENT` overlapping GonkaGate-managed provider or activation
  keys
- file-based system managed config overriding GonkaGate-managed keys
- project config overriding user-scope activation
- stale user config overriding project-scope activation
- `enabled_providers` that does not include `gonkagate`
- `disabled_providers` that includes `gonkagate`
- provider-level `whitelist` that excludes the selected GonkaGate model
- provider-level `blacklist` that includes the selected GonkaGate model
- provider block shape mismatches for `gonkagate`
- missing curated model entry
- secret-binding provenance mismatches

`disabled_providers` should be treated as stronger than `enabled_providers`
when both mention `gonkagate`.

### Secret-Binding Provenance

Resolved config alone is not proof of secret provenance because
`kilo debug config` prints substituted secret values.

The installer must verify provenance by inspecting the file-backed config
layers it writes and the higher-precedence layers it can inspect:

- user config must own the canonical
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/kilo/api-key}`
  binding
- project config must not define `provider.gonkagate.options.apiKey`
- `KILO_CONFIG` must not define `provider.gonkagate.options.apiKey`
- `KILO_CONFIG_CONTENT` must not define
  `provider.gonkagate.options.apiKey` in v1
- file-based system managed config must not define
  `provider.gonkagate.options.apiKey` unless a future enterprise-aware policy
  explicitly supports it

An identical inline `KILO_CONFIG_CONTENT` secret binding should still block in
v1 until Kilo-specific inline secret-binding parity is explicitly accepted as a
product decision.

### Verification

The core success gate is effective Kilo config, not file writes.

Available verification tool:

```bash
kilo debug config
```

Important constraint:

- `@kilocode/cli@7.2.0` does not document `kilo debug config --pure`
- `kilo debug config` can print substituted secret values
- Kilo config loading can write schema or migration updates to config files,
  so verification is not guaranteed to be perfectly side-effect-free
- the installer must capture and parse this output internally only
- raw debug-config output must never be printed in user-facing logs,
  diagnostics, JSON output, or fallback error handling

Durable verification should run with durable install inputs and without
`KILO_CONFIG_CONTENT` when proving the plain-`kilo` outcome. The verifier must
check:

- resolved `model`
- resolved `small_model`, if v1 owns it
- resolved `provider.gonkagate`
- provider adapter package
- base URL
- transport-relevant shape
- curated model entry
- provider allow/deny gating
- provider whitelist/blacklist gating

Current-session verification should then run with the invoking shell's runtime
overrides restored, including `KILO_CONFIG_CONTENT`, and report whether this
specific shell is still overridden away from the intended setup.

If Kilo adds a safe pure/debug command in a later version, the installer may
switch to it only after a compatibility audit updates this PRD.

### Backups And Rollback

Before replacing any managed config file, the installer must create a rollback
backup.

Managed user-file backups:

- under `~/.gonkagate/kilo/backups/user-config`

Project-config backups:

- under `~/.gonkagate/kilo/backups/project-config`

Rationale:

- avoid creating `*.bak` files beside repo-local config
- keep rollback material under profile-scoped user storage
- preserve project config commit safety

If writes succeed but later durable verification fails, the installer should
roll back changed managed files and report the blocker. If rollback fails, the
installer must report that separately with redacted file-path diagnostics.

### Rerun And Migration

Reruns are first-class.

The installer must:

- repair managed secret permissions on POSIX when possible
- preserve unrelated Kilo config
- update only GonkaGate-owned provider/model/activation keys
- remove only stale installer-owned activation from the old target when the
  user switches scope
- keep manual unrelated `model` or `small_model` values and surface them as
  blockers if they still win by precedence
- use `install-state.json` to migrate future provider shape changes
- never silently delete unknown user config

Migration examples:

- package rename or provider shape update
- adding required Kilo-specific model headers
- changing from provider-level `api` to model-level `provider.api`
- future `responses` transport support
- Kilo config precedence changes

### Non-Interactive Mode

Supported non-interactive inputs:

```bash
GONKAGATE_API_KEY=gp-... npx @gonkagate/kilo-setup --scope project --yes
```

```bash
printf '%s' "$GONKAGATE_API_KEY" \
  | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes --json
```

Non-interactive rules:

- require `--scope` or `--yes`
- `--yes` accepts recommended defaults
- default model may be auto-selected only when exactly one recommended
  validated model exists
- no plain secret flag
- JSON output must redact secret-bearing fields
- blocked results should be machine-readable without exposing raw config

### Default UX

Interactive mode:

- detect local `kilo`
- display installed Kilo CLI version
- show the curated model picker even if only one model is currently validated
- recommend `project` scope inside a git repository
- recommend `user` scope outside a git repository
- explain the Kilo-specific scope effect in user language
- ask for the GonkaGate API key through a hidden prompt
- write and verify
- finish with "Run `kilo`"

The tool should not ask users to understand Kilo provider internals during the
happy path.

### Windows Support

Windows support requires explicit proof.

Expected native Windows paths:

- global config: `%USERPROFILE%\.config\kilo\kilo.jsonc`
- managed secret: `%USERPROFILE%\.gonkagate\kilo\api-key`
- managed state: `%USERPROFILE%\.gonkagate\kilo\install-state.json`
- project config: `.kilo\kilo.jsonc` or project-root `kilo.jsonc`

The Kilo CLI docs mention baseline binaries for Windows and the npm package
ships a cross-platform CLI, but this installer must not claim native Windows
support until CI or integration proof runs on native Windows.

WSL should be treated as POSIX for permissions and path behavior.

## Security Requirements

- never print the GonkaGate `gp-...` key
- never accept `--api-key`
- never write secrets into project config
- never write secrets into `.env`
- never write directly to Kilo `auth.json`
- never print raw `kilo debug config` output
- redact secret-bearing values from text and JSON diagnostics
- redact secret-bearing fallback entrypoint errors
- treat resolved config as secret-bearing
- preserve unrelated Kilo config
- back up before replacing managed files
- roll back changed managed files after failed verification where possible
- keep project scope commit-safe
- block higher-precedence secret-binding overrides in v1
- do not mutate shell profiles
- do not require Kilo account auth

## Open Questions

Blocking before implementation:

- What exact package name should ship: `@gonkagate/kilo-setup` or
  `@gonkagate/kilocode-setup`?
- What minimum Kilo CLI version should be the first verified baseline?
- Which provider config shape is the smallest stable Kilo shape:
  provider-level `api`, provider-level `options.baseURL`, model-level
  `provider.api`, or a combination?
- Should v1 own `small_model`, or should it leave Kilo's small-model behavior
  untouched until separately validated?
- Does `kilo debug config` mutate existing user files by adding `$schema` in
  all supported versions, and how should rollback account for that?
- Can a safe pure/effective-config command be used in a newer Kilo version?
- Does Kilo's current inline `KILO_CONFIG_CONTENT` `{file:...}` behavior match
  file-backed config behavior closely enough to ever allow identical inline
  secret binding?
- How should remote `.well-known/opencode` and Kilo organization modes be
  surfaced when they block GonkaGate but are not locally inspectable?

Non-blocking but important:

- Should the project target default to `.kilo/kilo.jsonc` or project-root
  `kilo.jsonc` for easier user discovery?
- Should the installer support `kilocode` as a visible command fallback or only
  as a detection fallback?
- Should `KILO_CONFIG` ever be reconciled, or only treated as a blocker?
- Should Kilo VS Code extension shared settings be documented as supported only
  through the CLI-resolved config files?

## Required Proof Before Coding

The implementation should not start until a throwaway compatibility spike
proves the following against the chosen baseline:

1. `kilo --version` can be parsed reliably for the chosen package.
2. `kilo debug paths` identifies global config/data/cache/state paths.
3. A file-backed GonkaGate API key reference under
   `provider.gonkagate.options.apiKey` resolves through `kilo debug config`.
4. `kilo debug config` can prove `model`, provider, model entry, base URL, and
   allow/deny gating without printing raw output to users.
5. A GonkaGate provider with the chosen config shape is listed by
   `kilo models gonkagate` or otherwise found in resolved config.
6. A project-scope activation file can select the user-level provider without
   putting the secret path in project config.
7. `KILO_CONFIG` and `KILO_CONFIG_CONTENT` blockers can be detected and
   attributed.
8. `enabled_providers`, `disabled_providers`, `whitelist`, and `blacklist`
   blockers can be detected.
9. POSIX secret permissions can be repaired without rewriting an unchanged
   secret.
10. Native Windows paths and CLI behavior are proven in CI or a documented
    integration run before any Windows support claim ships.

The spike must use fake secrets only and must never paste raw `kilo debug
config` output containing a real secret into logs.

## Acceptance Criteria For MVP

MVP is ready when:

- the package validates a supported local Kilo CLI
- interactive setup succeeds for `user` scope
- interactive setup succeeds for `project` scope
- non-interactive setup works with `GONKAGATE_API_KEY`
- non-interactive setup works with `--api-key-stdin`
- plain `--api-key` is rejected
- managed secret is stored under `~/.gonkagate/kilo`
- project config remains secret-free
- unrelated Kilo config is preserved
- effective durable config is verified through a redacted internal path
- current-session `KILO_CONFIG_CONTENT` blockers are reported
- `KILO_CONFIG` blockers are reported
- provider allow/deny blockers are reported
- provider whitelist/blacklist blockers are reported
- raw resolved config is never printed
- reruns are idempotent for unchanged setup
- failed verification rolls back changed managed files where possible
- docs describe Kilo-specific config and verification limits truthfully
- tests cover JSON, JSONC, user scope, project scope, non-interactive input,
  redaction, blocker attribution, and rollback

## Not Ready To Ship Until

- the verified baseline is pinned and documented
- the provider config shape is proven against a local Kilo CLI
- the resolved-config verification command and redaction path are implemented
- docs drift between Kilo website, npm, and source has been accounted for
- Windows support claims have runner-backed proof or are explicitly excluded
- the package name is finalized

## Future Work

- support GonkaGate `/v1/responses` after GonkaGate and Kilo compatibility is
  proven
- support a Kilo-native pure config verifier if upstream adds one
- support enterprise-aware managed config policies if teams ask for it
- support additional validated GonkaGate models
- support safe migration from early private Kilo setup prototypes
- optionally contribute upstream Kilo docs clarifying config precedence,
  `kilo.jsonc` versus `opencode.jsonc`, and `kilo debug config` secret
  behavior
