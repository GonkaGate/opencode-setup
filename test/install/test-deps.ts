import {
  createNodeInstallDependencies,
  type CreateNodeInstallDependenciesOverrides,
  type InstallClock,
  type InstallCommandResult,
  type InstallCommandRunner,
  type InstallDependencies,
  type InstallFs,
  type InstallInput,
  type InstallPrompts,
  type InstallRuntimeEnvironment,
  type InstallRuntimeOverrides,
  type InstallSelectOptions,
} from "../../src/install/deps.js";
import {
  getInstallPathApi,
  normalizeInstallPath,
} from "../../src/install/platform-path.js";

type StubConfig<TOptions extends object = {}> = {
  kind: "stub";
} & TOptions;

type OverrideConfig<TDependency> = {
  kind: "override";
  value: Partial<TDependency>;
};

type TestDependencyConfig<TDependency, TStubOptions extends object = {}> =
  | StubConfig<TStubOptions>
  | OverrideConfig<TDependency>;

type TestInstallClockConfig = TestDependencyConfig<
  InstallClock,
  { now?: Date }
>;
type TestInstallCommandConfig = TestDependencyConfig<
  InstallCommandRunner,
  {
    error?: unknown;
    result?: InstallCommandResult;
  }
>;
type TestInstallInputConfig = TestDependencyConfig<
  InstallInput,
  { stdinText?: string }
>;
type TestInstallPromptsConfig = TestDependencyConfig<
  InstallPrompts,
  {
    error?: unknown;
    selections?: string[];
    secret?: string;
  }
>;

export interface TestInstallDependencyOverrides {
  clock?: TestInstallClockConfig;
  commands?: TestInstallCommandConfig;
  existingPaths?: readonly string[];
  seedDirectories?: readonly TestInstallFsDirectorySeed[];
  seedFiles?: readonly TestInstallFsFileSeed[];
  fs?: Partial<InstallFs>;
  input?: TestInstallInputConfig;
  prompts?: TestInstallPromptsConfig;
  runtime?: InstallRuntimeOverrides;
}

export interface TestInstallFsDirectorySeed {
  mode?: number;
  path: string;
}

export interface TestInstallFsFileSeed {
  contents?: string;
  mode?: number;
  path: string;
}

interface InMemoryDirectoryEntry {
  kind: "directory";
  mode?: number;
}

interface InMemoryFileEntry {
  contents: string;
  kind: "file";
  mode?: number;
}

type InMemoryInstallFsEntry = InMemoryDirectoryEntry | InMemoryFileEntry;

export interface StubInstallFs extends InstallFs {
  getEntry(path: string): InMemoryInstallFsEntry | undefined;
  readText(path: string): string | undefined;
  seedDirectory(path: string, mode?: number): void;
  seedFile(path: string, contents?: string, mode?: number): void;
}

const DEFAULT_COMMAND_RESULT: InstallCommandResult = {
  exitCode: 0,
  signal: null,
  stderr: "",
  stdout: "",
};

const DEFAULT_TEST_INSTALL_RUNTIME: InstallRuntimeEnvironment = {
  cwd: "/workspace",
  env: {},
  homeDir: "/home/test",
  osRelease: "6.8.0",
  platform: "linux",
  stdinIsTTY: false,
  stdoutIsTTY: false,
};

