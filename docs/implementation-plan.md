# Historical Implementation Plan: GonkaGate OpenCode Setup Runtime

Status note as of April 9, 2026:

- Phase 1 through Phase 5 are now implemented in the repository
- this document remains as the execution plan that led from scaffold to the
  shipped runtime
- this document is historical context, not the current product contract
- scaffold-era wording below is preserved as an execution record; use
  `README.md`, `AGENTS.md`, `docs/specs/opencode-setup-prd/spec.md`,
  `docs/how-it-works.md`, `docs/security.md`, `docs/model-validation.md`, and
  `docs/architecture-decisions.md` for current shipped behavior

## Overview

This plan turns the approved PRD into an implementation sequence for the real
`@gonkagate/opencode-setup` runtime. The goal is to move from the current
truthful scaffold to a production-ready installer that configures local
`opencode` for GonkaGate without manual config editing, without shell-profile
mutation, and without leaking secrets into repository-local files.

The implementation order follows the repository's real dependency graph:
validated model proof comes first, then runtime foundations, then safe managed
writes, then effective-config verification, then the CLI UX and contract flip
from scaffold to working installer.

## Architecture Decisions

- Keep `src/cli.ts` thin and move installer logic into dedicated modules under
  `src/install/`.
- Treat installer success as an effective-config outcome, not a file-write
  outcome.
- Preserve the fixed scope model from the PRD:
  `project` scope writes only activation settings, while provider definition
  and secret binding stay in user scope.
- Pin the v1 provider contract to `chat_completions` through
  `@ai-sdk/openai-compatible` at `https://api.gonkagate.com/v1` until a later
  revalidated transport migration exists.
- Ship only curated validated models. Runtime model discovery is not the
  onboarding contract.
- Keep arbitrary custom base URLs, arbitrary custom model ids, `auth.json`,
  and `gonkagate doctor` outside the v1 runtime contract.
- Delay any docs or CLI claims that the runtime exists until the end-to-end
  implementation and verification path is actually in place.

## Repository Truth To Preserve

- The repository currently ships a scaffold only; the runtime does not exist
  yet.
- The durable global config target remains
  `~/.config/opencode/opencode.json`.
- `OPENCODE_CONFIG` is an additional higher-precedence layer, not a
  replacement target.
- `OPENCODE_CONFIG_CONTENT` is a runtime-only override layer, not a durable
  install target.
- Secrets must never be accepted through plain `--api-key`.
- Secrets must never be printed, stored in repository-local files, or exposed
  through raw resolved-config output.
- The installer must not write directly to `auth.json`.
- The installer must not depend on `gonkagate doctor`.
- The runtime must stay on the canonical base URL and curated validated model
  registry; arbitrary base URL or model-id inputs remain out of scope.
- Windows support for v1 remains WSL-first until native Windows behavior is
  validated end to end.

## Dependency Graph

```text
Curated model validation proof
    |
    +- runtime foundations
    |    +- opencode detection and path resolution
    |    +- secret intake and storage
    |    +- config merge and scoped writes
    |
    +- effective-config verification
    |    +- precedence/conflict inspection
    |    +- redacted resolved-config parsing
    |
    +- CLI UX and contract flip
         +- docs updates
         +- contract test updates
```

## Phase 1: Foundation

### Task 1: Add runtime skeleton and installer test harness

**Description:** Create the production module layout under `src/install/` and
establish a test harness that can run isolated installer tests against fake
home directories, fake working directories, fake git roots, and fake
`opencode` binaries.

**Acceptance criteria:**

- [ ] `src/install/` contains a clear runtime entrypoint and module seams for
      context resolution, secrets, config writes, verification, and state.
- [ ] Tests can create isolated temporary environments without touching the
      developer's real config or home directory.
- [ ] The current public repository truth still describes the project as a
      scaffold until later phases are complete.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: confirm the test harness never reads or writes real user
      config paths during test execution

**Dependencies:** None

**Files likely touched:**

- `src/install/index.ts`
- `src/install/*.ts`
- `test/install/*.test.ts`
- `test/install/fixtures/*`

