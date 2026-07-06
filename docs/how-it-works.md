# How It Works

`@gonkagate/opencode-setup` is the shipped onboarding CLI for configuring local
`opencode` to use GonkaGate.

The primary UX is:

```bash
npx @gonkagate/opencode-setup
```

## Current State

The runtime is implemented and shipped.

Today the repository ships:

- the public CLI
- the live GonkaGate model picker UI backed by `GET https://api.gonkagate.com/v1/models`
- a managed GonkaGate provider catalog that writes every fetched GonkaGate
  model into `provider.gonkagate.models` so OpenCode's `/models` command can
  switch between GonkaGate models after setup
- end-to-end secret intake, managed secret persistence, managed OpenCode config
  parse/merge/write, rerun-safe rollback, precedence-based locally inspectable
  blocker attribution, inferred higher-precedence fallback reporting, and
  redacted effective-config verification under `src/install/`
- the final PRD
- CI and release tooling, including native Windows runner coverage
- docs and contract tests

## Install Flow

1. Check `opencode` is available and at least `1.4.0`.
2. Accept the GonkaGate API key through a hidden prompt, `GONKAGATE_API_KEY`, or `--api-key-stdin`.
3. Fetch `GET https://api.gonkagate.com/v1/models` with Bearer auth.
4. Show the live GonkaGate model picker in interactive mode, defaulting to the first fetched model.
5. Recommend `project` scope inside a git repository and `user` scope otherwise.
6. Save the secret only under `~/.gonkagate/opencode/...`.
7. Write or update the user-level provider definition with every fetched model id in `provider.gonkagate.models`.
8. When `project` scope is chosen, write only activation settings to repo-local `opencode.json`.
9. Verify durable and current-session effective OpenCode config without printing raw resolved config.
10. Tell the user to run plain `opencode` and show the safe key-rotation rerun command.

## Why User-Level Provider Ownership

The product intentionally keeps the provider definition in user scope.

That gives the desired behavior:

- the repository-local `opencode.json` stays safe to commit
- the secret path never leaks into git
- one user machine can safely activate GonkaGate across multiple projects
- future transport migration from `chat_completions` to `responses` can happen
  through one managed provider block

## Config Precedence Reality

OpenCode merges multiple config layers by precedence.

For this repository, the important consequence is:

- `~/.config/opencode/opencode.json` remains the durable global target
- `OPENCODE_CONFIG` is an extra higher-precedence layer, not a replacement for
  the global target
- among the durable layers this installer can inspect directly, OpenCode's
  current precedence order is: user config, then `OPENCODE_CONFIG`, then
  project `opencode.json`, then file-based system managed config
- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override for
  the current process, not a durable install target
- `enabled_providers` and `disabled_providers` can still prevent GonkaGate
  from loading even when `provider.gonkagate` is configured correctly
- file-based system managed config can also win by precedence through
  `opencode.json` or `opencode.jsonc` in `/etc/opencode/`,
  `/Library/Application Support/opencode/`, or `%ProgramData%\\opencode`
- project `opencode.json` still overrides lower layers for project-specific
  activation
- higher-precedence managed or custom settings must be surfaced as blockers if
  they prevent GonkaGate from becoming effective

So the installer must not claim success just because one file write succeeded.
It has to reason about the resolved config OpenCode will actually use.

## Current Transport Truth

Current product truth:

- GonkaGate today targets `chat/completions`
- base URL is `https://api.gonkagate.com/v1`
- the future migration path should support `responses`
- the setup tool must stay honest and must not imply that `responses` already
  exists

## Scope Model

`user` scope:

- write provider definition to user-level config
- write activation settings to user-level config
- keep secret and install state in GonkaGate-managed user storage
- remove only installer-owned stale GonkaGate activation from repo-local
  `opencode.json`

`project` scope:

- still keep provider definition in user-level config
- still keep secret and install state in user-level storage
- write only activation settings to repo-local `opencode.json`
- keep any repo-local rollback backup under
  `~/.gonkagate/opencode/backups/project-config`
- remove only installer-owned stale GonkaGate activation from the user-level
  target

In short: project scope writes only activation settings, and reruns normalize
the old target instead of leaving stale GonkaGate activation behind. Non-owned
activation values are preserved and must be caught by verification if they
still take precedence.

## Effective Verification

Successful writes are not enough on their own.

