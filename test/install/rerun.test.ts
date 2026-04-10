import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { formatOpencodeModelRef } from "../../src/constants/models.js";
import { runInstallFlow } from "../../src/install/index.js";
import type { InstallDependencies } from "../../src/install/deps.js";
import {
  resolveManagedPaths,
  resolveProjectConfigBackupDirectory,
} from "../../src/install/paths.js";
import {
  buildManagedProviderConfig,
  resolveValidatedModel,
} from "../../src/install/managed-provider-config.js";
import { createInstallIntegrationHarness } from "./harness.js";

const MODEL_KEY = "qwen3-235b-a22b-instruct-2507-fp8" as const;
const MODEL_REF = formatOpencodeModelRef(MODEL_KEY);
const SECOND_RUN_BACKUP_TIMESTAMP = "20260409T110000Z";

type InstallScope = "project" | "user";
type InstallerFixture = Awaited<ReturnType<typeof createInstallerFixture>>;
type ManagedStateField = keyof ManagedStateSnapshot;

interface ManagedStateSnapshot {
  installState?: string;
  projectConfig?: string;
  secret?: string;
  userConfig?: string;
}

function createResolvedConfigFixture(
  mutate?: (config: Record<string, unknown>) => void,
): string {
  const model = resolveValidatedModel(MODEL_KEY);
  const providerConfig = buildManagedProviderConfig(model);
  const resolvedConfig = {
    model: MODEL_REF,
    provider: {
      gonkagate: providerConfig,
    },
    small_model: MODEL_REF,
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

async function createInstallerFixture(
  options: {
    debugConfigPureOutput?: string;
  } = {},
) {
  const harness = await createInstallIntegrationHarness();

  try {
    const repositoryRoot = await harness.createGitRepository("repo");

    await harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput:
        options.debugConfigPureOutput ?? createResolvedConfigFixture(),
      output: "opencode-ai 1.4.0",
    });

    return {
      harness,
      managedPaths: resolveManagedPaths(harness.homeDir, repositoryRoot),
      repositoryRoot,
    };
  } catch (error) {
    await harness.cleanup();
    throw error;
  }
}

function createRunDependencies(
  fixture: InstallerFixture,
  options: {
    clockIso: string;
    env?: NodeJS.ProcessEnv;
  },
) {
  return fixture.harness.createDependencies({
    clock: {
      now: () => new Date(options.clockIso),
    },
    runtime: {
      cwd: fixture.repositoryRoot,
      env: {
        GONKAGATE_API_KEY: "gp-rerun-secret",
        ...options.env,
      },
    },
  });
}

async function readText(path: string): Promise<string> {
  return await readFile(path, "utf8");
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readText(path)) as Record<string, unknown>;
}

async function readOptionalText(
  fixture: InstallerFixture,
  path: string,
): Promise<string | undefined> {
  const dependencies = fixture.harness.createDependencies();

  if (!(await dependencies.fs.pathExists(path))) {
    return undefined;
  }

  return await readText(path);
}

async function snapshotManagedState(
  fixture: InstallerFixture,
): Promise<ManagedStateSnapshot> {
  return {
    installState: await readOptionalText(
      fixture,
      fixture.managedPaths.installStatePath,
    ),
    projectConfig: await readOptionalText(
      fixture,
      fixture.managedPaths.projectConfigPath,
    ),
    secret: await readOptionalText(fixture, fixture.managedPaths.secretPath),
    userConfig: await readOptionalText(
      fixture,
      fixture.managedPaths.userConfigPath,
    ),
  };
}

async function assertManagedStateUnchanged(
  fixture: InstallerFixture,
  before: ManagedStateSnapshot,
  fields: readonly ManagedStateField[],
): Promise<void> {
  const after = await snapshotManagedState(fixture);

  for (const field of fields) {
    assert.equal(after[field], before[field]);
  }
}

async function assertBackupMissing(
  fixture: InstallerFixture,
  path: string,
  backupTimestamp: string,
): Promise<void> {
  assert.equal(
    await fixture.harness
      .createDependencies()
      .fs.pathExists(`${path}.bak-${backupTimestamp}`),
    false,
  );
}

async function assertPathExists(
  fixture: InstallerFixture,
  path: string,
): Promise<void> {
  assert.equal(
    await fixture.harness.createDependencies().fs.pathExists(path),
    true,
  );
}

function createInstallRequest(scope: InstallScope) {
  return {
    apiKeyStdin: false,
    scope,
    yes: false,
  } as const;
}

function createExternalProjectBackupPath(
  fixture: InstallerFixture,
  clockTimestamp: string,
): string {
  const backupDirectoryPath = resolveProjectConfigBackupDirectory(
    fixture.managedPaths,
  );
  const pathHash = createHash("sha256")
    .update(fixture.managedPaths.projectConfigPath)
    .digest("hex")
    .slice(0, 12);
  const pathSeparator = backupDirectoryPath.includes("\\") ? "\\" : "/";

  return `${backupDirectoryPath}${pathSeparator}opencode.json.${pathHash}.bak-${clockTimestamp}`;
}

