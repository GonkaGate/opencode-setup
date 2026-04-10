import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";
import { formatOpencodeModelRef } from "../../src/constants/models.js";
import { resolveInstallContext } from "../../src/install/context.js";
import type { EffectiveConfigVerificationRequest } from "../../src/install/verify-effective.js";
import {
  isInstallErrorCode,
  type InstallError,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import {
  buildManagedProviderConfig,
  GONKAGATE_SECRET_FILE_REFERENCE,
  resolveValidatedModel,
} from "../../src/install/managed-provider-config.js";
import { formatRedactedDiagnosticValue } from "../../src/install/redact.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  verifyCurrentSessionEffectiveConfig,
  verifyEffectiveConfig,
} from "../../src/install/verify-effective.js";
import { createInstallIntegrationHarness } from "./harness.js";
import { createTestInstallDependencies } from "./test-deps.js";

const MODEL_KEY = "qwen3-235b-a22b-instruct-2507-fp8" as const;
const TEST_HOME_DIR = "/home/test";
const TEST_PROJECT_ROOT = "/workspace/repo";

function createCanonicalUserConfigContents(): string {
  return JSON.stringify(
    {
      provider: {
        gonkagate: {
          options: {
            apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
          },
        },
      },
    },
    null,
    2,
  ).concat("\n");
}

function createVerificationSeedFiles(
  userConfigPath: string,
  seedFiles: readonly { contents: string; path: string }[] = [],
  options: {
    seedCanonicalUserConfig?: boolean;
  } = {},
): readonly { contents: string; path: string }[] {
  if (options.seedCanonicalUserConfig === false) {
    return seedFiles;
  }

  if (seedFiles.some((seedFile) => seedFile.path === userConfigPath)) {
    return seedFiles;
  }

  return [
    {
      contents: createCanonicalUserConfigContents(),
      path: userConfigPath,
    },
    ...seedFiles,
  ];
}

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

function createResolvedConfigFixture(
  mutate?: (config: Record<string, unknown>) => void,
): string {
  const model = resolveValidatedModel(MODEL_KEY);
  const providerConfig = buildManagedProviderConfig(model);
  const resolvedConfig = {
    model: formatOpencodeModelRef(model),
    provider: {
      gonkagate: providerConfig,
    },
    small_model: formatOpencodeModelRef(model),
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

async function createVerificationFixture(
  options: {
    debugConfigPureOutput?: string;
    debugConfigPureOutputWhenInlineConfigPresent?: string;
    env?: NodeJS.ProcessEnv;
    seedCanonicalUserConfig?: boolean;
  } = {},
) {
  const harness = await createInstallIntegrationHarness();

  try {
    const repositoryRoot = await harness.createGitRepository("repo");

    await harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput:
        options.debugConfigPureOutput ?? createResolvedConfigFixture(),
      debugConfigPureOutputWhenInlineConfigPresent:
        options.debugConfigPureOutputWhenInlineConfigPresent,
      output: "opencode-ai 1.4.0",
    });

    const dependencies = harness.createDependencies({
      runtime: {
        cwd: repositoryRoot,
        env: options.env,
      },
    });
    const context = await resolveInstallContext(dependencies);

    if (options.seedCanonicalUserConfig !== false) {
      await dependencies.fs.mkdir(
        dirname(context.workspace.managedPaths.userConfigPath),
        { recursive: true },
      );
      await dependencies.fs.writeFile(
        context.workspace.managedPaths.userConfigPath,
        createCanonicalUserConfigContents(),
        {
          encoding: "utf8",
        },
      );
    }

    return {
      context,
      dependencies,
      harness,
    };
  } catch (error) {
    await harness.cleanup();
    throw error;
  }
}

