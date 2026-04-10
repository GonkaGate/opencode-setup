# GonkaGate `opencode` Setup PRD

## Problem

GonkaGate needs a first-class setup tool for `opencode`, because the native
custom-provider path asks too much from end users:

- they need to know that GonkaGate is a custom provider
- they need to understand OpenCode provider config
- they need to hand-edit `opencode.json`
- they need to know the canonical `baseURL`
- they need to know the current transport contract
- they need to know how to feed the secret safely

That is too much friction for a coding-agent onboarding flow. The intended
experience should be one short setup command followed by plain `opencode`.

## Desired Behavior

The user runs:

```bash
npx @gonkagate/opencode-setup
```

The tool:

1. validates local `opencode`
2. offers only curated GonkaGate model choices
3. lets the user choose `user` or `project` scope
4. accepts a GonkaGate API key through a hidden prompt, `GONKAGATE_API_KEY`,
   or `--api-key-stdin`
5. writes the minimum safe configuration automatically
6. verifies both the durable plain-`opencode` outcome and the current
   session's effective OpenCode outcome
7. never requires manual edits to `opencode.json`
8. never requires `.env` files or shell exports
9. sends the user back to normal `opencode`

## Users

Primary user:

- a developer with local `opencode` who wants GonkaGate without manual provider
  wiring

Secondary user:

- a team that wants a repeatable project activation path without leaking
  secrets into git

## In Scope

- one public npm package: `@gonkagate/opencode-setup`
- one public repository
- configuration of already installed local `opencode`
- hidden or automation-safe secret input
- curated model picker
- `user` and `project` scope
- managed user secret storage
- managed config writes with backups
- future-safe migration path for `/v1/responses`

## Out Of Scope

- installing `opencode`
- shell profile mutation
- `.env` file generation
- plain `--api-key`
- runtime `/v1/models` discovery as the main onboarding UX
- arbitrary custom base URLs
- arbitrary custom model ids
- integration with `gonkagate doctor`
- claiming `/v1/responses` support today

## Constraints

### GonkaGate constraints

- canonical base URL: `https://api.gonkagate.com/v1`
- current supported transport: `/v1/chat/completions`
- `/v1/responses` is not supported today
- setup docs must stay honest about that current reality

### OpenCode constraints

- custom provider setup requires config, not only credentials
- user config, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, project config,
  and managed settings merge together by precedence
- `OPENCODE_CONFIG` adds an extra higher-precedence config layer; it does not
  replace the global config target
- for the durable file-backed layers this installer can inspect directly, the
  current OpenCode precedence order is: user config, then `OPENCODE_CONFIG`,
  then project config, then file-based system managed settings
- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override for the
  current process; it is not a durable install target
- current chat-completions provider path uses
  `@ai-sdk/openai-compatible`
- current schema supports file-based secret substitution through `{file:...}`
- current docs clearly prove `{file:...}` substitution in config files, but do
  not clearly prove equivalent inline `OPENCODE_CONFIG_CONTENT` secret-binding
  parity for this product contract, so v1 must not assume it
- provider allow and deny lists such as `enabled_providers` and
  `disabled_providers` can prevent a configured provider from loading and must
  be treated as part of the effective activation surface
- file-based system managed settings can also win by precedence through
  `opencode.json` or `opencode.jsonc` in `/etc/opencode/`,
  `/Library/Application Support/opencode/`, or `%ProgramData%\\opencode`
- custom-provider model wiring can be overridden per model when transport
  requirements diverge
- higher-precedence custom, inline, or managed settings can override user or
  project config and must be accounted for before claiming setup success
- future `/v1/responses` may require a different adapter path

### Product constraints

- setup must feel simpler than manual custom-provider wiring
- secrets must stay out of git
- unrelated OpenCode config must be preserved
- project scope must be safe to commit
- rerunning the installer must be the official migration path

## Decisions

### Package Identity

- package name: `@gonkagate/opencode-setup`
- stable provider id: `gonkagate`
- stable display name: `GonkaGate`

The product identity must survive future transport migration.

### Verified OpenCode Baseline

The initial production baseline is:

- `opencode-ai >= 1.4.0`

Installer behavior:

- missing `opencode`: stop with install guidance
- lower version than `1.4.0`: stop and request upgrade
- newer version: continue, but keep `1.4.0` as the documented minimum verified
  baseline until re-audited

### Secret Inputs

Allowed:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Disallowed:

- plain `--api-key`

The tool must not accept a normal secret flag because it can leak into shell
history, logs, and process listings.

### Secret Storage

