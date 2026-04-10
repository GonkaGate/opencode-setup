import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, test } from "node:test";
import {
  resolveManagedPaths,
  resolveProjectConfigBackupDirectory,
} from "../../src/install/paths.js";
import { writeManagedConfig } from "../../src/install/write.js";
import {
  createInstallIntegrationHarness,
  type InstallIntegrationHarness,
} from "./harness.js";
import { createTestInstallDependencies } from "./test-deps.js";
import { expectInstallErrorCode } from "./test-helpers.js";

const TARGET_PATH = "/workspace/repo/opencode.json";
const EXISTING_CONFIG = '{\n  "model": "gonkagate/example"\n}\n';
const OLD_USER_CONFIG = '{\n  "model": "gonkagate/old"\n}\n';
const NEW_USER_CONFIG = '{\n  "model": "gonkagate/new"\n}\n';
const USER_SCOPE_CONFIG = '{\n  "model": "gonkagate/user"\n}\n';
const PROJECT_SCOPE_CONFIG = '{\n  "model": "gonkagate/project"\n}\n';
const SKIP_POSIX_HOST_INTEGRATION = process.platform === "win32";

async function withInstallHarness(
  run: (
    harness: InstallIntegrationHarness,
    managedPaths: ReturnType<typeof resolveManagedPaths>,
  ) => Promise<void>,
): Promise<void> {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    await run(harness, managedPaths);
  } finally {
    await harness.cleanup();
  }
}

function createLinuxDependencies(harness: InstallIntegrationHarness) {
  return harness.createDependencies({
    runtime: {
      platform: "linux",
    },
  });
}

async function seedTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

describe("writeManagedConfig [stubbed]", () => {
  test("skips backup and write work when contents are unchanged", async () => {
    const dependencies = createTestInstallDependencies({
      seedFiles: [
        {
          contents: EXISTING_CONFIG,
          path: TARGET_PATH,
        },
      ],
    });
    const result = await writeManagedConfig(
      {
        contents: EXISTING_CONFIG,
        exists: true,
        path: TARGET_PATH,
        target: "project_config",
      },
      EXISTING_CONFIG,
      dependencies,
    );

    assert.equal(result.changed, false);
    assert.equal(result.backupPath, undefined);
    assert.equal(
      await dependencies.fs.readFile(TARGET_PATH, "utf8"),
      EXISTING_CONFIG,
    );
  });

  test("maps backup failures to the managed config backup error", async () => {
    await assert.rejects(
      () =>
        writeManagedConfig(
          {
            contents: '{"model":"old"}\n',
            exists: true,
            path: TARGET_PATH,
            target: "project_config",
          },
          '{"model":"new"}\n',
          createTestInstallDependencies({
            seedFiles: [
              {
                contents: '{"model":"old"}\n',
                path: TARGET_PATH,
              },
            ],
            fs: {
              async writeFile() {
                throw new Error("backup write failed");
              },
            },
          }),
        ),
      expectInstallErrorCode("managed_config_backup_failed"),
    );
  });

  test("maps atomic write failures to the managed config write error", async () => {
    await assert.rejects(
      () =>
        writeManagedConfig(
          {
            contents: "",
            exists: false,
            path: TARGET_PATH,
            target: "project_config",
          },
          '{"model":"new"}\n',
          createTestInstallDependencies({
            fs: {
              async writeFileAtomic() {
                throw new Error("atomic write failed");
              },
            },
          }),
        ),
      expectInstallErrorCode("managed_config_write_failed"),
    );
  });

  test("uses native Windows path semantics for managed config backups", async () => {
    const targetPath = "C:\\Users\\test-user\\.config\\opencode\\opencode.json";
    const result = await writeManagedConfig(
      {
        contents: OLD_USER_CONFIG,
        exists: true,
        path: targetPath,
        target: "user_config",
      },
      NEW_USER_CONFIG,
      createTestInstallDependencies({
        clock: {
          kind: "stub",
          now: new Date("2026-04-08T11:12:13.000Z"),
        },
        runtime: {
          homeDir: "C:\\Users\\test-user",
          platform: "win32",
        },
        seedFiles: [
          {
            contents: OLD_USER_CONFIG,
            path: targetPath,
          },
        ],
      }),
    );

    assert.equal(
      result.backupPath,
      "C:\\Users\\test-user\\.config\\opencode\\opencode.json.bak-20260408T111213Z",
    );
  });
});