function createStubVerificationFixture(
  options: {
    debugConfigPureOutput?: string;
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
    platform?: NodeJS.Platform;
    projectRoot?: string;
    seedCanonicalUserConfig?: boolean;
    seedFiles?: readonly { contents: string; path: string }[];
  } = {},
) {
  const projectRoot = options.projectRoot ?? TEST_PROJECT_ROOT;
  const homeDir = options.homeDir ?? TEST_HOME_DIR;
  const platform = options.platform ?? "linux";
  const managedPaths = resolveManagedPaths(homeDir, projectRoot, platform);
  const context = {
    opencode: {
      command: "opencode",
      installedVersion: "1.4.0",
      minimumSupportedVersion: "1.4.0",
      rawVersionOutput: "opencode-ai 1.4.0",
      support: "exact_minimum",
    },
    workspace: {
      insideGitRepository: true,
      managedPaths,
      projectRoot,
      resolvedCwd: projectRoot,
    },
  } satisfies EffectiveConfigVerificationRequest["context"];
  const dependencies = createTestInstallDependencies({
    commands: {
      kind: "override",
      value: {
        async run(command, args) {
          assert.equal(command, "opencode");
          assert.deepEqual(args, ["debug", "config", "--pure"]);

          return {
            exitCode: 0,
            signal: null,
            stderr: "",
            stdout:
              options.debugConfigPureOutput ?? createResolvedConfigFixture(),
          };
        },
      },
    },
    runtime: {
      cwd: projectRoot,
      env: options.env,
      homeDir,
      platform,
    },
    seedFiles: createVerificationSeedFiles(
      managedPaths.userConfigPath,
      options.seedFiles,
      {
        seedCanonicalUserConfig: options.seedCanonicalUserConfig,
      },
    ),
  });

  return {
    context,
    dependencies,
    managedPaths,
  };
}

test("verifyEffectiveConfig succeeds against the resolved config and uses the --pure production verification path", async () => {
  const fixture = await createVerificationFixture();

  try {
    const outcome = await verifyEffectiveConfig(
      {
        context: fixture.context,
        model: MODEL_KEY,
        scope: "user",
      },
      fixture.dependencies,
    );

    assert.equal(outcome.ok, true);
    assert.equal(outcome.resolvedMatch, true);
    assert.deepEqual(outcome.blockers, []);
    assert.equal(outcome.target.modelKey, MODEL_KEY);

    const invocations = await fixture.harness.readFakeOpenCodeInvocations();

    assert.equal(
      invocations.some(
        (args) =>
          args.length === 3 &&
          args[0] === "debug" &&
          args[1] === "config" &&
          args[2] === "--pure",
      ),
      true,
    );
    assert.equal(
      invocations.some(
        (args) =>
          args.length === 2 && args[0] === "debug" && args[1] === "config",
      ),
      false,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig ignores OPENCODE_CONFIG_CONTENT during durable verification", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
      (config) => {
        config.model = "openai/gpt-4.1";
      },
    ),
    env: {
      OPENCODE_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
    },
  });

  try {
    const outcome = await verifyEffectiveConfig(
      {
        context: fixture.context,
        model: MODEL_KEY,
        scope: "user",
      },
      fixture.dependencies,
    );

    assert.equal(outcome.ok, true);

    const invocations = await fixture.harness.readFakeOpenCodeInvocations();

    assert.equal(
      invocations.some(
        (args) =>
          args.length === 3 &&
          args[0] === "debug" &&
          args[1] === "config" &&
          args[2] === "--pure",
      ),
      true,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig keeps opencode debug config --pure as the durable success gate even when user_config contains a locally inspectable provider blocker", async () => {
  const fixture = createStubVerificationFixture({
    seedFiles: [
      {
        contents:
          '{\n  "enabled_providers": ["openai"],\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: resolveManagedPaths(TEST_HOME_DIR, TEST_PROJECT_ROOT)
          .userConfigPath,
      },
    ],
  });

  const outcome = await verifyEffectiveConfig(
    {
      context: fixture.context,
      model: MODEL_KEY,
      scope: "user",
    },
    fixture.dependencies,
  );

  assert.equal(outcome.ok, true);
});

test("verifyEffectiveConfig attributes enabled_providers durable blockers to user_config", async () => {
  const fixture = createStubVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.enabled_providers = ["openai"];
    }),
    seedFiles: [
      {
        contents:
          '{\n  "enabled_providers": ["openai"],\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: resolveManagedPaths(TEST_HOME_DIR, TEST_PROJECT_ROOT)
          .userConfigPath,
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.key, "enabled_providers");
      assert.equal(error.details.blockers[0]?.layer, "user_config");
    }),
  );
});

