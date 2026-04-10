# Changelog

## [0.2.4](https://github.com/GonkaGate/opencode-setup/compare/v0.2.3...v0.2.4) (2026-04-10)


### Bug Fixes

* publish opencode-setup bin alias for npx ([5ce6b6d](https://github.com/GonkaGate/opencode-setup/commit/5ce6b6d3303227157e69d19e74fab3c8323deedb))
* publish opencode-setup bin alias for npx ([45e9d85](https://github.com/GonkaGate/opencode-setup/commit/45e9d8519ad25cbf388165b5cb47f42f360a6bf8))

## [0.2.3](https://github.com/GonkaGate/opencode-setup/compare/v0.2.2...v0.2.3) (2026-04-10)


### Bug Fixes

* ignore release changelog in prettier ([2c9724d](https://github.com/GonkaGate/opencode-setup/commit/2c9724d94d403adc75d8f35bb15a3c79a40e10eb))

## [0.2.2](https://github.com/GonkaGate/opencode-setup/compare/v0.2.1...v0.2.2) (2026-04-10)


### Bug Fixes

* route trusted publishing through release workflow ([82978b0](https://github.com/GonkaGate/opencode-setup/commit/82978b0f1a3149bacc7d2d1ca90ef4ecccbfcb33))

## [0.2.1](https://github.com/GonkaGate/opencode-setup/compare/v0.2.0...v0.2.1) (2026-04-10)

### Bug Fixes

- add API reference link to README ([ebedd07](https://github.com/GonkaGate/opencode-setup/commit/ebedd07faef4529015b5e5d8a8e6277e938f20e4))

## [0.2.0](https://github.com/GonkaGate/opencode-setup/compare/v0.1.0...v0.2.0) (2026-04-10)

### Features

- ship public opencode setup runtime ([7ae6dbd](https://github.com/GonkaGate/opencode-setup/commit/7ae6dbd26f8e5a7728cac0bcca6397bdb7f75cc6))

### Bug Fixes

- enforce LF checkouts for cross-platform CI ([ce88c90](https://github.com/GonkaGate/opencode-setup/commit/ce88c906e3fc6be9754f6c19f0365cd6c2a486a3))
- normalize Windows fake opencode pure mode ([2424474](https://github.com/GonkaGate/opencode-setup/commit/24244746b73c9b7d877f0f5688ca93fff482c95e))
- stabilize Windows CI host-specific tests ([d8351c7](https://github.com/GonkaGate/opencode-setup/commit/d8351c72ac44ce591f72a1d1b00ea72af412cb2e))
- support Windows opencode command shims ([4d73af9](https://github.com/GonkaGate/opencode-setup/commit/4d73af927d128a4e50f25f409f76b21a4d05f494))
- use prepared Windows command runner ([5594ff1](https://github.com/GonkaGate/opencode-setup/commit/5594ff1e4f063a5c6c67f8e821c8282d61ebca4c))
- use prepared Windows command runner ([b895035](https://github.com/GonkaGate/opencode-setup/commit/b8950354ea0648938e80d63a50a19783bdc92b86))

## [Unreleased]

### Changed

- publish the `opencode-setup` bin alias so `npx @gonkagate/opencode-setup`
  resolves on modern npm while keeping `gonkagate-opencode` as a compatible
  direct command
- replaced the scaffold-only CLI surface with the real shipped installer flow
- made rerun the official safe update path with transactional rollback for
  changed managed files
- normalized scope reruns so stale GonkaGate activation is removed from the old
  target when switching between `user` and `project`, but only when the
  activation value is installer-owned
- flipped repository docs and contract tests from scaffold-only wording to the
  shipped runtime truth
- aligned repository docs around dual effective-config verification for
  `OPENCODE_CONFIG_CONTENT`, the shipped interactive public picker behavior,
  and explicit current-versus-historical documentation labels
- made durable effective-config verification rely on `opencode debug config
--pure` as the final truth source, then attribute provider-gating blockers to
  locally inspectable `OPENCODE_CONFIG`, user config, project config, and
  file-based system managed config layers when possible
- split secret-binding provenance verification out from resolved-config
  comparison so `provider.gonkagate.options.apiKey` is enforced separately:
  `user_config` must own the canonical `{file:~/.gonkagate/opencode/api-key}`
  binding, higher-precedence durable layers are blocked if they redefine it,
  and inline `OPENCODE_CONFIG_CONTENT` secret-binding overrides are blocked in
  v1
- made durable blocker attribution within inspectable file-backed layers follow
  actual OpenCode precedence instead of whichever conflicting file happened to
  be inspected first
- added an inferred higher-precedence or managed blocker fallback when the
  resolved config proves `enabled_providers` or `disabled_providers` blocks
  `gonkagate` but no locally inspectable layer explains it
- made POSIX reruns repair drifted owner-only secret file and directory modes
  in place without rewriting unchanged secret contents or creating backups
- moved repo-local `opencode.json` rollback backups under
  `~/.gonkagate/opencode/backups/project-config` so project-scope rewrites no
  longer leave secret-bearing `.bak-*` files inside the repository
- added end-to-end native Windows support, including Windows-aware path
  resolution, Git Bash-style cwd normalization, and explicit native Windows
  contract coverage in tests and docs
- backed the native Windows support claim with native Windows CI plus
  Windows-runner integration coverage for fake `opencode` spawn and durable
  verification
- documented the native Windows managed-file security strategy as
  profile-scoped storage plus inherited user-profile ACLs instead of claiming
  portable POSIX-style `chmod` enforcement
- refreshed the audited upstream OpenCode release truth to stable
  `opencode-ai` `1.4.1` while keeping `1.4.0` as the minimum verified version
- renamed the managed install-state durability timestamp to
  `lastDurableSetupAt` while keeping legacy `lastSuccessfulSetupAt` readable as
  a backward-compatible migration path

### Added

- public curated model picker UI in the CLI, currently backed by one validated
  GonkaGate model
- structured machine-readable installer results with `success`, `blocked`, and
  `failed` statuses
- end-to-end install orchestration under `src/install/index.ts`
- Phase 5 rerun, rollback, and CLI contract tests
- automatic rollback support for late failures such as effective-config
  blockers, mismatches, and install-state write errors

## [0.1.0] - 2026-04-08

### Changed

- tightened the PRD and repository docs around OpenCode config precedence so
  `OPENCODE_CONFIG` is treated as an extra override layer, not as a
  replacement user-config target
- made effective-config verification an explicit requirement before installer
  success can be reported
- expanded the blocker contract so provider allow/deny lists like
  `enabled_providers` and `disabled_providers` must be checked before setup can
  be reported as successful
- narrowed the v1 Windows support contract to WSL-based OpenCode usage until
  native Windows path and permission behavior are validated
- updated the future `responses` migration contract to allow per-model adapter
  migration where upstream supports it
- expanded the curated model registry contract so validated entries can carry
  compatibility metadata and managed config fragments when OpenCode behavior
  depends on more than model id plus adapter package
- removed the interim implementation plan from the repo until the PRD is
  finalized, keeping the PRD as the only active planning contract
- updated the repository truth to reflect Phase 1 runtime foundations under
  `src/install/` while keeping the public CLI scaffold-only
- updated the repository truth again to reflect Phase 2 runtime foundations
  for safe secret intake plus managed secret and install-state persistence
  while keeping the public CLI scaffold-only
- updated the repository truth again to reflect Phase 3 runtime foundations
  for safe OpenCode config parse/merge/write and scope-aware managed config
  ownership while keeping the public CLI scaffold-only
- pinned the first internal validated GonkaGate model target to
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`

### Added

- initial repository scaffold for `@gonkagate/opencode-setup`
- package metadata, TypeScript build, and CI workflows
- placeholder CLI surface and contract tests
- product docs, security notes, troubleshooting guide, and implementation plan
- final PRD for the future OpenCode setup tool
- Phase 1 runtime foundations for dependency injection, OpenCode detection,
  path resolution, platform classification, and future installer seams
- Phase 2 runtime foundations for secret intake, managed secret storage,
  install-state persistence, timestamped backups, and owner-only permission
  handling where supported
- Phase 3 runtime foundations for JSON/JSONC config parsing, safe managed
  config writes, canonical GonkaGate provider shaping, and scope-aware user
  versus project ownership
- hermetic installer test harness and install-surface tests under `test/install`
- model validation reference documentation for the first approved internal
  validated entry
