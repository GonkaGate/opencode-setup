import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  InstallClock,
  InstallDependencies,
  InstallInput,
  InstallPrompts,
  InstallRuntimeOverrides,
} from "../../src/install/deps.js";
import type { ManagedPaths } from "../../src/install/paths.js";
import { createNodeBackedTestInstallDependencies } from "./test-deps.js";

interface FakeOpenCodeOptions {
  debugConfigExitCode?: number;
  debugConfigOutput?: string;
  debugConfigPureExitCode?: number;
  debugConfigPureOutput?: string;
  debugConfigPureOutputWhenInlineConfigPresent?: string;
  debugConfigPureStderr?: string;
  debugConfigPureStderrWhenInlineConfigPresent?: string;
  debugConfigPureExitCodeWhenInlineConfigPresent?: number;
  debugConfigStderr?: string;
  exitCode?: number;
  output?: string;
  stderr?: string;
}

type HarnessRuntimeOverrides = {
  clock?: Partial<InstallClock>;
  input?: Partial<InstallInput>;
  prompts?: Partial<InstallPrompts>;
  runtime?: InstallRuntimeOverrides;
};

export interface InstallIntegrationHarness {
  assertManagedPathsStayInsideHarness(paths: ManagedPaths): void;
  binDir: string;
  cleanup(): Promise<void>;
  createDependencies(overrides?: HarnessRuntimeOverrides): InstallDependencies;
  createGitRepository(relativePath: string): Promise<string>;
  createWorkspace(relativePath: string): Promise<string>;
  installFakeOpenCodeOnPath(options?: FakeOpenCodeOptions): Promise<void>;
  homeDir: string;
  readFakeOpenCodeInvocations(): Promise<string[][]>;
  rootDir: string;
  workspaceDir: string;
}

const fakeOpenCodeFixturePath = fileURLToPath(
  new URL("./fixtures/fake-opencode.mjs", import.meta.url),
);

function assertPathWithinRoot(rootDir: string, targetPath: string): void {
  const relativePath = relative(rootDir, resolve(targetPath));
  const isInsideRoot =
    relativePath === "" ||
    (!relativePath.startsWith("..") && relativePath !== "..");

  assert.equal(
    isInsideRoot,
    true,
    `Expected ${targetPath} to stay inside ${rootDir}`,
  );
}

export async function createInstallIntegrationHarness(): Promise<InstallIntegrationHarness> {
  const rootDir = await mkdtemp(join(tmpdir(), "gonkagate-opencode-setup-"));
  const homeDir = join(rootDir, "home");
  const workspaceDir = join(rootDir, "workspace");
  const binDir = join(rootDir, "bin");
  const programDataDir = join(rootDir, "ProgramData");
  const fakeOpenCodeInvocationsPath = join(
    rootDir,
    "fake-opencode-invocations",
  );

  await Promise.all([
    mkdir(homeDir, { recursive: true }),
    mkdir(workspaceDir, { recursive: true }),
    mkdir(binDir, { recursive: true }),
    mkdir(programDataDir, { recursive: true }),
  ]);

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
    ...(process.platform === "win32"
      ? {
          ALLUSERSPROFILE: programDataDir,
          ProgramData: programDataDir,
          USERPROFILE: homeDir,
        }
      : {}),
    PATH: [binDir, process.env.PATH ?? ""]
      .filter((value) => value.length > 0)
      .join(delimiter),
  };
  let fakeOpenCodeEnv: NodeJS.ProcessEnv = {};

  async function createWorkspace(relativePath: string): Promise<string> {
    const directoryPath = join(workspaceDir, relativePath);
    await mkdir(directoryPath, { recursive: true });
    return directoryPath;
  }

  return {
    assertManagedPathsStayInsideHarness(paths) {
      for (const managedPath of Object.values(paths)) {
        assertPathWithinRoot(rootDir, managedPath);
      }
    },
    binDir,
    async cleanup() {
      await rm(rootDir, { force: true, recursive: true });
    },
    createDependencies(overrides = {}) {
      return createNodeBackedTestInstallDependencies({
        clock: overrides.clock,
        input: overrides.input,
        prompts: overrides.prompts,
        runtime: {
          cwd: overrides.runtime?.cwd ?? workspaceDir,
          env: {
            ...baseEnv,
            ...fakeOpenCodeEnv,
            ...overrides.runtime?.env,
          },
          homeDir,
          osRelease: overrides.runtime?.osRelease,
          platform: overrides.runtime?.platform,
          stdinIsTTY: overrides.runtime?.stdinIsTTY,
          stdoutIsTTY: overrides.runtime?.stdoutIsTTY,
        },
      });
    },
    async installFakeOpenCodeOnPath(options = {}) {
      if (process.platform === "win32") {
        const launcherPath = join(binDir, "opencode.cmd");
        const launcherContents = `@echo off\r\n"${process.execPath}" "${fakeOpenCodeFixturePath}" %*\r\n`;

        await writeFile(launcherPath, launcherContents, "utf8");
      } else {
        const launcherPath = join(binDir, "opencode");
        // Put a tiny `opencode` executable on PATH so integration tests
        // exercise the real process runner instead of only stubs.
        const launcherContents = `#!${process.execPath}
import ${JSON.stringify(fakeOpenCodeFixturePath)};
`;

        await writeFile(launcherPath, launcherContents, "utf8");
        await chmod(launcherPath, 0o755);
      }

      fakeOpenCodeEnv = {
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_EXIT_CODE: String(
          options.debugConfigExitCode ?? 0,
        ),
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_OUTPUT:
          options.debugConfigOutput ?? "{}",
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_EXIT_CODE: String(
          options.debugConfigPureExitCode ?? options.debugConfigExitCode ?? 0,
        ),
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_EXIT_CODE_WITH_INLINE_CONFIG:
          options.debugConfigPureExitCodeWhenInlineConfigPresent === undefined
            ? ""
            : String(options.debugConfigPureExitCodeWhenInlineConfigPresent),
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_OUTPUT:
          options.debugConfigPureOutput ?? options.debugConfigOutput ?? "{}",
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_OUTPUT_WITH_INLINE_CONFIG:
          options.debugConfigPureOutputWhenInlineConfigPresent ?? "",
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_STDERR:
          options.debugConfigPureStderr ?? options.debugConfigStderr ?? "",
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_STDERR_WITH_INLINE_CONFIG:
          options.debugConfigPureStderrWhenInlineConfigPresent ?? "",
        GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_STDERR:
          options.debugConfigStderr ?? "",
        GONKAGATE_FAKE_OPENCODE_EXIT_CODE: String(options.exitCode ?? 0),
        GONKAGATE_FAKE_OPENCODE_INVOCATIONS_FILE: fakeOpenCodeInvocationsPath,
        GONKAGATE_FAKE_OPENCODE_OUTPUT: options.output ?? "opencode-ai 1.4.0",
        GONKAGATE_FAKE_OPENCODE_STDERR: options.stderr ?? "",
      };
    },
    async createGitRepository(relativePath) {
      const repositoryRoot = await createWorkspace(relativePath);
      await mkdir(join(repositoryRoot, ".git"), { recursive: true });
      return repositoryRoot;
    },
    createWorkspace,
    homeDir,
    async readFakeOpenCodeInvocations() {
      try {
        const contents = await readFile(fakeOpenCodeInvocationsPath, "utf8");

        return contents
          .trim()
          .split("\n")
          .filter((line: string) => line.length > 0)
          .map((line: string) => JSON.parse(line) as string[]);
      } catch {
        return [];
      }
    },
    rootDir,
    workspaceDir,
  };
}
