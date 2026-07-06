# Troubleshooting

## What happens when GonkaGate changes available models?

Rerun setup. The installer fetches the current `/v1/models` response and
rewrites the managed provider catalog from that response while preserving
unrelated OpenCode config.

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
