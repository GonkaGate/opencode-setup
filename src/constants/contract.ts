export const CONTRACT_METADATA = {
  binName: "gonkagate-opencode",
  binPath: "bin/gonkagate-opencode.js",
  cliVersion: "0.2.2", // x-release-please-version
  curatedRegistryPublished: true,
  packageName: "@gonkagate/opencode-setup",
  publicEntrypoint: "npx @gonkagate/opencode-setup",
  publicState:
    "Production installer runtime shipped. The public CLI now configures OpenCode end to end.",
  verifiedOpencode: {
    checkedAt: "2026-04-09",
    minVersion: "1.4.0",
  },
} as const;
