import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import {
  isInstallErrorCode,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import { writeManagedSecret } from "../../src/install/storage.js";
import { createInstallIntegrationHarness } from "./harness.js";
import {
  createStubInstallFs,
  createTestInstallDependencies,
} from "./test-deps.js";

const SKIP_POSIX_HOST_INTEGRATION = process.platform === "win32";

function expectInstallErrorCode(
  code: InstallErrorCode,
): (error: unknown) => boolean {
  return (error: unknown) => isInstallErrorCode(error, code);
}

test(
  "writeManagedSecret writes the secret to the managed secret path on first write",
  { skip: SKIP_POSIX_HOST_INTEGRATION },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      const managedPaths = resolveManagedPaths(
        harness.homeDir,
        harness.workspaceDir,
      );
      const writeResult = await writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
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

      assert.equal(writeResult.path, managedPaths.secretPath);
      assert.equal(writeResult.backupPath, undefined);
      assert.equal(
        await readFile(managedPaths.secretPath, "utf8"),
        "gp-secret-value",
      );
    } finally {
      await harness.cleanup();
    }
  },
);

test("resolved managed secret paths stay inside the integration harness", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    const managedPaths = resolveManagedPaths(
      harness.homeDir,
      harness.workspaceDir,
    );

    harness.assertManagedPathsStayInsideHarness(managedPaths);
  } finally {
    await harness.cleanup();
  }
});

test(
  "writeManagedSecret stores owner-only file and directory permissions on POSIX platforms",
  { skip: SKIP_POSIX_HOST_INTEGRATION },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      const managedPaths = resolveManagedPaths(
        harness.homeDir,
        harness.workspaceDir,
      );

      await writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
        harness.createDependencies({
          runtime: {
            platform: "linux",
          },
        }),
        managedPaths,
      );

      assert.equal((await stat(managedPaths.secretPath)).mode & 0o777, 0o600);
      assert.equal(
        (await stat(dirname(managedPaths.secretPath))).mode & 0o777,
        0o700,
      );
    } finally {
      await harness.cleanup();
    }
  },
);

test("writeManagedSecret repairs drifted POSIX permissions on an unchanged secret without rewriting contents or creating backups", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );
  const stubFs = createStubInstallFs({
    directories: [
      {
        mode: 0o755,
        path: dirname(managedPaths.secretPath),
      },
    ],
    files: [
      {
        contents: "gp-secret-value",
        mode: 0o644,
        path: managedPaths.secretPath,
      },
    ],
  });
  let writeFileCalls = 0;
  let writeFileAtomicCalls = 0;
  const dependencies = createTestInstallDependencies({
    fs: {
      chmod: stubFs.chmod,
      mkdir: stubFs.mkdir,
      pathExists: stubFs.pathExists,
      readFile: stubFs.readFile,
      removeFile: stubFs.removeFile,
      async writeFile(...args) {
        writeFileCalls += 1;
        return await stubFs.writeFile(...args);
      },
      async writeFileAtomic(...args) {
        writeFileAtomicCalls += 1;
        return await stubFs.writeFileAtomic(...args);
      },
    },
    runtime: {
      homeDir: "/home/test-user",
      platform: "linux",
    },
  });

  const writeResult = await writeManagedSecret(
    {
      secret: "gp-secret-value",
      source: "env",
    },
    dependencies,
    managedPaths,
  );

  assert.equal(writeResult.backupPath, undefined);
  assert.equal(writeResult.changed, false);
  assert.equal(writeFileCalls, 0);
  assert.equal(writeFileAtomicCalls, 0);
  assert.equal(stubFs.getEntry(managedPaths.secretPath)?.kind, "file");
  assert.equal(stubFs.getEntry(managedPaths.secretPath)?.mode, 0o600);
  assert.equal(
    stubFs.getEntry(dirname(managedPaths.secretPath))?.kind,
    "directory",
  );
  assert.equal(stubFs.getEntry(dirname(managedPaths.secretPath))?.mode, 0o700);
});

