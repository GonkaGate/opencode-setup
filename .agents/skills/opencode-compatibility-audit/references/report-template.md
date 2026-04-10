# Report Template

Use this structure for the final audit report.

## Audit Target

- Stable `opencode-ai` version audited
- Matching official repository or release source and published date
- Short note on how the stable version was identified
- Whether newer prerelease channels were also scanned as a watchlist
- Primary sources used

## Verdict

One of:

- `compatible`
- `compatible with caveats`
- `incompatible`

State the verdict in the first sentence and mention whether the impact is on
the repository's current scaffold truthfulness, planned OpenCode product
contract, or both.

## Confirmed Upstream Evidence

- Confirmed contract changes or confirmed unchanged contracts that materially
  affect this repository
- Direct links to official docs, schema, source, tests, help text, package
  metadata, or release notes

## Repository Impact

- Exact repo surfaces checked
- Exact repo surfaces that remain compatible
- Exact repo surfaces that would break or need correction, with a brief reason
  for each

Prefer grouping by:

- `config and precedence`
- `provider and auth`
- `model and transport`
- `workflow and docs`

## Prerelease Watchlist

- Newer prerelease signals worth watching
- Why they are not part of the stable compatibility verdict yet

Omit this section when there is no meaningful prerelease signal.

## Inferred Risk Or Ambiguity

- Anything not directly confirmed by primary sources
- Why it is still a caveat instead of a confirmed incompatibility

## Recommended Fix Areas

Include this section only when the verdict is `compatible with caveats` or
`incompatible`.

Keep it minimal:

- point to the exact files or seams that need follow-up
- say what changed upstream
- do not design the full fix
