# Security Notes

`@gonkagate/opencode-setup` manages credentials and config on the user's
machine, so the product contract is intentionally conservative.

## Secret Handling Rules

- Never print the GonkaGate `gp-...` key.
- Never accept `--api-key`.
- Only accept secrets through:
  - hidden interactive prompt
  - `GONKAGATE_API_KEY`
  - `--api-key-stdin`
- Never write the secret into repository-local files.
- Keep the secret under `~/.gonkagate/opencode/api-key` with owner-only
  protection where the platform supports POSIX modes.
- Keep the canonical installer-owned secret binding exactly at
  `user_config.provider.gonkagate.options.apiKey =
{file:~/.gonkagate/opencode/api-key}`.
- Do not allow `project_config`, `OPENCODE_CONFIG`, file-based system managed
  config, or `OPENCODE_CONFIG_CONTENT` to redefine
  `provider.gonkagate.options.apiKey`.
- Never print raw resolved-config output from `opencode debug config` or an
  equivalent inspection path.
- Treat resolved-config inspection output as secret-bearing because OpenCode may
  already expand `{file:...}` and `{env:...}` substitutions there.
- Redact secret-bearing fields from any user-facing diagnostics or logs.
- Redact secret-bearing text on every user-facing CLI error path, including
  fallback entrypoint error handling for unexpected failures.
- Preserve unrelated OpenCode config instead of overwriting the whole file,
  including unrelated top-level `model` and `small_model` values.
- Create backups before replacing managed user files.
- When rewriting repo-local `opencode.json`, keep the rollback backup under
  `~/.gonkagate/opencode/backups/project-config` instead of beside the
  repository file.
- Roll back changed managed files automatically when a later verification step
  fails.

## Why Not `auth.json`

OpenCode auth storage internals are not the product integration contract for
this repository.

Because of that, the installer should not write directly to `auth.json`.

The stable contract is:

- user-level OpenCode config
- project-level `opencode.json`
- GonkaGate-managed secret storage outside the repository

## File Placement Strategy

Expected managed user paths:

- macOS/Linux/WSL: `~/.config/opencode/opencode.json`
- native Windows: `%USERPROFILE%\\.config\\opencode\\opencode.json`
- macOS/Linux/WSL: `~/.gonkagate/opencode/api-key`
- native Windows: `%USERPROFILE%\\.gonkagate\\opencode\\api-key`
- macOS/Linux/WSL: `~/.gonkagate/opencode/install-state.json`
- native Windows: `%USERPROFILE%\\.gonkagate\\opencode\\install-state.json`
- macOS/Linux/WSL:
  `~/.gonkagate/opencode/backups/project-config/<backup-file>`
- native Windows:
  `%USERPROFILE%\\.gonkagate\\opencode\\backups\\project-config\\<backup-file>`

Expected repo-local path:

- `<project-root>/opencode.json`

`OPENCODE_CONFIG` is not a replacement for the durable global config target.
It is an additional higher-precedence layer that can override installed
settings, so the installer must inspect it before reporting success.

`OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override for the
current process. It is not a durable install target, but it can still block
the current session from resolving to GonkaGate and must be surfaced during
verification.

The installer therefore treats verification as two related proofs:

- durable verification for plain `opencode`, implemented through resolved
  effective-config verification without treating `OPENCODE_CONFIG_CONTENT` as
  part of the durable install target
- current-session resolved verification for the invoking shell, with the
  active inline override still present when it exists
- secret-binding provenance verification for
  `provider.gonkagate.options.apiKey`

For resolved verification, `opencode debug config --pure` stays the final truth
source. The installer only promises exact blocker attribution for locally
inspectable `OPENCODE_CONFIG`, user config, project config, and file-based
system managed config layers. Within those inspectable layers, attribution must
follow actual OpenCode precedence: user config, then `OPENCODE_CONFIG`, then
project config, then file-based system managed config. If the resolved config
proves provider gating through `enabled_providers` or `disabled_providers` but
none of those layers explains it, the installer reports an inferred higher-
precedence or managed blocker.

For secret-binding provenance, the runtime does not infer ownership from
redacted resolved output. Instead it enforces the exact v1 contract directly:

- `user_config` must own `provider.gonkagate.options.apiKey`
- that binding must be exactly `{file:~/.gonkagate/opencode/api-key}`
- project config, `OPENCODE_CONFIG`, and inspectable file-based system managed
  config must not define that key
- `OPENCODE_CONFIG_CONTENT` must not define that key in v1 because current
  upstream docs clearly prove `{file:...}` substitution in config files, but
  do not clearly prove equivalent inline secret-binding parity for this setup
  contract

If the current session is still overridden away from the intended GonkaGate
result, setup must surface that session as blocked even when the durable
installation is otherwise correct.

The managed `install-state.json` file remains the durable migration anchor.
Its `lastDurableSetupAt` field records the last durably verified setup, so it
can advance before a later current-session-only verification failure or block.

Only the repo-local activation file may live inside the repository, and even
then it must not include the secret or the secret file path.

Native Windows is part of the v1 support contract.

Current upstream OpenCode docs say OpenCode can run directly on Windows, while
still recommending WSL for the best Windows experience. This repository keeps a
single product contract across both Windows paths, and backs the native Windows
claim with native Windows CI plus real Windows integration coverage.

## Future Local Git Safety

Project scope should remain commit-safe by default.

That means:

- repository-local activation config must stay secret-free
- machine-specific user secret paths should stay in user config
- the installer should preserve unrelated repository config rather than replace
  it

## Permissions And Backups

- on macOS, Linux, and WSL, the managed secret file and its directory use
  owner-only permissions, and reruns repair drifted modes in place without
  rewriting unchanged secret contents or creating backups
- on native Windows, managed secret and install-state files stay under the
  current user's profile and rely on the inherited ACLs of those profile
  directories; the installer does not attempt to rewrite Windows ACLs or claim
  to repair manually loosened ACLs
- backups of managed user files stay beside the managed file, so on native
  Windows they inherit the same profile-directory ACL behavior
- if repo-local `opencode.json` must be rewritten, its rollback backup is
  stored under `~/.gonkagate/opencode/backups/project-config` so the
  repository does not gain a new `opencode.json.bak-*` file
- overwrite operations still create rollback backups first; only the backup
  location changes for repo-local project config

These rules are part of the repo contract. Any change to secret flow, storage,
or non-interactive setup must update this document.
