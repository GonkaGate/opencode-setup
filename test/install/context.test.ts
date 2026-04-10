import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyInstallPlatform,
  resolveInstallContext,
} from "../../src/install/context.js";
import { createInstallIntegrationHarness } from "./harness.js";
import { createTestInstallDependencies } from "./test-deps.js";

test("classifyInstallPlatform treats darwin, linux, and WSL as v1-supported", () => {
  assert.deepEqual(
    classifyInstallPlatform({
      env: {},
      osRelease: "24.0.0",
      platform: "darwin",
    }),
    {
      id: "darwin",
      nodePlatform: "darwin",
      support: "v1_supported",
    },
  );

  assert.deepEqual(
    classifyInstallPlatform({
      env: {},
      osRelease: "6.8.0",
      platform: "linux",
    }),
    {
      id: "linux",
      nodePlatform: "linux",
      support: "v1_supported",
    },
  );

  assert.deepEqual(
    classifyInstallPlatform({
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      osRelease: "6.6.0-microsoft-standard-WSL2",
      platform: "linux",
    }),
    {
      id: "wsl",
      nodePlatform: "linux",
      support: "v1_supported",
    },
  );
});

test("classifyInstallPlatform treats native Windows as v1-supported", () => {
  assert.deepEqual(
    classifyInstallPlatform({
      env: {},
      osRelease: "10.0.26100",
      platform: "win32",
    }),
    {
      id: "windows",
      nodePlatform: "win32",
      support: "v1_supported",
    },
  );
});

test("resolveInstallContext supports native Windows paths and Git Bash cwd input without using host path semantics", async () => {
  const context = await resolveInstallContext(
    createTestInstallDependencies({
      commands: {
        kind: "stub",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "opencode-ai 1.4.1",
        },
      },
      existingPaths: ["C:\\workspace\\repo\\.git"],
      runtime: {
        cwd: "/c/workspace/repo/packages/app",
        homeDir: "C:\\Users\\test-user",
        osRelease: "10.0.26100",
        platform: "win32",
      },
    }),
  );

  assert.equal(
    context.workspace.resolvedCwd,
    "C:\\workspace\\repo\\packages\\app",
  );
  assert.equal(context.workspace.projectRoot, "C:\\workspace\\repo");
  assert.equal(context.workspace.insideGitRepository, true);
  assert.equal(context.runtime.platform.id, "windows");
  assert.equal(context.runtime.platform.support, "v1_supported");
  assert.equal(
    context.workspace.managedPaths.userConfigPath,
    "C:\\Users\\test-user\\.config\\opencode\\opencode.json",
  );
  assert.equal(
    context.workspace.managedPaths.secretPath,
    "C:\\Users\\test-user\\.gonkagate\\opencode\\api-key",
  );
});

test(
  "resolveInstallContext assembles project, platform, version, and managed path context without using real machine paths",
  { skip: process.platform === "win32" },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      const repositoryRoot = await harness.createGitRepository("repo");
      const nestedWorkspace =
        await harness.createWorkspace("repo/packages/app");

      await harness.installFakeOpenCodeOnPath({ output: "opencode-ai 1.4.1" });

      const context = await resolveInstallContext(
        harness.createDependencies({
          runtime: {
            cwd: nestedWorkspace,
            env: { WSL_DISTRO_NAME: "Ubuntu" },
            osRelease: "6.6.0-microsoft-standard-WSL2",
            platform: "linux",
          },
        }),
      );

      assert.equal(context.workspace.resolvedCwd, nestedWorkspace);
      assert.equal(context.workspace.projectRoot, repositoryRoot);
      assert.equal(context.workspace.insideGitRepository, true);
      assert.equal(context.opencode.installedVersion, "1.4.1");
      assert.equal(context.opencode.support, "newer_than_verified");
      assert.equal(context.runtime.platform.id, "wsl");
      assert.equal(context.runtime.platform.support, "v1_supported");
      harness.assertManagedPathsStayInsideHarness(
        context.workspace.managedPaths,
      );
    } finally {
      await harness.cleanup();
    }
  },
);