test("verifyEffectiveConfig attributes overlapping managed keys to project_config above OPENCODE_CONFIG", async () => {
  const fixture = createStubVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.model = "openai/gpt-4.1";
    }),
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents: '{\n  "model": "anthropic/claude-sonnet-4-5"\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
      {
        contents: '{\n  "model": "openai/gpt-4.1"\n}\n',
        path: resolveManagedPaths(TEST_HOME_DIR, TEST_PROJECT_ROOT)
          .projectConfigPath,
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.key, "model");
      assert.equal(error.details.blockers[0]?.layer, "project_config");
    }),
  );
});

test("verifyEffectiveConfig blocks when OPENCODE_CONFIG overrides only provider.gonkagate.options.apiKey", async () => {
  const fixture = createStubVerificationFixture({
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{env:GONKAGATE_OVERRIDE}"\n      }\n    }\n  }\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(
        error.details.blockers[0]?.key,
        "provider.gonkagate.options.apiKey",
      );
      assert.equal(error.details.blockers[0]?.layer, "OPENCODE_CONFIG");
    }),
  );
});

test("verifyEffectiveConfig attributes disabled_providers durable blockers to file-based system managed config when it is locally inspectable", async () => {
  const fixture = createStubVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.disabled_providers = ["gonkagate"];
    }),
    env: {
      ProgramData: "C:\\ProgramData",
    },
    platform: "win32",
    projectRoot: "C:\\workspace\\repo",
    homeDir: "C:\\Users\\test-user",
    seedFiles: [
      {
        contents: '{\n  "disabled_providers": ["gonkagate"]\n}\n',
        path: "C:\\ProgramData\\opencode\\opencode.json",
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.key, "disabled_providers");
      assert.equal(error.details.blockers[0]?.layer, "system_managed_config");
    }),
  );
});

test("verifyEffectiveConfig blocks when a file-based system managed config overrides only provider.gonkagate.options.apiKey", async () => {
  const fixture = createStubVerificationFixture({
    env: {
      ProgramData: "C:\\ProgramData",
    },
    platform: "win32",
    projectRoot: "C:\\workspace\\repo",
    homeDir: "C:\\Users\\test-user",
    seedFiles: [
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{env:GONKAGATE_OVERRIDE}"\n      }\n    }\n  }\n}\n',
        path: "C:\\ProgramData\\opencode\\opencode.json",
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(
        error.details.blockers[0]?.key,
        "provider.gonkagate.options.apiKey",
      );
      assert.equal(error.details.blockers[0]?.layer, "system_managed_config");
    }),
  );
});

test("verifyEffectiveConfig attributes overlapping managed keys to file-based system managed config above project config and OPENCODE_CONFIG", async () => {
  const fixture = createStubVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.model = "openai/gpt-4.1";
    }),
    env: {
      OPENCODE_CONFIG: "/workspace/overrides/opencode.json",
    },
    seedFiles: [
      {
        contents: '{\n  "model": "anthropic/claude-sonnet-4-5"\n}\n',
        path: "/workspace/overrides/opencode.json",
      },
      {
        contents: '{\n  "model": "anthropic/claude-sonnet-4-5"\n}\n',
        path: resolveManagedPaths(TEST_HOME_DIR, TEST_PROJECT_ROOT)
          .projectConfigPath,
      },
      {
        contents: '{\n  "model": "openai/gpt-4.1"\n}\n',
        path: "/etc/opencode/opencode.json",
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.key, "model");
      assert.equal(error.details.blockers[0]?.layer, "system_managed_config");
    }),
  );
});

test("verifyEffectiveConfig returns an inferred higher-precedence blocker when resolved provider gating cannot be attributed to a locally inspectable layer", async () => {
  const fixture = createStubVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.disabled_providers = ["gonkagate"];
    }),
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.key, "disabled_providers");
      assert.equal(
        error.details.blockers[0]?.layer,
        "inferred_higher_precedence",
      );
      assert.match(
        error.details.blockers[0]?.reason ?? "",
        /no locally inspectable/i,
      );
    }),
  );
});

test("verifyEffectiveConfig blocks when user_config does not own the canonical secret binding", async () => {
  const fixture = createStubVerificationFixture({
    seedCanonicalUserConfig: false,
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(
        error.details.blockers[0]?.key,
        "provider.gonkagate.options.apiKey",
      );
      assert.equal(error.details.blockers[0]?.layer, "user_config");
    }),
  );
});

