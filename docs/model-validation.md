# Model Validation

This document records the minimum validation gate for curated GonkaGate models
and the approved public validated models in the shipped runtime.

## Minimum Validation Gate

A model may be marked `validated` only after end-to-end verification against
the current verified OpenCode baseline:

- interactive `opencode`
- `opencode run`
- streaming text responses
- tool-calling and file-edit loops
- multi-turn continuation
- the `small_model` path used by lightweight OpenCode tasks
- effective-config resolution in both `user` and `project` scope
- any required provider options, model options, or model headers needed for
  stable validated behavior

## Approved Public Records

The current shipped runtime exposes these validated models through the public
picker.

### Qwen3 235B A22B Instruct 2507 FP8

- display name: `Qwen3 235B A22B Instruct 2507 FP8`
- key: `qwen3-235b-a22b-instruct-2507-fp8`
- model id: `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- transport: `chat_completions`
- adapter package: `@ai-sdk/openai-compatible`
- recommended: `false`

### Kimi K2.6

- display name: `Kimi K2.6`
- key: `kimi-k2.6`
- model id: `moonshotai/Kimi-K2.6`
- transport: `chat_completions`
- adapter package: `@ai-sdk/openai-compatible`
- recommended: `true`

### MiniMax M2.7

- display name: `MiniMax M2.7`
- key: `minimax-m2.7`
- model id: `minimaxai/minimax-m2.7`
- transport: `chat_completions`
- adapter package: `@ai-sdk/openai-compatible`
- recommended: `false`

## Notes

- v1 explicitly writes both `model` and `small_model` to the same selected
  validated GonkaGate model
- v1 writes every validated curated model into `provider.gonkagate.models` so
  OpenCode's `/models` command can switch between managed GonkaGate models
- interactive setup keeps the public curated picker visible as broader public
  model choice lands without changing the UX contract
- future `/v1/responses` support requires a separate migration and revalidation
- broader public model choice stays gated on entries passing the same
  validation gate