The installer does not rely on `/connect` or `opencode providers login` as its
primary integration path and does not write directly to `auth.json`.

Instead it stores the secret in a GonkaGate-managed user file:

- all supported platforms: `~/.gonkagate/opencode/api-key`
- native Windows resolved path: `%USERPROFILE%\\.gonkagate\\opencode\\api-key`

Why:

- current OpenCode docs say OpenCode can run directly on Windows while still
  recommending WSL for the best experience
- current OpenCode config docs keep the durable global target at
  `~/.config/opencode/opencode.json`
- current OpenCode `{file:...}` docs and source still support `~/...`
  expansion, which keeps the secret binding cross-platform
- the Node/FS stack used here does not provide portable Windows ACL mutation,
  so native Windows support must be explicit about relying on inherited
  user-profile ACLs rather than installer-enforced owner-only `chmod`

The user-level provider config references that file through OpenCode variable
substitution.

The canonical installer-owned binding is exactly:

- `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`

Durable verification must prove that ownership separately from resolved-config
comparison because redacted resolved output is not treated as proof of secret
provenance.

On macOS, Linux, and WSL, the managed secret is only converged when both the
contents and owner-only protection state are correct. If reruns find the same
secret contents with drifted file or directory modes, they must repair those
modes in place without rewriting the secret contents or creating a backup.

### Managed State

The installer also writes:

- `~/.gonkagate/opencode/install-state.json`
- native Windows resolved path:
  `%USERPROFILE%\\.gonkagate\\opencode\\install-state.json`

This records:

- installer version
- selected model key
- selected scope
- current transport contract
- `lastDurableSetupAt`, the timestamp of the last durably verified setup

That state file is the migration anchor for future upgrades, including the
eventual move to `responses`.

`lastDurableSetupAt` is intentionally a durable-verification timestamp, not a
promise that every later current-session verification also succeeded. It must
still advance when the durable plain-`opencode` result is verified and a later
`OPENCODE_CONFIG_CONTENT` check reports `blocked` or `failed`.

### Scope Model

`user` scope:

- write provider definition to user config
- write activation settings to user config
- keep secret and managed state in user storage
- remove installer-owned stale GonkaGate activation from the old project target

`project` scope:

- still write provider definition to user config
- still keep secret and managed state in user storage
- write only activation settings to repo-local `opencode.json`
- keep any repo-local rollback backup under
  `~/.gonkagate/opencode/backups/project-config`
- remove installer-owned stale GonkaGate activation from the old user target

This keeps project config commit-safe and prevents secret paths from leaking
into git, even when the installer needs rollback material for a repo-local
rewrite.

### Default UX

- interactive mode keeps the public curated model picker visible even when
  exactly one validated GonkaGate model is currently available
- if exactly one validated GonkaGate model is available, safe non-interactive
  setup may select it automatically
- if multiple validated models are available, preselect one recommended default
  and allow the user to change it
- recommend `project` scope when the installer is running inside a git
  repository and recommend `user` scope otherwise
- `--yes` accepts the recommended defaults
- prompts should explain scope in plain user language, not only in OpenCode
  config terms

### Config Targets

Durable user config target:

- `~/.config/opencode/opencode.json`
- native Windows resolved path:
  `%USERPROFILE%\\.config\\opencode\\opencode.json`

`OPENCODE_CONFIG` handling:

- `OPENCODE_CONFIG` is an additional higher-precedence layer, not a replacement
  for the durable global config target
- the installer must not treat writing only to `OPENCODE_CONFIG` as sufficient
  for durable plain-`opencode` setup
- if `OPENCODE_CONFIG` is set, the installer must inspect it as part of the
  effective config surface
- if that custom layer overrides GonkaGate-managed keys, the installer must
  either reconcile the same managed keys there too or stop with a clear
  conflict message

`OPENCODE_CONFIG_CONTENT` handling:

- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override and
  must never be treated as a durable install target
- durable setup success must be verified separately from any inline runtime
  override
- if `OPENCODE_CONFIG_CONTENT` is present when the installer verifies setup, the
  installer must also verify the current session with that inline layer still
  active
- if the inline layer changes the current session away from the intended
  GonkaGate outcome, setup must report the session as blocked even when the
  durable install is otherwise correct
- identical inline overrides for non-secret resolved keys may pass when they
  still preserve the intended GonkaGate outcome
- inline `provider.gonkagate.options.apiKey` overrides must always block the
  current-session check in v1 because the current upstream docs do not clearly
  prove equivalent inline `{file:...}` secret-binding parity for this product
  contract

