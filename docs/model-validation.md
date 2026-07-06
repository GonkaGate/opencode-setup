# Model Catalog Source

`@gonkagate/opencode-setup` does not publish a checked-in GonkaGate model
catalog.

During setup, after collecting the GonkaGate API key, the installer calls:

```http
GET https://api.gonkagate.com/v1/models
Authorization: Bearer <GonkaGate API key>
```

The OpenAI-compatible response is the source of truth for:

- interactive model picker choices
- `--model` validation
- `--yes` default model selection
- `provider.gonkagate.models` config writes
- effective-config verification

The installer accepts `{ data: [{ id: string, name?: string }] }`, dedupes
model ids, uses the first returned model as the default, and rejects empty or
invalid responses. Adding or removing a GonkaGate model should not require a
repository update.

The runtime still targets `chat/completions` with
`https://api.gonkagate.com/v1` today. Future `/v1/responses` support should be
added as a migration without changing the provider id.