test("verifyEffectiveConfig blocks when project scope finds a repo-local GonkaGate secret binding", async () => {
  const fixture = createStubVerificationFixture({
    seedFiles: [
      {
        contents:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
        path: resolveManagedPaths(TEST_HOME_DIR, TEST_PROJECT_ROOT)
          .projectConfigPath,
      },
    ],
  });

  await assert.rejects(
    () =>
      verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "project",
        },
        fixture.dependencies,
      ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(
        error.details.blockers[0]?.key,
        "provider.gonkagate.options.apiKey",
      );
      assert.equal(error.details.blockers[0]?.layer, "project_config");
    }),
  );
});

test("verifyCurrentSessionEffectiveConfig allows an identical inline override", async () => {
  const fixture = await createVerificationFixture({
    env: {
      OPENCODE_CONFIG_CONTENT: `{\n  "model": "${formatOpencodeModelRef(MODEL_KEY)}"\n}\n`,
    },
  });

  try {
    const outcome = await verifyCurrentSessionEffectiveConfig(
      {
        context: fixture.context,
        model: MODEL_KEY,
        scope: "user",
      },
      fixture.dependencies,
    );

    assert.equal(outcome.ok, true);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyCurrentSessionEffectiveConfig blocks when OPENCODE_CONFIG_CONTENT defines provider.gonkagate.options.apiKey, even with the canonical file binding", async () => {
  const fixture = await createVerificationFixture({
    env: {
      OPENCODE_CONFIG_CONTENT:
        '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
    },
  });

  try {
    await assert.rejects(
      () =>
        verifyCurrentSessionEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_blocked", (error) => {
        assert.equal(
          error.details.blockers[0]?.key,
          "provider.gonkagate.options.apiKey",
        );
        assert.equal(
          error.details.blockers[0]?.layer,
          "OPENCODE_CONFIG_CONTENT",
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyCurrentSessionEffectiveConfig blocks when an inline model override changes the current session", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
      (config) => {
        config.model = "openai/gpt-4.1";
      },
    ),
    env: {
      OPENCODE_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
    },
  });

  try {
    await assert.rejects(
      () =>
        verifyCurrentSessionEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_blocked", (error) => {
        assert.equal(error.details.blockers[0]?.key, "model");
        assert.equal(
          error.details.blockers[0]?.layer,
          "OPENCODE_CONFIG_CONTENT",
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyCurrentSessionEffectiveConfig preserves enabled_providers blockers from the inline layer", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
      (config) => {
        config.model = "openai/gpt-4.1";
      },
    ),
    env: {
      OPENCODE_CONFIG_CONTENT:
        '{\n  "enabled_providers": ["openai"],\n  "model": "openai/gpt-4.1"\n}\n',
    },
  });

  try {
    await assert.rejects(
      () =>
        verifyCurrentSessionEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_blocked", (error) => {
        assert.equal(error.details.blockers[0]?.key, "enabled_providers");
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyCurrentSessionEffectiveConfig preserves disabled_providers blockers from the inline layer", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
      (config) => {
        config.provider = {};
      },
    ),
    env: {
      OPENCODE_CONFIG_CONTENT: '{\n  "disabled_providers": ["gonkagate"]\n}\n',
    },
  });

  try {
    await assert.rejects(
      () =>
        verifyCurrentSessionEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_blocked", (error) => {
        assert.equal(error.details.blockers[0]?.key, "disabled_providers");
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyCurrentSessionEffectiveConfig fails when the inline layer is invalid JSON or JSONC", async () => {
  const fixture = await createVerificationFixture({
    env: {
      OPENCODE_CONFIG_CONTENT: '{\n  "model": ,\n}\n',
    },
  });

  try {
    await assert.rejects(
      () =>
        verifyCurrentSessionEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_layer_parse_failed", (error) => {
        assert.equal(error.details.layer, "OPENCODE_CONFIG_CONTENT");
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a resolved model mismatch", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.model = "openai/gpt-4.1";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some((mismatch) => mismatch.key === "model"),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a resolved small_model mismatch", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.small_model = "openai/gpt-4.1-mini";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) => mismatch.key === "small_model",
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a missing provider.gonkagate block", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.provider = {};
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) => mismatch.key === "provider.gonkagate",
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test(
  "verifyEffectiveConfig works through the Windows fake launcher on native Windows hosts",
  { skip: process.platform !== "win32" },
  async () => {
    const fixture = await createVerificationFixture();

    try {
      const outcome = await verifyEffectiveConfig(
        {
          context: fixture.context,
          model: MODEL_KEY,
          scope: "user",
        },
        fixture.dependencies,
      );

      assert.equal(outcome.ok, true);

      const invocations = await fixture.harness.readFakeOpenCodeInvocations();

      assert.equal(
        invocations.some(
          (args) =>
            args.length === 3 &&
            args[0] === "debug" &&
            args[1] === "config" &&
            args[2] === "--pure",
        ),
        true,
      );
    } finally {
      await fixture.harness.cleanup();
    }
  },
);

test("verifyEffectiveConfig detects a wrong resolved adapter package", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      const provider = (config.provider as Record<string, unknown>)
        .gonkagate as Record<string, unknown>;
      provider.npm = "@ai-sdk/openai";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) => mismatch.key === "provider.gonkagate.npm",
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a wrong resolved transport", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      const provider = (config.provider as Record<string, unknown>)
        .gonkagate as Record<string, unknown>;
      provider.api = "responses";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) => mismatch.key === "provider.gonkagate.api",
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a wrong resolved base URL", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      const provider = (config.provider as Record<string, unknown>)
        .gonkagate as Record<string, unknown>;
      (provider.options as Record<string, unknown>).baseURL =
        "https://example.invalid/v1";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) => mismatch.key === "provider.gonkagate.options.baseURL",
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig detects a missing curated model entry under provider.gonkagate.models", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      const provider = (config.provider as Record<string, unknown>)
        .gonkagate as Record<string, unknown>;
      provider.models = {};
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        assert.equal(
          error.details.mismatches.some(
            (mismatch) =>
              mismatch.key === `provider.gonkagate.models.${MODEL_KEY}`,
          ),
          true,
        );
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig rejects invalid resolved-config payloads without echoing raw output", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: '{\n  "model": ,\n}\n',
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_parse_failed", (error) => {
        assert.doesNotMatch(error.message, /"model":/);
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("verifyEffectiveConfig redacts expanded secrets in mismatch diagnostics", async () => {
  const fixture = await createVerificationFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      const provider = (config.provider as Record<string, unknown>)
        .gonkagate as Record<string, unknown>;
      provider.npm = "@ai-sdk/openai";
      (provider.options as Record<string, unknown>).apiKey = "gp-live-secret";
    }),
  });

  try {
    await assert.rejects(
      () =>
        verifyEffectiveConfig(
          {
            context: fixture.context,
            model: MODEL_KEY,
            scope: "user",
          },
          fixture.dependencies,
        ),
      expectInstallErrorCode("effective_config_mismatch", (error) => {
        const providerSummary = error.details.mismatches.find(
          (mismatch) => mismatch.key === "provider.gonkagate",
        );

        assert.ok(providerSummary);
        const formattedActualValue = formatRedactedDiagnosticValue(
          providerSummary.actualValue,
        );

        assert.doesNotMatch(formattedActualValue, /gp-live-secret/);
        assert.match(formattedActualValue, /\[REDACTED\]/);
      }),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("the fake opencode harness also supports plain debug config invocations for future verification-policy seams", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    await harness.installFakeOpenCodeOnPath({
      debugConfigOutput: '{\n  "mode": "plain"\n}\n',
      output: "opencode-ai 1.4.0",
    });

    const dependencies = harness.createDependencies();
    const result = await dependencies.commands.run(
      "opencode",
      ["debug", "config"],
      {
        cwd: dependencies.runtime.cwd,
        env: dependencies.runtime.env,
      },
    );

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /"mode": "plain"/);

    const invocations = await harness.readFakeOpenCodeInvocations();

    assert.equal(
      invocations.some(
        (args) =>
          args.length === 2 && args[0] === "debug" && args[1] === "config",
      ),
      true,
    );
  } finally {
    await harness.cleanup();
  }
});