async function runScopedInstall(
  fixture: InstallerFixture,
  scope: InstallScope,
  options: {
    clockIso: string;
    dependencies?: InstallDependencies;
    env?: NodeJS.ProcessEnv;
  },
) {
  return await runInstallFlow(
    createInstallRequest(scope),
    options.dependencies ??
      createRunDependencies(fixture, {
        clockIso: options.clockIso,
        env: options.env,
      }),
  );
}

async function assertActivationLocation(
  fixture: InstallerFixture,
  scope: InstallScope,
): Promise<void> {
  const userConfig = await readJson(fixture.managedPaths.userConfigPath);
  const projectConfig = await readJson(fixture.managedPaths.projectConfigPath);

  if (scope === "user") {
    assert.equal(userConfig.model, MODEL_REF);
    assert.equal(userConfig.small_model, MODEL_REF);
    assert.equal(projectConfig.model, undefined);
    assert.equal(projectConfig.small_model, undefined);
    return;
  }

  assert.equal(userConfig.model, undefined);
  assert.equal(userConfig.small_model, undefined);
  assert.equal(projectConfig.model, MODEL_REF);
  assert.equal(projectConfig.small_model, MODEL_REF);
}

test("no-op rerun in user scope keeps managed config stable and skips new backups for unchanged secret/config", async () => {
  const fixture = await createInstallerFixture();

  try {
    const firstResult = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    assert.equal(firstResult.status, "success");

    const beforeManagedState = await snapshotManagedState(fixture);
    const beforeState = await readJson(fixture.managedPaths.installStatePath);

    const secondResult = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(secondResult.status, "success");
    await assertManagedStateUnchanged(fixture, beforeManagedState, [
      "secret",
      "userConfig",
    ]);
    await assertBackupMissing(
      fixture,
      fixture.managedPaths.secretPath,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );
    await assertBackupMissing(
      fixture,
      fixture.managedPaths.userConfigPath,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );
    assert.equal(beforeState.lastDurableSetupAt, "2026-04-09T10:00:00.000Z");
    assert.equal(
      (await readJson(fixture.managedPaths.installStatePath))
        .lastDurableSetupAt,
      "2026-04-09T11:00:00.000Z",
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("no-op rerun in user scope repairs drifted POSIX secret permissions without creating a new backup", async () => {
  const fixture = await createInstallerFixture();

  try {
    const firstResult = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    assert.equal(firstResult.status, "success");

    await chmod(fixture.managedPaths.secretPath, 0o644);
    await chmod(dirname(fixture.managedPaths.secretPath), 0o755);

    const beforeManagedState = await snapshotManagedState(fixture);

    const secondResult = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(secondResult.status, "success");
    await assertManagedStateUnchanged(fixture, beforeManagedState, ["secret"]);
    await assertBackupMissing(
      fixture,
      fixture.managedPaths.secretPath,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );
    assert.equal(
      (await stat(fixture.managedPaths.secretPath)).mode & 0o777,
      0o600,
    );
    assert.equal(
      (await stat(dirname(fixture.managedPaths.secretPath))).mode & 0o777,
      0o700,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("repeated project-scope reruns stay stable while refreshing install-state only", async () => {
  const fixture = await createInstallerFixture();

  try {
    const firstResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    assert.equal(firstResult.status, "success");

    const beforeManagedState = await snapshotManagedState(fixture);

    const secondResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(secondResult.status, "success");
    await assertManagedStateUnchanged(fixture, beforeManagedState, [
      "projectConfig",
      "userConfig",
    ]);
    await assertBackupMissing(
      fixture,
      fixture.managedPaths.projectConfigPath,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("rerunning from user scope to project scope normalizes both targets to the new ownership model", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const result = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(result.status, "success");
    await assertActivationLocation(fixture, "project");
  } finally {
    await fixture.harness.cleanup();
  }
});

test("rerunning from project scope to user scope removes repo-local activation and restores user-level activation", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const result = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(result.status, "success");
    await assertActivationLocation(fixture, "user");
  } finally {
    await fixture.harness.cleanup();
  }
});

test("pre-durable higher-precedence reruns roll managed files back to the last successful state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const beforeManagedState = await snapshotManagedState(fixture);
    const overrideConfigPath = `${fixture.repositoryRoot}/override-opencode.json`;

    await writeFile(
      overrideConfigPath,
      '{\n  "model": "openai/gpt-4.1"\n}\n',
      "utf8",
    );

    await fixture.harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput: createResolvedConfigFixture((config) => {
        config.model = "openai/gpt-4.1";
      }),
      output: "opencode-ai 1.4.0",
    });

    const blockedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      env: {
        OPENCODE_CONFIG: overrideConfigPath,
      },
    });

    assert.equal(blockedResult.status, "blocked");
    await assertManagedStateUnchanged(fixture, beforeManagedState, [
      "installState",
      "projectConfig",
      "secret",
      "userConfig",
    ]);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("current-session blockers after durable verification keep managed writes and refresh install-state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    await fixture.harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput: createResolvedConfigFixture(),
      debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
        (config) => {
          config.model = "openai/gpt-4.1";
        },
      ),
      output: "opencode-ai 1.4.0",
    });

    const blockedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      env: {
        OPENCODE_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
      },
    });

    assert.equal(blockedResult.status, "blocked");
    await assertActivationLocation(fixture, "project");

    const installState = await readJson(fixture.managedPaths.installStatePath);
    assert.equal(installState.selectedScope, "project");
    assert.equal(installState.lastDurableSetupAt, "2026-04-09T11:00:00.000Z");
  } finally {
    await fixture.harness.cleanup();
  }
});