describe("writeManagedConfig [integration]", () => {
  test(
    "creates a timestamped backup before replacing an existing config",
    { skip: SKIP_POSIX_HOST_INTEGRATION },
    async () => {
      await withInstallHarness(async (harness, managedPaths) => {
        await seedTextFile(managedPaths.userConfigPath, OLD_USER_CONFIG);
        const result = await writeManagedConfig(
          {
            contents: OLD_USER_CONFIG,
            exists: true,
            path: managedPaths.userConfigPath,
            target: "user_config",
          },
          NEW_USER_CONFIG,
          harness.createDependencies({
            clock: {
              now: () => new Date("2026-04-08T11:12:13.000Z"),
            },
            runtime: {
              platform: "linux",
            },
          }),
        );

        assert.equal(result.changed, true);
        assert.equal(
          result.backupPath,
          `${managedPaths.userConfigPath}.bak-20260408T111213Z`,
        );
        assert.equal(
          await readFile(result.backupPath, "utf8"),
          OLD_USER_CONFIG,
        );
        assert.equal(
          await readFile(managedPaths.userConfigPath, "utf8"),
          NEW_USER_CONFIG,
        );
      });
    },
  );

  test(
    "can keep repo-local rollback backups outside the repository",
    { skip: SKIP_POSIX_HOST_INTEGRATION },
    async () => {
      await withInstallHarness(async (harness, managedPaths) => {
        const backupDirectoryPath =
          resolveProjectConfigBackupDirectory(managedPaths);

        await seedTextFile(managedPaths.projectConfigPath, OLD_USER_CONFIG);

        const result = await writeManagedConfig(
          {
            contents: OLD_USER_CONFIG,
            exists: true,
            path: managedPaths.projectConfigPath,
            target: "project_config",
          },
          PROJECT_SCOPE_CONFIG,
          harness.createDependencies({
            clock: {
              now: () => new Date("2026-04-08T11:12:13.000Z"),
            },
            runtime: {
              platform: "linux",
            },
          }),
          {
            backupDirectoryPath,
          },
        );

        assert.ok(
          result.backupPath?.startsWith(
            `${backupDirectoryPath}/opencode.json.`,
          ),
        );
        assert.equal(
          await readFile(managedPaths.projectConfigPath, "utf8"),
          PROJECT_SCOPE_CONFIG,
        );
        assert.equal(
          await readFile(result.backupPath!, "utf8"),
          OLD_USER_CONFIG,
        );
      });
    },
  );

  test(
    "writes user and project targets independently",
    { skip: SKIP_POSIX_HOST_INTEGRATION },
    async () => {
      await withInstallHarness(async (harness, managedPaths) => {
        const dependencies = createLinuxDependencies(harness);
        const userResult = await writeManagedConfig(
          {
            contents: "",
            exists: false,
            path: managedPaths.userConfigPath,
            target: "user_config",
          },
          USER_SCOPE_CONFIG,
          dependencies,
        );
        const projectResult = await writeManagedConfig(
          {
            contents: "",
            exists: false,
            path: managedPaths.projectConfigPath,
            target: "project_config",
          },
          PROJECT_SCOPE_CONFIG,
          dependencies,
        );

        assert.equal(userResult.path, managedPaths.userConfigPath);
        assert.equal(projectResult.path, managedPaths.projectConfigPath);
        assert.equal(
          await readFile(managedPaths.userConfigPath, "utf8"),
          USER_SCOPE_CONFIG,
        );
        assert.equal(
          await readFile(managedPaths.projectConfigPath, "utf8"),
          PROJECT_SCOPE_CONFIG,
        );
      });
    },
  );
});