Project config target:

- `<project-root>/opencode.json`

Project-config rollback backup root:

- `~/.gonkagate/opencode/backups/project-config`
- native Windows resolved path:
  `%USERPROFILE%\\.gonkagate\\opencode\\backups\\project-config`

Project root is the current working directory or the nearest enclosing git
root.

### Model Strategy

The onboarding flow must not depend on runtime `/v1/models` discovery.

Instead it ships a curated model registry that records, per model:

- stable GonkaGate setup key
- upstream model id
- display name
- transport kind
- default adapter package
- validation status
- optional context and output limits
- optional compatibility metadata and managed config fragments required for the
  validated OpenCode flow, such as provider options, model options, or model
  headers
- optional migration metadata for future per-model adapter changes

Registry keys must map cleanly to OpenCode's `provider_id/model_id` format so
the selected model can be written as `gonkagate/<model-key>`.

Registry data must be sufficient for the installer to reproduce the exact
provider and model config shape used during validation, not only the visible
picker label or adapter package.

Only validated models should be shown to end users.

### Model Validation Gate

A model may be marked `validated` only after end-to-end verification against
the current verified OpenCode baseline for the workflows the product claims to
support.

Minimum validation proof for a curated GonkaGate model includes:

- an interactive `opencode` session
- `opencode run`
- streaming text responses
- tool-calling and file-edit loops
- multi-turn continuation
- the `small_model` path used by lightweight OpenCode tasks
- any provider-level or model-level compatibility settings required for stable
  tool-calling, streaming, or continuation behavior on the verified baseline
- effective-config resolution in both `user` and `project` scope

If GonkaGate later claims task, delegate, or subagent compatibility, the model
must be re-validated for those flows before the product advertises that support.

A model must not be marked `validated` if its working setup depends on
undocumented manual tweaks that are not representable in the curated registry
contract.

### `small_model` Policy

The installer must explicitly set both:

- `model`
- `small_model`

In v1 they should be set to the same selected GonkaGate model.

Why:

- keeps default OpenCode traffic on an explicitly selected GonkaGate model
- avoids implicit cheaper-model paths that have not been validated yet
- is safer than guessing a provider-local cheaper model before a validated
  small-model strategy exists

### Current Transport Strategy

Current v1 truth:

- transport contract: `chat_completions`
- adapter package: `@ai-sdk/openai-compatible`
- base URL: `https://api.gonkagate.com/v1`

The setup tool must not imply `responses` support today.

### Future Transport Migration

The product must still be ready for the later addition of `responses`.

Migration contract:

- provider id remains `gonkagate`
- package identity remains `@gonkagate/opencode-setup`
- secret location remains stable
- rerunning the installer is the official migration path
- curated registry and install-state metadata decide whether migration happens
  through:
  - a whole-provider adapter change
  - or a per-model provider override from `@ai-sdk/openai-compatible` to
    `@ai-sdk/openai`

### Config Ownership

The installer owns only the GonkaGate-managed subset of config.

User-level managed keys:

- `provider.gonkagate` in the durable global config
- validated GonkaGate compatibility settings under `provider.gonkagate` and its
  model entries when the curated registry requires them
- GonkaGate-managed activation settings when scope is `user`
- GonkaGate-managed `small_model` when scope is `user`
- stale activation cleanup in the old target only when the installer can prove
  ownership through the currently selected curated GonkaGate ref or the
  previously recorded managed curated ref from `install-state.json`

Additional precedence-aware ownership:

- if `OPENCODE_CONFIG` is set and contains overlapping GonkaGate-managed keys,
  the installer must treat that layer as part of the managed effective-config
  surface for the current machine
- `user_config` is the only durable layer allowed to own
  `provider.gonkagate.options.apiKey`
- project config, `OPENCODE_CONFIG`, and inspectable file-based system managed
  config must not define `provider.gonkagate.options.apiKey`
- `enabled_providers` and `disabled_providers` are not GonkaGate-managed keys
  by default, but they are part of the effective provider-activation surface
- if any higher-precedence layer excludes `gonkagate` through
  `enabled_providers` or `disabled_providers`, the installer must treat that
  layer as a blocking conflict unless it is explicitly reconciling the same
  GonkaGate-managed list
- the installer does not claim ownership over unrelated keys in remote config,
  admin-managed config, or user custom config outside the GonkaGate-managed
  subset

Project-level managed keys:

- GonkaGate-managed activation settings when scope is `project`
- GonkaGate-managed `small_model` when scope is `project`