**Estimated scope:** Medium

### Task 2: Implement OpenCode detection, version gating, and path resolution

**Description:** Add logic to detect local `opencode`, validate the verified
minimum version, detect whether the installer is running in a git repository,
resolve project root, and compute all managed user and project paths required
by the PRD.

**Acceptance criteria:**

- [ ] Missing `opencode` produces a clear install-guidance failure.
- [ ] Versions below `1.4.0` fail with an upgrade message.
- [ ] Supported and newer versions are distinguished correctly.
- [ ] Runtime resolves the durable user config path, managed secret path,
      managed install-state path, and project `opencode.json` path.
- [ ] Project root resolution matches the PRD: current working directory or the
      nearest enclosing git root.
- [ ] v1 support expectations remain truthful for macOS, Linux, and WSL-based
      Windows usage.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: review fixture outputs for missing, old, exact-minimum,
      and newer-version scenarios

**Dependencies:** Task 1

**Files likely touched:**

- `src/install/opencode.ts`
- `src/install/paths.ts`
- `src/install/context.ts`
- `test/install/opencode.test.ts`
- `test/install/paths.test.ts`

**Estimated scope:** Medium

### Task 3: Finalize curated model registry shape and validation gate

**Description:** Turn the existing contract-only model registry into a runtime
foundation that can ship validated entries, compatibility metadata, and future
migration metadata without changing the product identity.

**Acceptance criteria:**

- [ ] Registry entries can encode provider options, model options, model
      headers, limits, transport, and migration metadata.
- [ ] Registry keys map cleanly to the written OpenCode model id format
      `gonkagate/<model-key>`.
- [ ] The initial production runtime is designed to ship with exactly one
      validated model and no public multi-model choice until more models are
      independently validated.
- [ ] Runtime logic exposes only models marked `validated`.
- [ ] The registry can carry explicit default-selection metadata rather than
      relying on array order once multiple validated models exist.
- [ ] A separate validation checklist or reference document defines the minimum
      proof required before a model is marked `validated`.
- [ ] The initial validated entry pins the current v1 transport contract:
      `chat_completions`, `@ai-sdk/openai-compatible`, and the canonical base
      URL.
- [ ] The `small_model` policy is reflected in the implementation plan and test
      strategy.
- [ ] The v1 runtime and CLI contract do not expose arbitrary custom model ids
      or arbitrary custom base URL overrides.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: review one candidate validated-model entry against the PRD
      requirements for interactive, run, streaming, tool, multi-turn, and
      `small_model` flows

**Dependencies:** Task 1

**Files likely touched:**

- `src/constants/models.ts`
- `docs/*model-validation*`
- `test/package-contract.test.ts`
- `test/install/models.test.ts`

**Estimated scope:** Small

## Checkpoint: After Phase 1

- [ ] `npm run ci` passes
- [ ] Runtime seams are clear enough to implement without reshaping public
      contracts mid-stream
- [ ] A human has approved the first validated-model target and the runtime
      module boundaries

## Phase 2: Secure Inputs and Managed State

### Task 4: Implement safe secret intake

**Description:** Add the three allowed secret intake paths: hidden prompt,
`GONKAGATE_API_KEY`, and `--api-key-stdin`, while preserving the hard ban on
plain `--api-key`.

**Acceptance criteria:**

- [ ] Secret source precedence is defined and tested.
- [ ] Non-interactive setup works with `GONKAGATE_API_KEY` and
      `--api-key-stdin`.
- [ ] Plain `--api-key` remains rejected before any secret processing begins.
- [ ] No user-facing output echoes the raw secret.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: inspect stdout and stderr in success and failure paths for
      secret leakage

**Dependencies:** Tasks 1-2

**Files likely touched:**

- `src/install/secrets.ts`
- `src/cli.ts`
- `test/install/secrets.test.ts`
- `test/cli.test.ts`

**Estimated scope:** Medium

### Task 5: Implement managed secret storage and install-state persistence