`opencode debug config --pure` is the canonical read-only success gate for the
verified `1.4.0` baseline. The shipped runtime keeps that resolved config as
the final durable truth source and uses local layer inspection only to explain
why the resolved result is blocked or mismatched.

The shipped runtime treats effective verification as two linked checks:

- resolved effective-config verification for the plain `opencode` path and the
  current session when runtime-only inline overrides are present
- secret-binding provenance verification for
  `provider.gonkagate.options.apiKey`

For durable verification, exact blocker attribution is limited to locally
inspectable layers:

- `OPENCODE_CONFIG`
- user config at `~/.config/opencode/opencode.json`
- project config at `<project-root>/opencode.json`
- file-based system managed config in `/etc/opencode/`,
  `/Library/Application Support/opencode/`, or `%ProgramData%\\opencode`

When more than one of those layers conflicts on the same GonkaGate-managed key,
the installer attributes the block to the highest-precedence inspectable layer
in that order, rather than whichever file happened to be read first.

If the durable resolved config proves `enabled_providers` or
`disabled_providers` blocks `gonkagate` but none of those layers explains it,
the installer reports an inferred higher-precedence or managed blocker instead
of degrading to a generic resolved-config mismatch.

`OPENCODE_CONFIG_CONTENT` is never treated as a durable install target. Instead,
the installer proves the durable result separately and then checks whether the
current shell is still being overridden away from the intended GonkaGate setup.
For resolved keys like `model` or `small_model`, an identical inline override
is not a blocker on its own. But secret-binding provenance is stricter:

- `user_config` is the only durable layer allowed to own
  `provider.gonkagate.options.apiKey`
- the canonical installer-owned binding is exactly
  `{file:~/.gonkagate/opencode/api-key}`
- project config, `OPENCODE_CONFIG`, and inspectable file-based system managed
  config must not define that key
- `OPENCODE_CONFIG_CONTENT` must not define that key in v1 because the current
  upstream docs prove `{file:...}` substitution for config files, but do not
  clearly prove equivalent inline secret-binding behavior for this contract

That provenance check is evaluated separately from resolved-config comparison
because `opencode debug config --pure` is intentionally treated as secret-
bearing and the runtime does not recover secret ownership from redacted
resolved output.

After durable verification succeeds, the installer refreshes
`install-state.json` immediately. Its `lastDurableSetupAt` field records the
last durably verified setup and is allowed to advance before a later
current-session `OPENCODE_CONFIG_CONTENT` check reports `blocked` or `failed`.

But the installer must not print raw `opencode debug config` output to the
user. Resolved-config output can already contain expanded `{file:...}` or
`{env:...}` secrets, so it is parsed internally and surfaced only through
redacted diagnostics.

The live `GET https://api.gonkagate.com/v1/models` response is the source of truth for model availability. The installer writes every fetched id to `provider.gonkagate.models`; the selected setup model only controls the root `model` and `small_model` defaults. That lets users switch between managed GonkaGate models through OpenCode.s `/models` command without requiring repository updates for model additions or removals.

## Windows Support

Native Windows is a supported runtime path.

That keeps the contract aligned with current upstream docs:

- OpenCode can run directly on Windows, while WSL is still recommended for the
  best Windows experience
- the durable global config target remains `~/.config/opencode/opencode.json`,
  which resolves to `%USERPROFILE%\\.config\\opencode\\opencode.json` on native
  Windows
- native Windows support is backed by native Windows CI plus real Windows
  integration tests for fake `opencode` spawn and durable verification
- GonkaGate-managed secret and install-state files still live under
  `~/.gonkagate/opencode/...`, which resolves inside the current user's profile
  on native Windows
- macOS, Linux, and WSL writes enforce owner-only modes and reruns repair
  drifted secret file and directory modes in place; native Windows writes rely
  on inherited user-profile ACLs instead of rewriting Windows ACLs; managed
  user-file backups stay beside those files, and repo-local rollback backups
  also stay in the same profile-scoped
  `~/.gonkagate/opencode/backups/project-config` area

## Non-Interactive Safety

Automation is supported, but not through a plain secret flag.

Safe non-interactive inputs:

- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Unsafe and intentionally unsupported:

- `--api-key`

If non-interactive setup does not pass `--scope`, the CLI requires either an
explicit `--scope` or `--yes` so it can accept the recommended scope safely.

If non-interactive setup does not pass `--model`, the CLI may accept the single
default fetched model automatically. Interactive mode still keeps the
live GonkaGate model picker visible so the public UX remains stable as the registry
grows.