The installer must preserve all unrelated providers, agents, commands, plugins,
permissions, and UI settings.
It must also preserve unrelated top-level activation values, including
third-party `model` / `small_model` refs or non-owned GonkaGate refs, and let
verification surface them if they still block the intended scope.

### Write Behavior

When a target config already exists, the installer must:

1. parse JSON or JSONC safely
2. refuse to continue if safe merge is impossible
3. create a timestamped backup; when the rewritten target is repo-local
   `opencode.json`, store that rollback backup under
   `~/.gonkagate/opencode/backups/project-config` instead of beside the
   repository file
4. preserve unrelated config
5. add `$schema` if missing
6. rewrite only the GonkaGate-managed keys
7. write stable and readable output
8. evaluate higher-precedence override layers before claiming success

When scope normalization encounters non-owned activation in the old target, it
must leave that value in place and rely on verification to report any
resulting precedence conflict.

### Verification UX

The setup tool should end with the minimal next step:

```bash
opencode
```

But installer success must be based on the effective OpenCode config, not only
on successful file writes.

Before claiming success, the installer must:

- use `opencode debug config --pure` as the final durable success gate on the
  verified baseline instead of reimplementing the full upstream merge engine
- use resolved-config verification for `model`, `small_model`,
  `provider.gonkagate`, validated transport and base URL shape, curated
  model-entry shape, and provider allow/deny gating
- verify `provider.gonkagate.options.apiKey` provenance separately instead of
  inferring secret ownership from redacted resolved output
- detect higher-precedence custom or managed layers that keep GonkaGate from
  becoming effective when the resolved config proves a block or mismatch
- detect provider allow or deny lists such as `enabled_providers` and
  `disabled_providers` that exclude `gonkagate`
- surface the blocking layer clearly when the effective config does not match
  the installer outcome
- guarantee exact durable blocker attribution only for locally inspectable
  `OPENCODE_CONFIG`, user config, project config, and file-based system managed
  config layers
- when more than one locally inspectable layer conflicts on the same
  GonkaGate-managed key, attribute the block according to real OpenCode
  precedence among those layers rather than file traversal order
- surface the exact blocking key when provider allow or deny lists prevent
  `gonkagate` from loading
- report an inferred higher-precedence or managed blocker when the resolved
  config proves `enabled_providers` or `disabled_providers` blocks
  `gonkagate` but no locally inspectable layer explains it
- prove the durable plain-`opencode` outcome separately from runtime-only
  overrides such as `OPENCODE_CONFIG_CONTENT`