**Description:** Write the secret to GonkaGate-managed user storage with
owner-only permissions where supported, create backups before overwrites, and
record install-state metadata needed for reruns and future migrations.

**Acceptance criteria:**

- [ ] The secret is stored only under `~/.gonkagate/opencode/api-key`.
- [ ] Secret writes use owner-only permissions where the platform supports
      them.
- [ ] Overwrites create backups before replacement.
- [ ] `install-state.json` records installer version, selected model, selected
      scope, current transport, and last-success timestamp.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: inspect generated fixture directories for correct file
      placement and backup behavior

**Dependencies:** Task 4

**Files likely touched:**

- `src/install/storage.ts`
- `src/install/state.ts`
- `test/install/storage.test.ts`
- `test/install/state.test.ts`

**Estimated scope:** Medium

## Checkpoint: After Phase 2

- [ ] Secret intake and storage flows are working without leaking secrets
- [ ] `npm run ci` passes if CLI or contract surfaces changed
- [ ] The install-state format is acceptable as the future migration anchor

## Phase 3: Config Ownership and Safe Writes

### Task 6: Build JSON and JSONC config parse-merge-write engine

**Description:** Implement safe parsing, stable output formatting, `$schema`
injection, backup creation, and merge logic that rewrites only GonkaGate-owned
keys while preserving unrelated OpenCode config.

**Acceptance criteria:**

- [ ] Existing JSON and JSONC config files are parsed safely.
- [ ] Safe merge failures stop the installer with a clear error.
- [ ] Timestamped backups are created before managed config replacement.
- [ ] `$schema` is added when it is missing from a managed target file.
- [ ] Unrelated providers, commands, plugins, permissions, and UI settings are
      preserved.
- [ ] Merge logic rewrites only GonkaGate-managed keys and compatibility
      fragments for the active scope.
- [ ] Output is stable and readable.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: compare before and after fixture files to confirm only
      GonkaGate-managed keys changed

**Dependencies:** Tasks 1-2

**Files likely touched:**

- `src/install/config.ts`
- `src/install/write.ts`
- `test/install/config.test.ts`
- `test/install/write.test.ts`

**Estimated scope:** Medium

### Task 7: Implement scope-aware config writers

**Description:** Add the actual user-scope and project-scope write behavior
defined by the PRD, including explicit writes for both `model` and
`small_model`.

**Acceptance criteria:**

- [ ] `user` scope writes provider definition and activation settings to user
      config.
- [ ] `project` scope writes only activation settings to repo-local
      `opencode.json`.
- [ ] Provider definition and secret binding always remain in user scope.
- [ ] User-scope provider config writes the canonical GonkaGate v1 provider
      shape, including file-based secret substitution, `chat_completions`,
      `@ai-sdk/openai-compatible`, the canonical base URL, and any validated
      compatibility fragments required by the curated registry.
- [ ] `model` and `small_model` are both explicitly written.
- [ ] Repo-local config stays secret-free and commit-safe by default.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: inspect generated project-scope `opencode.json` fixtures to
      confirm no secret path is present and only activation settings are written

**Dependencies:** Tasks 3, 5-6

**Files likely touched:**

- `src/install/scope.ts`
- `src/install/write-target-config.ts`
- `test/install/scope.test.ts`

**Estimated scope:** Medium

## Checkpoint: After Phase 3

- [ ] `npm run ci` passes
- [ ] User-scope and project-scope write outputs match the PRD exactly
- [ ] A human has reviewed fixture diffs for config ownership correctness

## Phase 4: Effective-Config Verification

### Task 8: Implement precedence and blocker inspection

