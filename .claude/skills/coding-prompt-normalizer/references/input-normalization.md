# Input Normalization

Use this file to clean messy user input without flattening the technical
meaning.

## Clean Aggressively

- Remove filler words, conversational loops, and duplicate fragments when they
  add no task signal.
- Collapse repeated requests into one clear intent.
- Rewrite broken punctuation into clean sentence or bullet boundaries.
- Drop apologies, throat-clearing, and self-corrections unless they change the
  task.

## Accept Any Input Language

- The input language does not matter.
- Mixed-language input is normal. Keep technical literals intact and normalize
  the connective tissue around them.
- Do not mention the source language in the final handoff prompt unless the user
  explicitly asks for that.

## Preserve Technical Language

- Keep technical words, repo jargon, CLI commands, config keys, and code-like
  fragments intact.
- Do not translate or normalize identifiers.
- If a term could be ordinary language or a code term, prefer the technical
  reading only when nearby literals or repo nouns support it.
- Preserve exact user constraints such as `read-only`, `do not edit files`,
  `no refactor`, `keep owner-only permissions`, `investigate first`,
  `do not change public flow`, `do not add gonkagate doctor`, or
  `keep .claude and .agents in sync`.

## Resolve References Carefully

- Ground phrases like "here", "this config", "that command", or "that flow"
  only when the input provides a strong clue.
- If the clue is weak, use assumption language in the final handoff prompt:
  `Likely relevant area`, `Possible target`, or `Assumption`.
- Do not invent a file or module just to make the prompt sound confident.
- If the repo does not yet contain the implied implementation surface, keep
  that explicit and bias toward planning or investigation instead of
  hallucinated coding work.

## Rewrite Meaning, Not Surface Wording

- Rewrite the user's intent into a clear context-rich handoff for an agent.
- Keep the real request, constraints, and likely acceptance criteria.
- Remove duplicates and noise, but keep the user's true preferences and
  non-goals.
- Favor clarity over literal sentence-by-sentence conversion.

## Literal Preservation Canaries

Treat these as examples of tokens that must survive exactly if they appear:

- `~/.config/opencode/opencode.json`
- `opencode.json`
- `provider.gonkagate`
- `GONKAGATE_API_KEY`
- `--api-key-stdin`
- `npx @gonkagate/opencode-setup`
- `small_model`
- `chat_completions`
- `responses`
- `@ai-sdk/openai-compatible`
- `@ai-sdk/openai`
- `auth.json`
- `src/cli.ts`
- `docs/how-it-works.md`
- `docs/specs/opencode-setup-prd/spec.md`
- `docs/plans/opencode-setup-implementation-plan.md`
- `test/docs-contract.test.ts`

Wrap such literals in backticks inside the final handoff prompt.

## Ambiguity Handling

- If multiple interpretations are possible but one is clearly more likely, pick
  it and label it as an assumption.
- If ambiguity changes the task mode or likely target surface, switch to a
  framing, planning, or investigation prompt instead of a direct coding prompt.
- When transcript noise may have corrupted a literal, keep the raw fragment
  visible as `Possible original literal: ...`.

## Final Check

Before finishing, confirm:

- exact literals are preserved
- the task mode is explicit
- no fake certainty was introduced
- the result is a useful task-context handoff, not just a cleaned transcript
