import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import {
  isInstallErrorCode,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  readManagedInstallState,
  writeManagedInstallState,
} from "../../src/install/state.js";
import { createInstallIntegrationHarness } from "./harness.js";
import { createTestInstallDependencies } from "./test-deps.js";

const INITIAL_STATE = {
  currentTransport: "chat_completions",
  installerVersion: "0.1.0",
  lastDurableSetupAt: "2026-04-08T09:30:00.000Z",
  selectedModelKey: "qwen3-235b-a22b-instruct-2507-fp8",
  selectedScope: "user",
} as const;

const UPDATED_STATE = {
  currentTransport: "chat_completions",
  installerVersion: "0.1.1",
  lastDurableSetupAt: "2026-04-08T11:45:00.000Z",
  selectedModelKey: "qwen3-235b-a22b-instruct-2507-fp8",
  selectedScope: "project",
} as const;

const LEGACY_STATE = {
  currentTransport: "chat_completions",
  installerVersion: "0.0.9",
  lastSuccessfulSetupAt: "2026-04-07T08:15:00.000Z",
  selectedModelKey: "qwen3-235b-a22b-instruct-2507-fp8",
  selectedScope: "user",
} as const;

function expectInstallErrorCode(
  code: InstallErrorCode,
): (error: unknown) => boolean {
  return (error: unknown) => isInstallErrorCode(error, code);
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

test("writeManagedInstallState writes the managed install state JSON document on first write", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );
    const writeResult = await writeManagedInstallState(
      INITIAL_STATE,
      harness.createDependencies({
        runtime: {
          platform: "linux",
        },
      }),
      managedPaths,
    );

    assert.equal(writeResult.path, managedPaths.installStatePath);
    assert.equal(writeResult.backupPath, undefined);
    assert.deepEqual(
      await readJsonFile(managedPaths.installStatePath),
      INITIAL_STATE,
    );
    assert.equal(
      (
        (await readJsonFile(managedPaths.installStatePath)) as Record<
          string,
          unknown
        >
      ).lastSuccessfulSetupAt,
      undefined,
    );
  } finally {
    await harness.cleanup();
  }
});

test("readManagedInstallState returns a previously written managed install state record", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    await writeManagedInstallState(
      INITIAL_STATE,
      harness.createDependencies({
        runtime: {
          platform: "linux",
        },
      }),
      managedPaths,
    );

    assert.deepEqual(
      await readManagedInstallState(harness.createDependencies(), managedPaths),
      INITIAL_STATE,
    );
  } finally {
    await harness.cleanup();
  }
});

test("readManagedInstallState accepts the legacy lastSuccessfulSetupAt field and maps it to lastDurableSetupAt", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    await mkdir(dirname(managedPaths.installStatePath), {
      recursive: true,
    });
    await writeFile(
      managedPaths.installStatePath,
      `${JSON.stringify(LEGACY_STATE, null, 2)}\n`,
      "utf8",
    );

    assert.deepEqual(
      await readManagedInstallState(harness.createDependencies(), managedPaths),
      {
        currentTransport: LEGACY_STATE.currentTransport,
        installerVersion: LEGACY_STATE.installerVersion,
        lastDurableSetupAt: LEGACY_STATE.lastSuccessfulSetupAt,
        selectedModelKey: LEGACY_STATE.selectedModelKey,
        selectedScope: LEGACY_STATE.selectedScope,
      },
    );
  } finally {
    await harness.cleanup();
  }
});

test("writeManagedInstallState stores owner-only file permissions on POSIX platforms", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    await writeManagedInstallState(
      INITIAL_STATE,
      harness.createDependencies({
        runtime: {
          platform: "linux",
        },
      }),
      managedPaths,
    );

    assert.equal(
      (await stat(managedPaths.installStatePath)).mode & 0o777,
      0o600,
    );
  } finally {
    await harness.cleanup();
  }
});

test("writeManagedInstallState persists on native Windows without POSIX chmod", async () => {
  const managedPaths = resolveManagedPaths(
    "C:\\Users\\test-user",
    "C:\\workspace\\repo",
    "win32",
  );
  let chmodCalls = 0;
  const dependencies = createTestInstallDependencies({
    fs: {
      async chmod() {
        chmodCalls += 1;
      },
    },
    runtime: {
      homeDir: "C:\\Users\\test-user",
      platform: "win32",
    },
  });

  const writeResult = await writeManagedInstallState(
    INITIAL_STATE,
    dependencies,
    managedPaths,
  );

  assert.equal(writeResult.path, managedPaths.installStatePath);
  assert.deepEqual(
    JSON.parse(
      await dependencies.fs.readFile(managedPaths.installStatePath, "utf8"),
    ) as unknown,
    INITIAL_STATE,
  );
  assert.equal(chmodCalls, 0);
});

test("writeManagedInstallState creates a timestamped backup before overwriting managed state", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    await writeManagedInstallState(
      INITIAL_STATE,
      harness.createDependencies({
        clock: {
          now: () => new Date("2026-04-08T10:11:12.000Z"),
        },
        runtime: {
          platform: "linux",
        },
      }),
      managedPaths,
    );

    const overwriteResult = await writeManagedInstallState(
      UPDATED_STATE,
      harness.createDependencies({
        clock: {
          now: () => new Date("2026-04-08T11:12:13.000Z"),
        },
        runtime: {
          platform: "linux",
        },
      }),
      managedPaths,
    );

    assert.equal(
      overwriteResult.backupPath,
      `${managedPaths.installStatePath}.bak-20260408T111213Z`,
    );
    assert.deepEqual(
      await readJsonFile(overwriteResult.backupPath),
      INITIAL_STATE,
    );
    assert.deepEqual(
      await readJsonFile(managedPaths.installStatePath),
      UPDATED_STATE,
    );
  } finally {
    await harness.cleanup();
  }
});

test("readManagedInstallState returns undefined when the managed state file is absent", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    assert.equal(
      await readManagedInstallState(harness.createDependencies(), managedPaths),
      undefined,
    );
  } finally {
    await harness.cleanup();
  }
});

test("writeManagedInstallState maps backup failures to the managed state backup error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedInstallState(
        INITIAL_STATE,
        createTestInstallDependencies({
          seedFiles: [
            {
              contents: "{}",
              path: managedPaths.installStatePath,
            },
          ],
          fs: {
            async writeFile() {
              throw new Error("backup write failed");
            },
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_state_backup_failed"),
  );
});

test("writeManagedInstallState maps managed-directory failures to the managed state write error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedInstallState(
        INITIAL_STATE,
        createTestInstallDependencies({
          fs: {
            async mkdir() {
              throw new Error("mkdir failed");
            },
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_state_write_failed"),
  );
});

test("writeManagedInstallState maps atomic write failures to the managed state write error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedInstallState(
        INITIAL_STATE,
        createTestInstallDependencies({
          fs: {
            async writeFileAtomic() {
              throw new Error("atomic write failed");
            },
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_state_write_failed"),
  );
});