- require `user_config` to own
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`
- treat project config, `OPENCODE_CONFIG`, and inspectable file-based system
  managed config as durable blockers when they define
  `provider.gonkagate.options.apiKey`
- treat any inline `OPENCODE_CONFIG_CONTENT`
  `provider.gonkagate.options.apiKey` override as a v1 current-session blocker
- treat other `OPENCODE_CONFIG_CONTENT` and similar runtime-only overrides as
  current-session blockers only when they change the resolved result for the
  current process away from the intended GonkaGate outcome
- use `opencode debug config` or an equivalent resolved-config inspection path
  when the verified OpenCode baseline provides one
- treat resolved-config inspection as secret-bearing because `{file:...}` and
  `{env:...}` substitutions may already be expanded there
- capture and parse resolved-config output internally instead of printing raw
  stdout or stderr to the user
- redact secret-bearing fields from any user-facing diagnostics, logs, crash
  reports, or support output

The setup tool does not depend on `gonkagate doctor`.

It must not depend on `gonkagate doctor`.

## Functional Requirements

1. users must be able to configure GonkaGate for `opencode` in one `npx`
   command
2. users must not need to hand-edit `opencode.json`
3. users must be able to choose `user` or `project` scope
4. the installer must store the secret only outside the repository
5. the installer must configure GonkaGate using the current
   `chat_completions` contract
6. the installer must use curated validated models
7. the installer must preserve unrelated OpenCode config
8. the installer must set `small_model` explicitly
9. the installer must support rerun as the official update path
10. the installer must not rely on `auth.json`
11. the installer must not depend on `gonkagate doctor`
12. the installer must treat `OPENCODE_CONFIG` as an extra override layer, not
    as a replacement user-config target
13. the installer must treat `OPENCODE_CONFIG_CONTENT` as a runtime-only
    override layer, not as a durable install target
14. the installer must verify the durable plain-`opencode` outcome and the
    current session's effective config before reporting success
15. the installer must not print raw resolved-config output that may contain
    substituted secrets
16. the curated model registry must be able to encode any validated
    compatibility settings required beyond model id and adapter choice
17. the installer must treat `enabled_providers` and `disabled_providers` that
    exclude `gonkagate` as blocking conflicts unless it is explicitly
    reconciling a GonkaGate-managed list
18. the installer must only claim exact durable blocker attribution for
    locally inspectable `OPENCODE_CONFIG`, user config, project config, and
    file-based system managed config layers
19. when more than one locally inspectable layer conflicts on the same
    GonkaGate-managed key, durable blocker attribution must follow real
    OpenCode precedence among those layers rather than file traversal order
20. when resolved config proves provider gating but no locally inspectable
    layer explains it, the installer must report an inferred
    higher-precedence or managed blocker instead of a generic mismatch
21. the installer must enforce the canonical secret-binding provenance rule:
    `user_config` owns
    `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`
22. the installer must block project config, `OPENCODE_CONFIG`, and
    inspectable file-based system managed config when they define
    `provider.gonkagate.options.apiKey`
23. the installer must block any inline
    `OPENCODE_CONFIG_CONTENT.provider.gonkagate.options.apiKey` override in v1

## Non-Functional Requirements

1. setup should feel simpler than manual custom-provider configuration
2. secret handling must be safe by default
3. config writes must be reversible through backups
4. project scope must remain safe to commit
5. the tool must be production-ready on macOS, Linux, native Windows, and
   WSL-based Windows usage
6. native Windows secret and state handling must stay explicit about relying on
   current-user profile ACL inheritance instead of claiming portable
   owner-only `chmod` enforcement
7. native Windows support claims must be backed by native Windows CI or
   integration proof, not only simulated `platform: "win32"` path tests
8. future `responses` migration must not require a new package identity
9. setup should minimize prompts by accepting recommended defaults when it is
   safe to do so
10. interactive setup should keep the public curated picker visible even when a
    single validated model is currently available so the public UX stays stable
11. on macOS, Linux, and WSL, reruns must repair drifted managed-secret file
    and directory modes without rewriting unchanged secret contents or creating
    backups

## Deferred Work

- uninstall or repair commands
- richer post-setup verification
- broader curated model registry
- validated cheaper small-model strategy
- future migration to `responses`

## Risks

- if secrets enter project config, users will leak keys into git
- if the tool overclaims `responses`, product truth will drift
- if runtime discovery becomes the onboarding truth, stability will degrade
- if unrelated config is overwritten, users will stop trusting the tool
- if `small_model` is left implicit, OpenCode may take an unvalidated cheaper
  model path or a fallback path we did not configure explicitly
- if `OPENCODE_CONFIG` is treated as a replacement target, plain `opencode`
  setup may disappear outside that environment
- if `OPENCODE_CONFIG_CONTENT` is ignored during verification, the installer may
  report durable success while the current shell still resolves another
  provider or model
- if secret-binding provenance is inferred only from redacted resolved output,
  higher-precedence `provider.gonkagate.options.apiKey` overrides may pass
  undetected
- if higher-precedence managed or custom layers are ignored, the installer may
  report success while OpenCode still resolves to another provider
- if `enabled_providers` or `disabled_providers` exclude `gonkagate` and the
  installer ignores them, setup may report success while the provider never
  loads
- if resolved provider gating falls back to a generic mismatch instead of an
  inferred blocker, users may not understand that an unseen higher-precedence
  or managed layer is the real cause
- if native Windows path semantics drift from the current OpenCode contract,
  file substitution for secrets may fail
- if native Windows profile-directory ACL inheritance is mistaken for
  installer-enforced ACL repair, the product will overclaim its real security
  guarantee
- if validated compatibility settings are not captured in the curated registry,
  a model may look installable on paper but still fail in real OpenCode agent
  loops
- if raw resolved-config output is echoed during verification, secret material
  from `{file:...}` or `{env:...}` substitution may leak into terminals, logs,
  CI output, or support tickets

## Product Summary

The correct v1 product shape is:

- a small onboarding CLI
- one stable provider id: `gonkagate`
- one curated model picker
- one safe secret flow
- zero manual config editing
- zero `.env`
- zero shell exports
- minimal prompting with recommended defaults
- one durable global config target plus precedence-aware conflict handling,
  including provider allow and deny blockers
- a curated registry that can carry the compatibility settings required for
  validated OpenCode behavior
- honest support for `chat_completions` today
- a deliberate migration path for future `responses`
- native Windows support with WSL still recommended upstream for the best
  Windows experience, backed by native Windows CI and integration proof
