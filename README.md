# @gonkagate/opencode-setup

`@gonkagate/opencode-setup` is the onboarding CLI for people who already use
`opencode` and want it configured to use GonkaGate without hand-editing
`opencode.json`, exporting secrets through shell profiles, or dealing with
OpenCode provider internals.

If you want the product context first, start with
[GonkaGate](https://gonkagate.com/en),
[How it works](https://gonkagate.com/en/about),
[Pricing](https://gonkagate.com/en/pricing), or the public
[Quickstart](https://gonkagate.com/en/docs/quickstart).

If you only remember one command, make it this:

```bash
npx @gonkagate/opencode-setup
```

The installer walks you through the setup, writes the minimum safe OpenCode
config, verifies that OpenCode actually resolves GonkaGate the way it should,
and then sends you back to plain `opencode`.

## Useful Links

- [GonkaGate website](https://gonkagate.com/en) for the main product overview.
- [Get API key](https://gonkagate.com/en/register) if you still need access.
- [Quickstart](https://gonkagate.com/en/docs/quickstart) if you want to see
  the direct API flow first.
- [Pricing](https://gonkagate.com/en/pricing) for current USD billing details.
- [About GonkaGate](https://gonkagate.com/en/about) for the higher-level
  product explanation.

## What This Does For You

- Configures local `opencode` to use GonkaGate as a custom provider.
- Keeps the secret out of repository-local config.
- Preserves unrelated OpenCode settings instead of replacing whole files.
- Verifies the real resolved OpenCode result instead of assuming writes worked.
- Supports macOS, Linux, native Windows, and WSL.

## Quick Start

### Interactive setup

Use this if you are setting up your own machine:

```bash
npx @gonkagate/opencode-setup
```

The happy path is:

1. The CLI checks that `opencode` is installed and supported.
2. It shows the public curated model picker.
3. It asks whether GonkaGate should be activated for `user` or `project`
   scope.
4. It asks for your GonkaGate API key in a hidden prompt.
5. It writes the managed config, verifies the result, and tells you to go back
   to plain `opencode`.

### Non-interactive setup

Use this for automation or scripts:

```bash
npx @gonkagate/opencode-setup --scope project --yes
```

You can pass the secret through `GONKAGATE_API_KEY`:

```bash
GONKAGATE_API_KEY=gp-... npx @gonkagate/opencode-setup --scope project --yes
```

Or through stdin with `--api-key-stdin`:

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/opencode-setup --api-key-stdin --scope project --yes --json
```

If you run non-interactively, pass `--scope` or `--yes`. In a git repository,
the recommended default is usually `project`; outside a repo, it is usually
`user`.

## Before You Run It

You need:

- Node `>=22.14.0`
- local `opencode` installed and on your `PATH`
- a GonkaGate API key in the usual `gp-...` format
  from [GonkaGate](https://gonkagate.com/en/register)

Current OpenCode baseline:

- minimum verified OpenCode version: `1.4.0`
- latest audited stable upstream release against this repo contract:
  `opencode-ai` `1.4.1` as of April 9, 2026

## What The Installer Actually Changes

The default public flow is still:

```bash
npx @gonkagate/opencode-setup
```

Under the hood, the shipped runtime:

- validates local `opencode`
- keeps the public curated model picker visible in interactive mode, even
  though the current picker exposes one validated model
- resolves the curated validated model and activation scope
- accepts the secret only through a hidden prompt, `GONKAGATE_API_KEY`, or
  `--api-key-stdin`
- writes only the minimum safe OpenCode config layers
- verifies both the durable plain-`opencode` outcome and the current session's
  effective OpenCode outcome
- finishes by returning the user to plain `opencode`

For `project` scope, the installer keeps the provider definition and secret
binding in user scope and writes only activation settings to repo-local
`opencode.json`.

## Where Files Go

The important managed locations are:

- durable global config target: `~/.config/opencode/opencode.json`
- project config target: `opencode.json`
- managed secret file: `~/.gonkagate/opencode/api-key`
- project-config rollback backup path:
  `~/.gonkagate/opencode/backups/project-config`

The canonical installer-owned secret binding is exactly:

`provider.gonkagate.options.apiKey = {file:~/.gonkagate/opencode/api-key}`

That binding belongs in user config. The repo-local file stays commit-safe by
default and must not contain the secret or the secret file path.

## Safe Inputs And Security Rules

Safe secret inputs:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Not supported:

- plain `--api-key`
- shell profile mutation
- `.env` generation
- repository-local secret storage
- direct writes to `auth.json`

The installer never prints the GonkaGate key. It also redacts secret-bearing
fields on user-facing diagnostics. That includes fallback entrypoint error handling.
Resolved-config output is treated as secret-bearing, so the runtime uses
redacted resolved-config diagnostics and must never print resolved-config raw.

On macOS, Linux, and WSL, the managed secret file and directory use owner-only
permissions, and reruns repair drifted owner-only secret protections in place
without rewriting unchanged secret contents or creating backups.

On native Windows, managed files stay inside the current user's profile and
rely on inherited per-user ACLs instead of portable `chmod`-style enforcement.

## Current Product Truth

The current public curated model picker is shipped and currently exposes one
validated model:

- `qwen/qwen3-235b-a22b-instruct-2507-fp8`

Interactive mode keeps the public curated model picker visible even when only
one validated model is currently available. `--yes` and safe non-interactive
flows may auto-select the recommended validated model without showing the
picker.

The runtime is curated-model-first:

- the stable provider id is `gonkagate`
- the managed user-level provider key is `provider.gonkagate`
- the canonical base URL is `https://api.gonkagate.com/v1`
- the current transport target is `chat/completions`
- future migration should add `responses` support without renaming the product
- the curated registry can carry compatibility metadata, provider options,
  model options, and headers when a validated OpenCode flow needs them

## Verification And Config Precedence

This installer does not treat a successful file write as success by itself.
Success is based on effective OpenCode config.

For durable verification, `opencode debug config --pure` stays the final truth
source. The installer uses that resolved result to verify `model`,
`small_model`, `provider.gonkagate`, the validated transport and base URL
shape, the curated model-entry shape, and provider allow/deny gating.

OpenCode precedence matters here:

- `OPENCODE_CONFIG` is an additional higher-precedence override layer, not a
  replacement for `~/.config/opencode/opencode.json`
- `OPENCODE_CONFIG_CONTENT` is a runtime-only higher-precedence override layer,
  not a durable install target
- `enabled_providers` and `disabled_providers` can still block GonkaGate even
  when `provider.gonkagate` is present

Exact blocker attribution is guaranteed only for locally inspectable layers.
Within those inspectable layers, the installer follows current precedence:
user config, then `OPENCODE_CONFIG`, then project config, then file-based
system managed config.

If the resolved config proves provider gating but no locally inspectable layer
explains it, the installer reports an inferred higher-precedence or managed
blocker instead of a vague mismatch.

Secret-binding provenance is verified separately from resolved-config
verification. `user_config` is the only durable layer allowed to own
`provider.gonkagate.options.apiKey`, and project config, `OPENCODE_CONFIG`,
file-based system managed config, and `OPENCODE_CONFIG_CONTENT` must not define
that key.

The installer proves both the durable plain-`opencode` outcome and the current
session's effective OpenCode outcome. `OPENCODE_CONFIG_CONTENT` is never used
as a durable install target, but it can still block the current session if it
changes the effective result away from the intended GonkaGate setup.

The durable migration anchor remains `install-state.json`. Its
`lastDurableSetupAt` field means the last durably verified setup, even if a
later current-session-only check is still blocked or failed.

## Reruns, Scope, And Rollback

Rerunning the installer is the official safe update path.

That rerun flow refreshes GonkaGate-managed config, secret storage, and
install-state metadata. It also normalizes only installer-owned GonkaGate
activation in the old target instead of deleting unrelated OpenCode settings.

For `project` scope:

- user-level config still owns the provider definition and secret binding
- repo-local `opencode.json` contains only activation settings
- if repo-local config must be rewritten, rollback backups go under
  `~/.gonkagate/opencode/backups/project-config`

## Windows Support

Native Windows is part of the supported runtime contract. The claim is backed
by native Windows CI and integration coverage, not only simulated `win32`
tests.

WSL is still the upstream-recommended Windows path for the best experience,
but native Windows is supported too.

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