export function createStubInstallFs(
  options: {
    directories?: readonly TestInstallFsDirectorySeed[];
    existingPaths?: readonly string[];
    files?: readonly TestInstallFsFileSeed[];
    platform?: NodeJS.Platform;
  } = {},
): StubInstallFs {
  const entries = new Map<string, InMemoryInstallFsEntry>();
  const platform = options.platform ?? "linux";
  const pathApi = getInstallPathApi(platform);

  function normalizePath(pathValue: string): string {
    return pathApi.resolve(normalizeInstallPath(pathValue, platform));
  }

  function ensureRootEntry(pathValue: string): void {
    const rootPath = pathApi.parse(pathValue).root;

    if (rootPath.length > 0 && !entries.has(rootPath)) {
      entries.set(rootPath, {
        kind: "directory",
      });
    }
  }

  function createParentDirectories(path: string): void {
    const normalizedPath = normalizePath(path);
    const rootPath = pathApi.parse(normalizedPath).root;
    let currentPath = pathApi.dirname(normalizedPath);
    const missingDirectories: string[] = [];

    ensureRootEntry(normalizedPath);

    while (currentPath !== rootPath) {
      missingDirectories.push(currentPath);
      currentPath = pathApi.dirname(currentPath);
    }

    if (rootPath.length > 0) {
      missingDirectories.push(rootPath);
    }

    for (const directoryPath of missingDirectories.reverse()) {
      const existingEntry = entries.get(directoryPath);

      if (existingEntry !== undefined && existingEntry.kind !== "directory") {
        throw new Error(`ENOTDIR: ${directoryPath}`);
      }

      if (existingEntry === undefined) {
        entries.set(directoryPath, {
          kind: "directory",
        });
      }
    }
  }

  function assertWritableParentDirectory(path: string): void {
    const normalizedPath = normalizePath(path);
    const parentPath = pathApi.dirname(normalizedPath);

    ensureRootEntry(normalizedPath);
    const parentEntry = entries.get(parentPath);

    if (parentEntry === undefined) {
      throw new Error(`ENOENT: ${parentPath}`);
    }

    if (parentEntry.kind !== "directory") {
      throw new Error(`ENOTDIR: ${parentPath}`);
    }
  }

  function normalizeFileContents(
    data: string | Uint8Array,
    encoding?: BufferEncoding,
  ): string {
    if (typeof data === "string") {
      return data;
    }

    return Buffer.from(data).toString(encoding ?? "utf8");
  }

  function writeFileEntry(
    path: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): void {
    const normalizedPath = normalizePath(path);
    const previousEntry = entries.get(normalizedPath);

    assertWritableParentDirectory(normalizedPath);

    entries.set(normalizedPath, {
      contents: normalizeFileContents(data, options?.encoding),
      kind: "file",
      mode: options?.mode ?? previousEntry?.mode,
    });
  }

  function seedDirectory(path: string, mode?: number): void {
    const normalizedPath = normalizePath(path);
    const existingEntry = entries.get(normalizedPath);

    createParentDirectories(normalizedPath);

    if (existingEntry !== undefined && existingEntry.kind !== "directory") {
      throw new Error(`ENOTDIR: ${normalizedPath}`);
    }

    entries.set(normalizedPath, {
      kind: "directory",
      mode: mode ?? existingEntry?.mode,
    });
  }

  function seedFile(path: string, contents = "", mode?: number): void {
    const normalizedPath = normalizePath(path);
    const existingEntry = entries.get(normalizedPath);

    createParentDirectories(normalizedPath);

    if (existingEntry !== undefined && existingEntry.kind === "directory") {
      throw new Error(`EISDIR: ${normalizedPath}`);
    }

    entries.set(normalizedPath, {
      contents,
      kind: "file",
      mode: mode ?? existingEntry?.mode,
    });
  }

  for (const directory of options.directories ?? []) {
    seedDirectory(directory.path, directory.mode);
  }

  for (const existingPath of options.existingPaths ?? []) {
    seedFile(existingPath);
  }

  for (const file of options.files ?? []) {
    seedFile(file.path, file.contents, file.mode);
  }

  return {
    async chmod(path, mode) {
      const normalizedPath = normalizePath(path);
      const existingEntry = entries.get(normalizedPath);

      if (existingEntry === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }

      existingEntry.mode = mode;
    },
    getEntry(path) {
      const entry = entries.get(normalizePath(path));

      return entry === undefined ? undefined : { ...entry };
    },
    async mkdir(path, options) {
      if (options?.recursive) {
        seedDirectory(path, options.mode);
        return;
      }

      const normalizedPath = normalizePath(path);

      assertWritableParentDirectory(normalizedPath);

      const existingEntry = entries.get(normalizedPath);

      if (existingEntry !== undefined && existingEntry.kind !== "directory") {
        throw new Error(`EEXIST: ${normalizedPath}`);
      }

      entries.set(normalizedPath, {
        kind: "directory",
        mode: options?.mode ?? existingEntry?.mode,
      });
    },
    async pathExists(path) {
      return entries.has(normalizePath(path));
    },
    async readFile(path) {
      const entry = entries.get(normalizePath(path));

      if (entry === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }

      if (entry.kind !== "file") {
        throw new Error(`EISDIR: ${path}`);
      }

      return entry.contents;
    },
    async removeFile(path) {
      const normalizedPath = normalizePath(path);
      const entry = entries.get(normalizedPath);

      if (entry === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }

      if (entry.kind !== "file") {
        throw new Error(`EISDIR: ${path}`);
      }

      entries.delete(normalizedPath);
    },
    readText(path) {
      const entry = entries.get(normalizePath(path));

      return entry?.kind === "file" ? entry.contents : undefined;
    },
    seedDirectory,
    seedFile,
    async writeFile(path, data, options) {
      writeFileEntry(path, data, options);
    },
    async writeFileAtomic(path, data, options) {
      writeFileEntry(path, data, options);
    },
  };
}

export function createStubInstallCommandRunner(
  options: {
    error?: unknown;
    result?: InstallCommandResult;
  } = {},
): InstallCommandRunner {
  return {
    async run() {
      if (options.error !== undefined) {
        throw options.error;
      }

      return options.result ?? DEFAULT_COMMAND_RESULT;
    },
  };
}

