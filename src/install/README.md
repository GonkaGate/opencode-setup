# `src/install/`

This directory now contains the shipped production installer runtime.

Start here:

- `index.ts` is the end-to-end installer entrypoint and orchestration layer
- `session.ts` keeps internal install-session state separate from the public
  installer result contract
- `index.ts` coordinates managed writes and records rollback actions for the
  installer flow
- `selection.ts` resolves the public model picker and scope UX
- `context.ts` resolves OpenCode, platform, and managed path context
- `platform-path.ts` centralizes path handling across POSIX, native Windows,
  and Git Bash-style Windows cwd inputs
- `opencode.ts` detects `opencode` and classifies its version support
- `paths.ts` resolves the working directory, git root, and managed file paths
- `deps.ts` defines the runtime, prompt, filesystem, and command seams that
  keep the install logic testable
- `secrets.ts` resolves the allowed secret inputs without echoing raw secrets
- `storage.ts` and `state.ts` handle managed secret and install-state
  persistence with backups, POSIX owner-only permissions where supported, and
  explicit native Windows profile-scoped storage semantics
- `managed-provider-config.ts` translates validated curated models into the
  canonical GonkaGate-owned provider shape
- `config.ts` parses JSON and JSONC OpenCode config safely and applies
  GonkaGate-owned mutations without replacing unrelated config
- `managed-config-mutations.ts`, `scope.ts`, and `write-target-config.ts`
  centralize scope-aware target normalization and writes
- `write.ts` handles no-op detection, backups, and atomic managed config writes
- `rollback.ts` restores changed managed files when a later Phase 5 step fails
- `verify-layers.ts`, `verify-effective.ts`, and related verification helpers
  implement higher-precedence inspection, separate secret-binding provenance
  enforcement, and redacted resolved-config verification
- `contracts/` owns topic-specific installer contracts, while `contracts.ts`
  keeps the aggregate compatibility entrypoint

The public CLI is now wired to this runtime through `src/cli.ts` and the
focused adapters under `src/cli/`.
