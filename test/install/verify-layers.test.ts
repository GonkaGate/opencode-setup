import assert from "node:assert/strict";
import test from "node:test";
import { GONKAGATE_PROVIDER_ID } from "../../src/constants/gateway.js";
import {
  inspectVerificationLayers,
  inspectSecretBindingVerificationLayers,
  selectHighestPrecedenceInspectableBlockers,
} from "../../src/install/verify-layers.js";
import {
  isInstallErrorCode,
  type InstallError,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import { createTestInstallDependencies } from "./test-deps.js";

const HOME_DIR = "/home/test";
const PROJECT_ROOT = "/workspace/repo";
const MANAGED_PATHS = resolveManagedPaths(HOME_DIR, PROJECT_ROOT);

function expectInstallErrorCode<TCode extends InstallErrorCode>(
  code: TCode,
  assertError: (error: InstallError<TCode>) => void = () => {},
): (error: unknown) => boolean {
  return (error: unknown) => {
    if (!isInstallErrorCode(error, code)) {
      return false;
    }

    assertError(error);
    return true;
  };
}

async function inspectLayers(
  options: {
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
    platform?: NodeJS.Platform;
    projectRoot?: string;
    scope?: "project" | "user";
    seedFiles?: readonly { contents: string; path: string }[];
  } = {},
) {
  const homeDir = options.homeDir ?? HOME_DIR;
  const projectRoot = options.projectRoot ?? PROJECT_ROOT;

  return await inspectVerificationLayers(
    {
      managedPaths: resolveManagedPaths(
        homeDir,
        projectRoot,
        options.platform ?? "linux",
      ),
      providerId: GONKAGATE_PROVIDER_ID,
      scope: options.scope ?? "user",
    },
    createTestInstallDependencies({
      runtime: {
        env: options.env ?? {},
        homeDir,
        platform: options.platform,
      },
      seedFiles: options.seedFiles,
    }),
  );
}

async function inspectSecretBindingLayers(
  options: {
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
    platform?: NodeJS.Platform;
    projectRoot?: string;
    scope?: "project" | "user";
    seedFiles?: readonly { contents: string; path: string }[];
  } = {},
) {
  const homeDir = options.homeDir ?? HOME_DIR;
  const projectRoot = options.projectRoot ?? PROJECT_ROOT;

  return await inspectSecretBindingVerificationLayers(
    {
      managedPaths: resolveManagedPaths(
        homeDir,
        projectRoot,
        options.platform ?? "linux",
      ),
      providerId: GONKAGATE_PROVIDER_ID,
      scope: options.scope ?? "user",
    },
    createTestInstallDependencies({
      runtime: {
        env: options.env ?? {},
        homeDir,
        platform: options.platform,
      },
      seedFiles: options.seedFiles,
    }),
  );
}

test("inspectVerificationLayers returns no blockers when higher-precedence layers do not overlap GonkaGate-managed keys", async () => {
  const blockers = await inspectLayers({
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents: '{\n  "theme": "midnight"\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
    ],
  });

  assert.deepEqual(blockers, []);
});