test("current-session secret-binding blockers after durable verification keep managed writes and refresh install-state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const blockedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      env: {
        OPENCODE_CONFIG_CONTENT:
          '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  }\n}\n',
      },
    });

    assert.equal(blockedResult.status, "blocked");
    await assertActivationLocation(fixture, "project");

    const installState = await readJson(fixture.managedPaths.installStatePath);
    assert.equal(installState.selectedScope, "project");
    assert.equal(installState.lastDurableSetupAt, "2026-04-09T11:00:00.000Z");
  } finally {
    await fixture.harness.cleanup();
  }
});

test("current-session inline parse failures after durable verification keep managed writes and refresh install-state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const failedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      env: {
        OPENCODE_CONFIG_CONTENT: '{\n  "model": ,\n}\n',
      },
    });

    assert.equal(failedResult.status, "failed");
    await assertActivationLocation(fixture, "project");

    const installState = await readJson(fixture.managedPaths.installStatePath);
    assert.equal(installState.selectedScope, "project");
    assert.equal(installState.lastDurableSetupAt, "2026-04-09T11:00:00.000Z");
  } finally {
    await fixture.harness.cleanup();
  }
});

test("resolved-config mismatches after writes trigger rollback to the previous working state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const beforeManagedState = await snapshotManagedState(fixture);

    await fixture.harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput: createResolvedConfigFixture((config) => {
        config.small_model = "openai/gpt-4.1-mini";
      }),
      output: "opencode-ai 1.4.0",
    });

    const failedResult = await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    assert.equal(failedResult.status, "failed");
    await assertManagedStateUnchanged(fixture, beforeManagedState, [
      "installState",
      "projectConfig",
      "userConfig",
    ]);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("install-state write failures after successful verification roll earlier writes back and keep the last successful state", async () => {
  const fixture = await createInstallerFixture();

  try {
    await runScopedInstall(fixture, "user", {
      clockIso: "2026-04-09T10:00:00.000Z",
    });

    const beforeManagedState = await snapshotManagedState(fixture);
    const baseDependencies = createRunDependencies(fixture, {
      clockIso: "2026-04-09T11:00:00.000Z",
    });

    const failedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      dependencies: {
        ...baseDependencies,
        fs: {
          ...baseDependencies.fs,
          async writeFileAtomic(path, data, options) {
            if (path === fixture.managedPaths.installStatePath) {
              throw new Error("forced install-state write failure");
            }

            await baseDependencies.fs.writeFileAtomic(path, data, options);
          },
        },
      },
    });

    assert.equal(failedResult.status, "failed");
    await assertManagedStateUnchanged(fixture, beforeManagedState, [
      "installState",
      "secret",
      "userConfig",
    ]);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("late failures after rewriting repo-local config restore the old file without leaving a repo-local backup", async () => {
  const fixture = await createInstallerFixture();
  const secretBearingProjectConfig =
    '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    }\n  },\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8"\n}\n';

  try {
    await writeFile(
      fixture.managedPaths.projectConfigPath,
      secretBearingProjectConfig,
      "utf8",
    );

    const baseDependencies = createRunDependencies(fixture, {
      clockIso: "2026-04-09T11:00:00.000Z",
    });
    const expectedBackupPath = createExternalProjectBackupPath(
      fixture,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );

    const failedResult = await runScopedInstall(fixture, "project", {
      clockIso: "2026-04-09T11:00:00.000Z",
      dependencies: {
        ...baseDependencies,
        fs: {
          ...baseDependencies.fs,
          async writeFileAtomic(path, data, options) {
            if (path === fixture.managedPaths.installStatePath) {
              throw new Error("forced install-state write failure");
            }

            await baseDependencies.fs.writeFileAtomic(path, data, options);
          },
        },
      },
    });

    assert.equal(failedResult.status, "failed");
    assert.equal(
      await readText(fixture.managedPaths.projectConfigPath),
      secretBearingProjectConfig,
    );
    await assertBackupMissing(
      fixture,
      fixture.managedPaths.projectConfigPath,
      SECOND_RUN_BACKUP_TIMESTAMP,
    );
    await assertPathExists(fixture, expectedBackupPath);
    assert.equal(
      await readText(expectedBackupPath),
      secretBearingProjectConfig,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});
