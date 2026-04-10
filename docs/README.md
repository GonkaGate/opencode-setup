# Documentation Index

## Current Truth

This repository currently contains:

- the shipped installer runtime for `@gonkagate/opencode-setup`
- the public CLI, curated model picker UI, and rerun-safe rollback behavior
- Phase 1 through Phase 5 runtime implementation under `src/install/`
- CI and release tooling
- the final product contract
- docs and tests for the shipped installer

This repository does not currently contain:

- arbitrary custom model-id support
- arbitrary custom base URL support
- `/v1/responses` support

## Current Contract Documents

- [OpenCode Setup PRD](./specs/opencode-setup-prd/spec.md)
- [Architecture Decisions](./architecture-decisions.md)
- [Model Validation](./model-validation.md)

## Operational Guides

- [How It Works](./how-it-works.md)
- [Security Notes](./security.md)
- [Troubleshooting](./troubleshooting.md)

## Historical Context

- [Implementation Plan](./implementation-plan.md) - historical execution record
  from the scaffold-to-runtime transition; not the current product contract

## Notes

- the product source of truth is the PRD
- the architecture decisions and model validation docs describe the current
  shipped runtime contract
- historical documents must be labeled explicitly so scaffold-era planning
  language is not mistaken for current repository truth
- `README.md` remains the public repository entrypoint
- `AGENTS.md` remains the repository operating contract