test(
  "writeManagedSecret creates a timestamped backup before overwriting the managed secret",
  { skip: SKIP_POSIX_HOST_INTEGRATION },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      const managedPaths = resolveManagedPaths(
        harness.homeDir,
        harness.workspaceDir,
      );

      await writeManagedSecret(
        {
          secret: "gp-old-secret",
          source: "env",
        },
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

      const overwriteResult = await writeManagedSecret(
        {
          secret: "gp-new-secret",
          source: "hidden_prompt",
        },
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
        await readFile(managedPaths.secretPath, "utf8"),
        "gp-new-secret",
      );
      assert.equal(
        overwriteResult.backupPath,
        `${managedPaths.secretPath}.bak-20260408T111213Z`,
      );
      assert.equal(
        await readFile(overwriteResult.backupPath, "utf8"),
        "gp-old-secret",
      );
      assert.equal(
        (await stat(overwriteResult.backupPath)).mode & 0o777,
        0o600,
      );
    } finally {
      await harness.cleanup();
    }
  },
);

test(
  "writeManagedSecret skips POSIX chmod enforcement on unsupported non-POSIX platforms without failing",
  { skip: SKIP_POSIX_HOST_INTEGRATION },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      const managedPaths = resolveManagedPaths(
        harness.homeDir,
        harness.workspaceDir,
      );

      await writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "api_key_stdin",
        },
        harness.createDependencies({
          runtime: {
            platform: "freebsd",
          },
        }),
        managedPaths,
      );

      assert.equal(
        await readFile(managedPaths.secretPath, "utf8"),
        "gp-secret-value",
      );
    } finally {
      await harness.cleanup();
    }
  },
);

test("writeManagedSecret uses the native Windows profile-scoped protection strategy", async () => {
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

  const result = await writeManagedSecret(
    {
      secret: "gp-secret-value",
      source: "env",
    },
    dependencies,
    managedPaths,
  );

  assert.equal(result.path, managedPaths.secretPath);
  assert.equal(
    await dependencies.fs.readFile(managedPaths.secretPath, "utf8"),
    "gp-secret-value",
  );
  assert.equal(chmodCalls, 0);
});

test("writeManagedSecret rejects native Windows secret paths outside the current user profile", async () => {
  const managedPaths = {
    ...resolveManagedPaths(
      "C:\\Users\\test-user",
      "C:\\workspace\\repo",
      "win32",
    ),
    secretPath: "D:\\shared\\gonkagate\\api-key",
  };

  await assert.rejects(
    () =>
      writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
        createTestInstallDependencies({
          runtime: {
            homeDir: "C:\\Users\\test-user",
            platform: "win32",
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_secret_write_failed"),
  );
});

test("writeManagedSecret maps backup failures to the managed secret backup error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
        createTestInstallDependencies({
          seedFiles: [
            {
              contents: "gp-old-secret",
              path: managedPaths.secretPath,
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
    expectInstallErrorCode("managed_secret_backup_failed"),
  );
});

test("writeManagedSecret maps managed-directory failures to the managed secret write error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
        createTestInstallDependencies({
          fs: {
            async mkdir() {
              throw new Error("mkdir failed");
            },
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_secret_write_failed"),
  );
});

test("writeManagedSecret maps atomic write failures to the managed secret write error", async () => {
  const managedPaths = resolveManagedPaths(
    "/home/test-user",
    "/workspace/repo",
  );

  await assert.rejects(
    () =>
      writeManagedSecret(
        {
          secret: "gp-secret-value",
          source: "env",
        },
        createTestInstallDependencies({
          fs: {
            async writeFileAtomic() {
              throw new Error("atomic write failed");
            },
          },
        }),
        managedPaths,
      ),
    expectInstallErrorCode("managed_secret_write_failed"),
  );
});