export function createTestInstallRuntime(
  overrides: InstallRuntimeOverrides = {},
): InstallRuntimeEnvironment {
  return {
    env: { ...DEFAULT_TEST_INSTALL_RUNTIME.env, ...overrides.env },
    cwd: overrides.cwd ?? DEFAULT_TEST_INSTALL_RUNTIME.cwd,
    homeDir: overrides.homeDir ?? DEFAULT_TEST_INSTALL_RUNTIME.homeDir,
    osRelease: overrides.osRelease ?? DEFAULT_TEST_INSTALL_RUNTIME.osRelease,
    platform: overrides.platform ?? DEFAULT_TEST_INSTALL_RUNTIME.platform,
    stdinIsTTY: overrides.stdinIsTTY ?? DEFAULT_TEST_INSTALL_RUNTIME.stdinIsTTY,
    stdoutIsTTY:
      overrides.stdoutIsTTY ?? DEFAULT_TEST_INSTALL_RUNTIME.stdoutIsTTY,
  };
}

export function createStubInstallClock(
  now = new Date("2026-04-08T00:00:00.000Z"),
): InstallClock {
  return {
    now: () => now,
  };
}

export function createStubInstallInput(stdinText = ""): InstallInput {
  return {
    async readStdin() {
      return stdinText;
    },
  };
}

export function createStubInstallPrompts(
  options: {
    error?: unknown;
    selections?: string[];
    secret?: string;
  } = {},
): InstallPrompts {
  const queuedSelections = [...(options.selections ?? [])];

  return {
    async readSecret() {
      if (options.error !== undefined) {
        throw options.error;
      }

      return options.secret ?? "";
    },
    async selectOption<TValue extends string>(
      selectOptions: InstallSelectOptions<TValue>,
    ): Promise<TValue> {
      if (options.error !== undefined) {
        throw options.error;
      }

      const queuedSelection = queuedSelections.shift();

      if (queuedSelection !== undefined) {
        return queuedSelection as TValue;
      }

      return (selectOptions.defaultValue ??
        selectOptions.choices[0]?.value) as TValue;
    },
  };
}

function resolveTestDependency<TDependency, TStubOptions extends object = {}>(
  config: TestDependencyConfig<TDependency, TStubOptions> | undefined,
  createStub: (
    stubConfig: StubConfig<TStubOptions> | undefined,
  ) => Partial<TDependency>,
): Partial<TDependency> {
  if (config?.kind === "override") {
    return config.value;
  }

  return createStub(config);
}

function createStubbedTestFs(
  overrides: TestInstallDependencyOverrides,
): Partial<InstallFs> {
  const stubFs = createStubInstallFs({
    directories: overrides.seedDirectories,
    existingPaths: overrides.existingPaths,
    files: overrides.seedFiles,
    platform: overrides.runtime?.platform,
  });

  return overrides.fs === undefined ? stubFs : { ...stubFs, ...overrides.fs };
}

function createStubbedTestCommands(
  overrides: TestInstallDependencyOverrides,
): Partial<InstallCommandRunner> {
  return resolveTestDependency(overrides.commands, (stubConfig) =>
    createStubInstallCommandRunner(
      stubConfig === undefined
        ? undefined
        : {
            error: stubConfig.error,
            result: stubConfig.result,
          },
    ),
  );
}

function createStubbedTestClock(
  overrides: TestInstallDependencyOverrides,
): Partial<InstallClock> {
  return resolveTestDependency(overrides.clock, (stubConfig) =>
    createStubInstallClock(stubConfig?.now),
  );
}

function createStubbedTestInput(
  overrides: TestInstallDependencyOverrides,
): Partial<InstallInput> {
  return resolveTestDependency(overrides.input, (stubConfig) =>
    createStubInstallInput(stubConfig?.stdinText),
  );
}

function createStubbedTestPrompts(
  overrides: TestInstallDependencyOverrides,
): Partial<InstallPrompts> {
  return resolveTestDependency(overrides.prompts, (stubConfig) =>
    createStubInstallPrompts(
      stubConfig === undefined
        ? undefined
        : {
            error: stubConfig.error,
            selections: stubConfig.selections,
            secret: stubConfig.secret,
          },
    ),
  );
}

export function createStubbedTestInstallDependencies(
  overrides: TestInstallDependencyOverrides = {},
): InstallDependencies {
  return createNodeInstallDependencies({
    clock: createStubbedTestClock(overrides),
    commands: createStubbedTestCommands(overrides),
    fs: createStubbedTestFs(overrides),
    input: createStubbedTestInput(overrides),
    prompts: createStubbedTestPrompts(overrides),
    runtime: createTestInstallRuntime(overrides.runtime),
  });
}

export function createNodeBackedTestInstallDependencies(
  overrides: CreateNodeInstallDependenciesOverrides = {},
): InstallDependencies {
  return createNodeInstallDependencies({
    clock: overrides.clock,
    commands: overrides.commands,
    fs: overrides.fs,
    input: overrides.input,
    prompts: overrides.prompts,
    runtime: createTestInstallRuntime(overrides.runtime),
  });
}

export function createTestInstallDependencies(
  overrides: TestInstallDependencyOverrides = {},
): InstallDependencies {
  return createStubbedTestInstallDependencies(overrides);
}