test("selectHighestPrecedenceInspectableBlockers prefers project config over OPENCODE_CONFIG for the same key", () => {
  assert.deepEqual(
    selectHighestPrecedenceInspectableBlockers([
      {
        key: "model",
        layer: "OPENCODE_CONFIG",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
      {
        key: "model",
        layer: "project_config",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
    ]),
    [
      {
        key: "model",
        layer: "project_config",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
    ],
  );
});

test("selectHighestPrecedenceInspectableBlockers prefers file-based system managed config above project and OPENCODE_CONFIG", () => {
  assert.deepEqual(
    selectHighestPrecedenceInspectableBlockers([
      {
        key: "model",
        layer: "project_config",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
      {
        key: "model",
        layer: "system_managed_config",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
      {
        key: "model",
        layer: "OPENCODE_CONFIG",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
    ]),
    [
      {
        key: "model",
        layer: "system_managed_config",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
    ],
  );
});

test("inspectVerificationLayers blocks overlapping OPENCODE_CONFIG managed keys", async () => {
  const blockers = await inspectLayers({
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents: '{\n  "model": "anthropic/claude-sonnet"\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "model",
      layer: "OPENCODE_CONFIG",
      reason:
        "Higher-precedence config overlaps the GonkaGate-managed model selection.",
    },
  ]);
});

test("inspectVerificationLayers blocks enabled_providers exclusions from project config during user scope", async () => {
  const blockers = await inspectLayers({
    seedFiles: [
      {
        contents: '{\n  "enabled_providers": ["openai"]\n}\n',
        path: MANAGED_PATHS.projectConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "enabled_providers",
      layer: "project_config",
      reason: "enabled_providers does not include gonkagate.",
    },
  ]);
});

test("inspectVerificationLayers blocks enabled_providers exclusions from user config", async () => {
  const blockers = await inspectLayers({
    seedFiles: [
      {
        contents: '{\n  "enabled_providers": ["openai"]\n}\n',
        path: MANAGED_PATHS.userConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "enabled_providers",
      layer: "user_config",
      reason: "enabled_providers does not include gonkagate.",
    },
  ]);
});

test("inspectVerificationLayers gives disabled_providers priority over enabled_providers", async () => {
  const blockers = await inspectLayers({
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents:
          '{\n  "enabled_providers": ["gonkagate"],\n  "disabled_providers": ["gonkagate"]\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "disabled_providers",
      layer: "OPENCODE_CONFIG",
      reason: "disabled_providers excludes gonkagate.",
    },
  ]);
});

test("inspectVerificationLayers treats project config activation overrides as blockers during user scope", async () => {
  const blockers = await inspectLayers({
    seedFiles: [
      {
        contents: '{\n  "small_model": "openai/gpt-4.1-mini"\n}\n',
        path: MANAGED_PATHS.projectConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "small_model",
      layer: "project_config",
      reason:
        "Higher-precedence config overlaps the GonkaGate-managed small_model selection.",
    },
  ]);
});

test("inspectVerificationLayers inspects file-based system managed config layers when they are locally inspectable", async () => {
  const blockers = await inspectLayers({
    env: {
      ProgramData: "C:\\ProgramData",
    },
    homeDir: "C:\\Users\\test-user",
    platform: "win32",
    projectRoot: "C:\\workspace\\repo",
    seedFiles: [
      {
        contents: '{\n  "disabled_providers": ["gonkagate"]\n}\n',
        path: "C:\\ProgramData\\opencode\\opencode.json",
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "disabled_providers",
      layer: "system_managed_config",
      reason: "disabled_providers excludes gonkagate.",
    },
  ]);
});

test("inspectVerificationLayers ignores project-managed activation keys during project scope while still checking provider blockers", async () => {
  const blockers = await inspectLayers({
    scope: "project",
    seedFiles: [
      {
        contents:
          '{\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",\n  "small_model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8"\n}\n',
        path: MANAGED_PATHS.projectConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, []);
});

test("inspectVerificationLayers ignores OPENCODE_CONFIG_CONTENT because durable verification handles inline overrides separately", async () => {
  const blockers = await inspectLayers({
    env: {
      OPENCODE_CONFIG_CONTENT:
        '{\n  "provider": {\n    "gonkagate": {\n      "name": "Override"\n    }\n  }\n}\n',
    },
  });

  assert.deepEqual(blockers, []);
});

test("inspectSecretBindingVerificationLayers requires user_config to own the canonical GonkaGate secret binding", async () => {
  const blockers = await inspectSecretBindingLayers();

  assert.deepEqual(blockers, [
    {
      key: "provider.gonkagate.options.apiKey",
      layer: "user_config",
      reason:
        "user_config must own provider.gonkagate.options.apiKey with the canonical {file:~/.gonkagate/opencode/api-key} binding.",
    },
  ]);
});

test("inspectSecretBindingVerificationLayers blocks repo-local GonkaGate secret binding during project scope", async () => {
  const blockers = await inspectSecretBindingLayers({
    scope: "project",
    seedFiles: [
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: MANAGED_PATHS.projectConfigPath,
      },
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: MANAGED_PATHS.userConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "provider.gonkagate.options.apiKey",
      layer: "project_config",
      reason:
        "project_config must not define provider.gonkagate.options.apiKey because project scope stays secret-free and commit-safe.",
    },
  ]);
});

test("inspectSecretBindingVerificationLayers blocks OPENCODE_CONFIG secret-binding overrides", async () => {
  const blockers = await inspectSecretBindingLayers({
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{env:GONKAGATE_OVERRIDE}"\n      }\n    }\n  }\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: MANAGED_PATHS.userConfigPath,
      },
    ],
  });

  assert.deepEqual(blockers, [
    {
      key: "provider.gonkagate.options.apiKey",
      layer: "OPENCODE_CONFIG",
      reason:
        "Higher-precedence config must not override the installer-managed GonkaGate secret binding.",
    },
  ]);
});

test("inspectVerificationLayers rejects invalid JSON or JSONC in higher-precedence layers as typed install errors", async () => {
  await assert.rejects(
    () =>
      inspectLayers({
        env: {
          OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
        },
        seedFiles: [
          {
            contents: '{\n  "model": ,\n}\n',
            path: "/workspace/overrides/opencode.json",
          },
        ],
      }),
    expectInstallErrorCode("effective_config_layer_parse_failed", (error) => {
      assert.equal(error.details.layer, "OPENCODE_CONFIG");
    }),
  );
});
