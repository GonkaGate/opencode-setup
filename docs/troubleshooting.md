# Troubleshooting

## Why does the CLI stop with a blocked status?

Because the installer verifies the effective OpenCode config, not only the file
writes it just performed.

Common blockers include:

- `OPENCODE_CONFIG`
- `OPENCODE_CONFIG_CONTENT`
- user config
- file-based system managed config
- `provider.gonkagate.options.apiKey` ownership or higher-precedence secret-
  binding overrides
- `enabled_providers`
- `disabled_providers`
- higher-precedence project activation that overrides the selected scope

When those layers prevent GonkaGate from becoming effective, the installer
returns a redacted blocked result instead of claiming success.

The shipped runtime proves two things separately:

- the resolved durable plain-`opencode` result after setup
- the current session resolved result with runtime-only overrides like
  `OPENCODE_CONFIG_CONTENT` still active
- the secret-binding provenance for `provider.gonkagate.options.apiKey`

That means a current shell can still be reported as blocked even when the
durable install itself is correct.

For the durable plain-`opencode` check, exact blocker attribution is only
promised for locally inspectable `OPENCODE_CONFIG`, user config, project
config, and file-based system managed config. If the resolved config proves
that `enabled_providers` or `disabled_providers` blocks `gonkagate` but none
of those layers explains it, the installer reports an inferred
higher-precedence or managed blocker instead of a generic mismatch.
When more than one inspectable layer conflicts on the same managed key, the
installer attributes the block according to real OpenCode precedence, so
project config wins over `OPENCODE_CONFIG` and file-based system managed config
wins above both.

Secret-binding provenance is stricter than ordinary resolved-key comparison:

- `user_config` must own
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`
- project config, `OPENCODE_CONFIG`, and inspectable file-based system managed
  config must not define that key
- `OPENCODE_CONFIG_CONTENT` must not define that key in v1

In that case the managed `install-state.json` timestamp still reflects the last
durably verified setup, because `lastDurableSetupAt` is about the durable
plain-`opencode` result, not universal success for every current shell
override.

## Why is plain `--api-key` not supported?

Because a plain CLI flag can leak into shell history, logs, and process
inspection.

The safe options are:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

## Why does non-interactive setup require `--scope` or `--yes`?

Because the installer needs an explicit safe way to choose between `user` and
`project` activation.

If you do not pass `--scope`, then:

- interactive mode will show the scope prompt
- `--yes` will accept the recommended scope
- non-interactive mode without `--yes` will stop instead of guessing

## Why does the public model picker only show one option right now?

Because the shipped picker exposes validated models only.

The current public validated entry is:

- `qwen/qwen3-235b-a22b-instruct-2507-fp8`

Interactive mode still keeps that public picker visible, so more validated
models can be added later without changing the CLI contract.

## Why is `/v1/responses` mentioned if it is not supported today?

Because the product needs a planned migration path.

Current truth:

- today: `chat/completions`
- later: `responses`

The repository contract is designed so the setup tool can migrate forward
without renaming the product or changing provider identity.

## Why does project scope only write activation settings?

Because the repository-local `opencode.json` should be safe to commit.

Provider definition and secret binding stay in user scope so the project file
does not contain machine-specific or secret-bearing details.

When you rerun and switch scopes, the installer only removes activation values
it owns. If an unrelated or manual `model` / `small_model` value remains in
the old target and still wins by precedence, verification surfaces that as a
blocker instead of silently deleting it.

## Why is `OPENCODE_CONFIG` treated specially?

Because in OpenCode it is an extra higher-precedence config layer, not a
replacement for `~/.config/opencode/opencode.json`.

That means the installer cannot safely treat it as the only user config target.
It has to account for the resolved config OpenCode will actually use.

## Why can setup still fail even if `provider.gonkagate` was written?

Because OpenCode can still block a configured provider through
`enabled_providers` or `disabled_providers`.

Those keys can live in higher-precedence config layers, so the installer treats
them as explicit blockers instead of claiming success just because the provider
block, `model`, and `small_model` were written.

## Why would a validated model need more than a model id?

Because in stable OpenCode, some custom-provider behavior can depend on extra
compatibility metadata and managed config fragments such as provider options,
model options, or model headers.

If GonkaGate needs those settings for a validated flow, they belong in the
curated model registry and installer output, not as undocumented manual tweaks.

## Is it safe to paste raw `opencode debug config` output into logs or tickets?

No.

Resolved config output can already contain expanded secret values from
`{file:...}` or `{env:...}` substitution. The installer parses that output
internally and only shows a redacted summary of the conflicting keys or
layers.

## Why does inline `OPENCODE_CONFIG_CONTENT` secret binding block even when it uses the same file reference?

Because the v1 contract treats secret-binding provenance separately from
resolved-config matching.

Current upstream OpenCode docs clearly prove `{file:...}` substitution in
config files, but they do not clearly prove equivalent inline
`OPENCODE_CONFIG_CONTENT` behavior for this installer's secret-binding
contract. So the runtime allows identical inline overrides for ordinary
resolved keys like `model`, but blocks any inline
`provider.gonkagate.options.apiKey` override instead of assuming parity that
the docs do not establish.

## Is native Windows supported, and why is WSL still recommended?

Yes. The installer supports direct Windows runs as well as WSL-based OpenCode
usage on Windows.

That support claim is backed by native Windows CI and real Windows integration
tests, not only by simulated `platform: "win32"` path tests.

Current OpenCode docs say OpenCode can run directly on Windows, but recommend
WSL for the best experience because file-system performance and terminal
compatibility are generally better there.

On native Windows, GonkaGate-managed user files stay under
`%USERPROFILE%\\.config\\opencode\\...` and
`%USERPROFILE%\\.gonkagate\\opencode\\...`. The installer does not attempt to
rewrite Windows ACLs; it relies on the inherited ACLs of the current user's
profile directories.

## Why not use `gonkagate doctor` in setup?

That is intentionally out of scope for v1 of this setup tool.

The setup product stands on its own without pulling in a separate diagnostics
dependency.

## What OpenCode version is this repository targeting?

The minimum verified baseline remains stable `opencode-ai` `1.4.0`, and the
latest stable upstream release audited against this repository is `1.4.1` as
of April 9, 2026.
