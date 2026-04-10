# Model Validation

This document records the minimum validation gate for curated GonkaGate models
and the first approved public validated model in the shipped runtime.

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

## Approved Public Record

The current shipped runtime exposes this validated model through the public
picker:

- display name: `Qwen3 235B A22B Instruct 2507 FP8`
- key: `qwen3-235b-a22b-instruct-2507-fp8`
- model id: `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- transport: `chat_completions`
- adapter package: `@ai-sdk/openai-compatible`
- recommended: `true`

## Notes

- v1 explicitly writes both `model` and `small_model` to the same selected
  validated GonkaGate model
- interactive setup keeps the public curated picker visible even while this
  approved public record contains one validated choice, so broader public model
  choice can land later without changing the UX contract
- future `/v1/responses` support requires a separate migration and revalidation
- broader public model choice stays out of scope until more entries pass the
  same validation gate
