# Architecture Decisions: v1 Production Runtime

## Purpose

This document closes the open architecture questions from the implementation
plan and fixes the v1 production direction for the real
`@gonkagate/opencode-setup` runtime.

These decisions are intentionally conservative. The goal is to ship a
production-ready installer that is predictable, safe around secrets, and
aligned with the current stable upstream OpenCode contract.

## Upstream Evidence Baseline

The decisions below were reviewed against the current stable upstream contract
on April 9, 2026.

Primary sources:

- npm registry metadata for `opencode-ai` latest:
  `1.4.1`
- OpenCode config docs:
  [https://opencode.ai/docs/config/](https://opencode.ai/docs/config/)
- OpenCode providers docs:
  [https://opencode.ai/docs/providers/](https://opencode.ai/docs/providers/)
- OpenCode models docs:
  [https://opencode.ai/docs/models/](https://opencode.ai/docs/models/)
- OpenCode CLI docs:
  [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)
- OpenCode config schema:
  [https://opencode.ai/config.json](https://opencode.ai/config.json)

Verified upstream facts used here:

- Config files are merged, not replaced.
- Precedence order includes global config, `OPENCODE_CONFIG`, project
  `opencode.json`, `OPENCODE_CONFIG_CONTENT`, and managed config layers.
- `disabled_providers` has priority over `enabled_providers`.
- Custom providers can use `@ai-sdk/openai-compatible` for
  `/v1/chat/completions` and `@ai-sdk/openai` for `/v1/responses`.
- `options.apiKey`, `options.headers`, and `{file:...}` / `{env:...}`
  substitution are part of the documented config contract.
- Current upstream docs clearly prove `{file:...}` substitution in config
  files, but do not clearly prove equivalent inline `OPENCODE_CONFIG_CONTENT`
  secret-binding parity for this installer's contract.
- OpenCode docs say it can run directly on Windows, while WSL is recommended
  for the best experience.
- `opencode debug config` exists in the shipped stable `1.4.1` CLI.
- `opencode debug config` outputs resolved config values, including substituted
  secret material, so raw output is secret-bearing.

## Decision 1: Launch v1 with exactly one validated GonkaGate model

**Decision**

The first production runtime release must ship with exactly one curated model
entry marked `validated`.

For that initial release:

- the installer keeps the public curated picker visible in interactive mode
- `--yes` and safe non-interactive flows may auto-select the recommended
  validated model
- `model` and `small_model` are both set to that same validated model
- additional public model choices are deferred until they pass the same
  validation gate

**Rationale**

For v1, the safest public shape is to keep the picker visible in interactive
mode while still allowing automatic recommended-default behavior when prompts
are intentionally bypassed:

- smallest compatibility surface
- smallest rollback surface
- no ambiguity about the recommended default in automation-safe paths
- stable public UX even as more validated models are added later
- no hidden dependency on unproven model variants

What matters architecturally is not guessing a model name early. What matters
is forcing the runtime to ship only behind end-to-end proof.

**Implementation consequence**

- The runtime must refuse to expose or auto-fallback to any model that is not
  marked `validated`.
- The curated registry should add explicit default-selection metadata such as
  `recommended: true` rather than relying on array order once multiple
  validated models exist.
- The exact first GonkaGate model ID is a release input that must be pinned in
  a model validation record before runtime launch. It is not a safe
  architecture placeholder to invent in advance.

**What this means for v1**

- The initial runtime release is blocked until one GonkaGate model passes the
  validation matrix from the PRD.
- Once that model exists, interactive users still see the public picker, while
  `--yes` and safe non-interactive flows may accept the recommended default.

## Decision 2: Do not reconcile or mutate `OPENCODE_CONFIG` in v1

**Decision**

The installer must inspect higher-precedence config layers, but it must not
rewrite `OPENCODE_CONFIG` in v1.

If `OPENCODE_CONFIG` overlaps any GonkaGate-managed key or blocks GonkaGate
through provider allow or deny lists, the installer must hard-stop with a
clear conflict message and remediation guidance.

If `OPENCODE_CONFIG_CONTENT` changes the effective result for the current
process away from the intended GonkaGate outcome, the installer must report the
current session as blocked even when the durable install is correct.
Identical inline overrides for ordinary resolved keys may still pass, but any
inline `provider.gonkagate.options.apiKey` override must block in v1.

**Rationale**

Automatically reconciling or rewriting `OPENCODE_CONFIG` is not the safe
default for a production installer:

- it is environment-scoped and may belong to shell wrappers, CI, or a separate
  admin policy
- the installer cannot reliably infer ownership
- writing into that file would expand the managed surface beyond the durable
  product contract
- silent reconciliation would make reruns harder to reason about

The safer v1 boundary is:

- write durable user config
- write optional project activation config
- inspect all higher-precedence layers
- stop on managed-key overlap instead of mutating external ownership domains

**Managed keys for this policy**

At minimum, overlap detection should cover for durable ownership and
current-session blocking analysis:

- `provider.gonkagate`
- GonkaGate-managed compatibility fragments under `provider.gonkagate`
- GonkaGate-managed model entries under `provider.gonkagate.models`
- `model`
- `small_model`
- `enabled_providers`
- `disabled_providers`

The last two are not GonkaGate-owned by default, but they are part of the
effective provider-activation surface and therefore part of conflict
detection.

**Implementation consequence**

- v1 owns only the durable global config target, repo-local activation config,
  and GonkaGate-managed user storage.
- v1 reads but does not write `OPENCODE_CONFIG`.
- Future support for adopting or repairing a custom config layer, if ever
  needed, should be an explicit product feature rather than implicit v1
  behavior.

## Decision 3: Use `opencode debug config` as the canonical success gate

**Decision**

For the verified `opencode-ai` `1.4.0+` baseline, the canonical final
verification mechanism is `opencode debug config`.

The installer may also use its own static inspection of config files and
environment variables before that step, but those checks are preflight only.
They are not the final success gate.

`opencode debug paths` is useful for diagnostics, not for setup success.
`opencode models`, `opencode run`, and file-write success are not acceptable
substitutes for resolved-config verification.

**Rationale**

The production questions are:

- what config will plain `opencode` resolve durably after setup?
- what config will the current invoking shell resolve right now?

Only a resolved-config surface can answer those reliably across:

- global config
- `OPENCODE_CONFIG`
- project config
- `OPENCODE_CONFIG_CONTENT`
- managed settings
- provider allow and deny lists

The stable CLI and official docs both acknowledge `opencode debug config` as
that resolved-config surface.

**Security consequence**

Because `opencode debug config` outputs resolved values, the installer must
never echo its raw stdout or stderr to the user.

That is a hard requirement, not a best-effort precaution.

In isolated verification against `opencode-ai@1.4.1`, a config containing
`"apiKey": "{env:TEST_SECRET}"` was rendered by `opencode debug config` as the
resolved secret value. This proves the output is secret-bearing.

**Implementation consequence**

- Capture `opencode debug config` output internally.
- Parse it as structured data.
- Redact secret-bearing fields before any diagnostic or error output.
- Compare the resolved result against the intended GonkaGate outcome.
- Run durable verification separately from current-session verification when
  `OPENCODE_CONFIG_CONTENT` is active.

At minimum, the verification gate should confirm:

- the selected `model` resolves to `gonkagate/<validated-model-key>`
- `small_model` resolves to the same v1 model
- `provider.gonkagate` is present with the expected transport package and base
  URL
- required compatibility fragments from the curated registry are present
- no higher-precedence layer excludes `gonkagate`

## Decision 4: Prefer the plugin-safe verification path when available

**Decision**

When the verified upstream baseline supports it, the installer should invoke
the canonical verification command in its plugin-safe form:

```bash
opencode debug config --pure
```

If a future revalidated stable baseline removes `--pure`, the installer may
fall back to plain `opencode debug config`, but only after re-auditing the
risk.

**Rationale**

The verification step should observe resolved config without taking on
avoidable side effects from external plugins.

The stable `1.4.1` CLI exposes `--pure` on `debug config`, which gives the
installer a stricter and safer read-only verification path.

**Implementation consequence**

- v1 verification should default to `opencode debug config --pure`.
- Tests should cover both the preferred `--pure` path and the fallback path
  selection logic behind a future-version seam.

## Decision 5: Separate durable verification from current-session verification

**Decision**

When `OPENCODE_CONFIG_CONTENT` is present, the installer must verify:

- the durable plain-`opencode` result without treating that inline layer as a
  durable install target
- the current session result with the active inline layer still present

The installer reports full success only when both results match the intended
GonkaGate outcome.

**Rationale**

`OPENCODE_CONFIG_CONTENT` is explicitly documented by OpenCode as an inline
runtime override rather than a durable install target. Treating it as durable
would misrepresent what plain `opencode` will do later. Ignoring it entirely
would misrepresent what the invoking shell will do right now.

The right product contract is to prove both.

**Implementation consequence**

- durable verification must not be blocked only because an identical inline
  override happens to restate the same non-secret GonkaGate config
- current-session verification must still surface inline runtime overrides when
  they keep the invoking shell away from the intended GonkaGate result
- current-session verification must always block inline
  `provider.gonkagate.options.apiKey` overrides in v1 because the current
  upstream docs do not clearly prove equivalent inline secret-binding parity
- installer statuses and docs must distinguish between durable success and a
  blocked current session

## Decision 6: Keep auth integration file-based and independent of `auth.json`

**Decision**

The production installer continues to integrate through managed config plus
file-based secret substitution. It must not switch to `auth.json`,
`/connect`, or `opencode providers login` as its primary integration path.

**Rationale**

Upstream documentation still presents `/connect` and provider-login flows for
general provider onboarding, but the stable contract also documents
`options.apiKey`, `options.headers`, and `{file:...}` support for custom
providers.

For this repository, file-based secret substitution remains the cleaner and
more controlled integration boundary because it:

- keeps the secret in a GonkaGate-owned path
- avoids taking ownership of upstream auth storage internals
- aligns with the repo's commit-safety and no-shell-mutation requirements
- stays compatible with future transport migration under the same provider ID

**Implementation consequence**

- `auth.json` remains out of scope for writes.
- Provider-login commands may be mentioned in docs only as upstream context,
  not as the GonkaGate installer contract.

## Decision 7: Centralize user-facing error redaction

**Decision**

Every user-facing CLI error path must use the same secret-redaction boundary,
including fallback entrypoint error handling outside the main installer flow.

**Rationale**

The resolved-config and secret-handling safety contract only holds if unexpected
errors are rendered through the same redaction policy as handled installer
results. A separate raw fallback sink is a contract hole even if normal flows
are safe.

**Implementation consequence**

- CLI wrapper error handling should delegate to the same redaction policy as the
  main runtime
- tests should exercise fatal and unexpected error paths with secret-bearing
  sample text

## Resulting v1 Production Shape

These decisions fix the v1 production shape as follows:

- one validated GonkaGate model at launch
- interactive public picker remains visible even while only one validated model
  is currently available
- durable writes only to the documented user config target, project activation
  file, and GonkaGate-managed user storage
- hard-stop conflict handling for overlapping `OPENCODE_CONFIG` and effective
  provider blockers
- canonical success based on durable and current-session resolved config, not
  file writes
- raw resolved-config output treated as secret-bearing
- config-plus-secret-file integration, not `auth.json` mutation

Anything broader than this should be treated as a post-v1 product change, not
as an implementation shortcut.