**Description:** Evaluate the higher-precedence config surface before claiming
success, including `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, project
config, and provider allow or deny lists.

**Acceptance criteria:**

- [ ] The installer inspects `OPENCODE_CONFIG` as an additional active layer.
- [ ] The installer does not rewrite `OPENCODE_CONFIG` in v1.
- [ ] The installer treats `OPENCODE_CONFIG_CONTENT` as a runtime-only blocking
      layer when it changes the resolved outcome.
- [ ] The installer detects `enabled_providers` and `disabled_providers` that
      exclude `gonkagate`.
- [ ] Overlap with GonkaGate-managed keys in `OPENCODE_CONFIG` causes a
      hard-stop conflict rather than implicit reconciliation.
- [ ] Blocking layers and keys are surfaced clearly without exposing secrets.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: run a conflict matrix covering allow-list, deny-list,
      custom-layer override, and inline-content override cases

**Dependencies:** Tasks 6-7

**Files likely touched:**

- `src/install/verify-layers.ts`
- `src/install/conflicts.ts`
- `test/install/verify-layers.test.ts`

**Estimated scope:** Medium

### Task 9: Implement redacted effective-config verification

**Description:** Integrate with `opencode debug config` or an equivalent
resolved-config inspection path, parse the result internally, and emit only
redacted user-facing diagnostics.

**Acceptance criteria:**

- [ ] Success is based on effective OpenCode config, not only file writes.
- [ ] `opencode debug config` is used as the canonical final verification
      surface for the verified `1.4.0` baseline.
- [ ] The verification path prefers `opencode debug config --pure` when that
      flag is available on the verified stable baseline.
- [ ] Resolved-config output is captured and parsed internally.
- [ ] Raw resolved-config stdout or stderr is never echoed to the user.
- [ ] Secret-bearing fields are redacted from diagnostics, logs, and failure
      output.
- [ ] Verification confirms that the intended GonkaGate provider and selected
      model are effective.
- [ ] Verification confirms that `small_model` resolves to the same selected
      GonkaGate model in v1.
- [ ] Verification confirms that resolved `provider.gonkagate` settings match
      the expected transport package, canonical base URL, and required curated
      compatibility fragments.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: inject fake resolved-config output containing expanded
      secrets and confirm the user-visible diagnostics are redacted

**Dependencies:** Task 8

**Files likely touched:**

- `src/install/verify-effective.ts`
- `src/install/redact.ts`
- `src/install/errors.ts`
- `test/install/verify-effective.test.ts`

**Estimated scope:** Medium

## Checkpoint: After Phase 4

- [ ] `npm run ci` passes
- [ ] The installer can distinguish successful setup from successful writes
- [ ] Redaction behavior has been reviewed specifically for secret-bearing
      resolved-config paths

## Phase 5: CLI UX, Truthfulness, and Release Readiness

### Task 10: Implement rerun-safe update and migration flow

**Description:** Turn rerunning the installer into the official safe update
path by making repeated setup runs idempotent when nothing changes, reversible
when managed files are rewritten, and predictable when scope, validated-model
metadata, or future migration inputs change.

**Acceptance criteria:**

- [ ] Re-running the installer with the same effective inputs is idempotent and
      does not introduce unrelated config drift.
- [ ] Re-running the installer can safely refresh GonkaGate-managed config,
      secret storage, and install-state metadata without manual cleanup.
- [ ] Re-running across scope changes rewrites only the managed keys for the
      old and new scope targets, while preserving unrelated OpenCode config.
- [ ] Re-running that changes managed files creates timestamped backups before
      replacement.
- [ ] `install-state.json` is updated only after effective-config verification
      succeeds and remains the migration anchor for future transport changes.
- [ ] Failed or blocked reruns do not claim success or destroy the last known
      working managed state.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: run a rerun matrix covering no-op rerun, repeated project
      scope, user-to-project change, project-to-user change, and blocked
      higher-precedence conflict scenarios

**Dependencies:** Tasks 5-9

**Files likely touched:**

- `src/install/state.ts`
- `src/install/write.ts`
- `src/install/verify-effective.ts`
- `test/install/rerun.test.ts`

**Estimated scope:** Medium

### Task 11: Replace the scaffold CLI with the real setup flow

**Description:** Wire the real runtime into the CLI, implement the planned UX
for defaults and prompts, and replace the machine-readable `not_implemented`
response only after the runtime is actually complete.

**Acceptance criteria:**

- [ ] `src/cli.ts` runs the real installer flow.
- [ ] Recommended defaults are applied correctly for single-model selection,
      git-aware scope recommendation, and `--yes`.
- [ ] Scope prompts explain the `user` and `project` choice in plain user
      language, not only OpenCode config terminology.
- [ ] Human-readable success output ends with the minimal next step:
      `opencode`.
- [ ] Machine-readable JSON output reflects real success, conflict, and failure
      states.
- [ ] The CLI surface does not introduce arbitrary custom base URL or arbitrary
      custom model-id inputs in v1.
- [ ] The shipped flow does not depend on `gonkagate doctor` or `auth.json`.

**Verification:**

- [ ] Tests pass: `npm run test`
- [ ] Manual check: run the CLI in interactive and non-interactive fixture
      modes

**Dependencies:** Tasks 2-10

**Files likely touched:**

- `src/cli.ts`
- `bin/gonkagate-opencode.js`
- `test/cli.test.ts`

**Estimated scope:** Medium

### Task 12: Flip repository truth from scaffold to implemented runtime

**Description:** Update the public docs, repository contract, and contract
tests so they truthfully describe the implemented runtime rather than the
placeholder scaffold.

**Acceptance criteria:**

- [ ] `README.md`, `AGENTS.md`, and the operational docs describe the shipped
      runtime accurately.
- [ ] Contract tests stop asserting `not_implemented` behavior and instead pin
      the real runtime contract.
- [ ] Any meaningful contributor-facing or user-facing change is reflected in
      `CHANGELOG.md`.
- [ ] The repository does not claim any behavior that is not covered by the
      implementation and tests.
- [ ] Docs stay explicit about the current `chat_completions` contract and do
      not overclaim `/v1/responses`, native Windows support, or unsupported
      custom runtime inputs.

**Verification:**

- [ ] Full verification passes: `npm run ci`
- [ ] Manual check: compare docs, CLI help, and runtime behavior for truth
      alignment

**Dependencies:** Task 11

**Files likely touched:**

- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `CHANGELOG.md`
- `test/docs-contract.test.ts`
- `test/cli.test.ts`

**Estimated scope:** Medium

## Completion Checkpoint

- [ ] All acceptance criteria above are satisfied
- [ ] `npm run ci` passes
- [ ] The runtime works in both `user` and `project` scope
- [ ] Effective-config verification gates success correctly
- [ ] Rerunning the installer works as the official safe update path
- [ ] No user-facing path leaks secrets
- [ ] The runtime still rejects or omits unsupported v1 surfaces such as plain
      `--api-key`, arbitrary custom base URLs, arbitrary custom model ids,
      `auth.json`, and `gonkagate doctor`
- [ ] The repository is ready for review without contradicting its own docs

## Risks and Mitigations

| Risk                                                                       | Impact | Mitigation                                                                                            |
| -------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| A curated model is published without enough proof                          | High   | Require an explicit validation checklist before marking any model `validated`                         |
| The installer reports success after writes but before effective resolution | High   | Make effective-config verification a hard success gate                                                |
| Secrets leak through diagnostics or debug output                           | High   | Capture resolved config internally and redact before any output                                       |
| `OPENCODE_CONFIG` or allow/deny lists silently override the managed setup  | High   | Treat higher-precedence conflicts as first-class blockers                                             |
| Project scope leaks machine-specific or secret-bearing data into git       | High   | Keep provider and secret binding in user scope only, and test project fixtures for secret-free output |
| Docs drift ahead of the real runtime                                       | Medium | Delay the public contract flip until the runtime and tests are complete                               |
| Native Windows behavior differs from WSL assumptions                       | Medium | Keep v1 support claims scoped to WSL-based usage until validated                                      |

## Resolved v1 Decisions

The previously open architecture questions are now fixed in
[Architecture Decisions](./architecture-decisions.md).

The implementation plan assumes:

- v1 launches with exactly one validated GonkaGate model
- v1 does not rewrite `OPENCODE_CONFIG`
- overlap in higher-precedence managed keys is treated as a hard-stop conflict
- `opencode debug config` is the canonical resolved-config success gate
- raw resolved-config output is always treated as secret-bearing
