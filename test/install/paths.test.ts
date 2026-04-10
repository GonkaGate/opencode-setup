import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveManagedPaths,
  resolveProjectConfigBackupDirectory,
  resolveInspectableSystemManagedConfigPaths,
  resolveProjectRoot,
} from "../../src/install/paths.js";
import { createTestInstallDependencies } from "./test-deps.js";

test("resolveProjectRoot keeps the resolved cwd outside git repositories", async () => {
  const nestedWorkspace = "/workspace/plain/nested";
  const projectLocation = await resolveProjectRoot(
    createTestInstallDependencies({
      runtime: { cwd: nestedWorkspace },
    }),
  );

  assert.equal(projectLocation.insideGitRepository, false);
  assert.equal(projectLocation.projectRoot, nestedWorkspace);
  assert.equal(projectLocation.resolvedCwd, nestedWorkspace);
});

test("resolveProjectRoot returns the nearest enclosing git root", async () => {
  const repositoryRoot = "/workspace/repo";
  const nestedWorkspace = "/workspace/repo/packages/app";
  const projectLocation = await resolveProjectRoot(
    createTestInstallDependencies({
      existingPaths: [`${repositoryRoot}/.git`],
      runtime: { cwd: nestedWorkspace },
    }),
  );

  assert.equal(projectLocation.insideGitRepository, true);
  assert.equal(projectLocation.projectRoot, repositoryRoot);
  assert.equal(projectLocation.resolvedCwd, nestedWorkspace);
});

test("resolveManagedPaths follows the product contract for user and project locations", async () => {
  const homeDir = "/home/test-user";
  const repositoryRoot = "/workspace/repo";
  const managedPaths = resolveManagedPaths(homeDir, repositoryRoot);

  assert.equal(
    managedPaths.userConfigPath,
    `${homeDir}/.config/opencode/opencode.json`,
  );
  assert.equal(
    managedPaths.secretPath,
    `${homeDir}/.gonkagate/opencode/api-key`,
  );
  assert.equal(
    managedPaths.installStatePath,
    `${homeDir}/.gonkagate/opencode/install-state.json`,
  );
  assert.equal(
    managedPaths.projectConfigPath,
    `${repositoryRoot}/opencode.json`,
  );
  assert.equal(
    resolveProjectConfigBackupDirectory(managedPaths),
    `${homeDir}/.gonkagate/opencode/backups/project-config`,
  );
});

test("resolveProjectRoot normalizes Git Bash style cwd paths on native Windows", async () => {
  const projectLocation = await resolveProjectRoot(
    createTestInstallDependencies({
      existingPaths: ["C:\\workspace\\repo\\.git"],
      runtime: {
        cwd: "/c/workspace/repo/packages/app",
        platform: "win32",
      },
    }),
  );

  assert.equal(projectLocation.insideGitRepository, true);
  assert.equal(projectLocation.projectRoot, "C:\\workspace\\repo");
  assert.equal(
    projectLocation.resolvedCwd,
    "C:\\workspace\\repo\\packages\\app",
  );
});

test("resolveManagedPaths follows the native Windows contract for user and project locations", () => {
  const homeDir = "C:\\Users\\test-user";
  const repositoryRoot = "C:\\workspace\\repo";
  const managedPaths = resolveManagedPaths(homeDir, repositoryRoot, "win32");

  assert.equal(
    managedPaths.userConfigPath,
    "C:\\Users\\test-user\\.config\\opencode\\opencode.json",
  );
  assert.equal(
    managedPaths.secretPath,
    "C:\\Users\\test-user\\.gonkagate\\opencode\\api-key",
  );
  assert.equal(
    managedPaths.installStatePath,
    "C:\\Users\\test-user\\.gonkagate\\opencode\\install-state.json",
  );
  assert.equal(
    managedPaths.projectConfigPath,
    "C:\\workspace\\repo\\opencode.json",
  );
  assert.equal(
    resolveProjectConfigBackupDirectory(managedPaths, "win32"),
    "C:\\Users\\test-user\\.gonkagate\\opencode\\backups\\project-config",
  );
});

test("resolveInspectableSystemManagedConfigPaths follows the file-based managed-settings contract", () => {
  assert.deepEqual(resolveInspectableSystemManagedConfigPaths({}, "linux"), [
    "/etc/opencode/opencode.json",
    "/etc/opencode/opencode.jsonc",
  ]);

  assert.deepEqual(resolveInspectableSystemManagedConfigPaths({}, "darwin"), [
    "/Library/Application Support/opencode/opencode.json",
    "/Library/Application Support/opencode/opencode.jsonc",
  ]);

  assert.deepEqual(
    resolveInspectableSystemManagedConfigPaths(
      {
        ProgramData: "C:\\ProgramData",
      },
      "win32",
    ),
    [
      "C:\\ProgramData\\opencode\\opencode.json",
      "C:\\ProgramData\\opencode\\opencode.jsonc",
    ],
  );
});
