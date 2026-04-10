import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod as chmodFs,
  mkdir as mkdirFs,
  rm as rmFs,
  readFile as readFileFs,
  writeFile as writeFileFs,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { password, select } from "@inquirer/prompts";
import writeFileAtomic from "write-file-atomic";

export interface InstallCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface InstallCommandResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}

export interface InstallFs {
  chmod(path: string, mode: number): Promise<void>;
  mkdir(
    path: string,
    options?: {
      mode?: number;
      recursive?: boolean;
    },
  ): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  removeFile(path: string): Promise<void>;
  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): Promise<void>;
  writeFileAtomic(
    path: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): Promise<void>;
}

export interface InstallClock {
  now(): Date;
}

export interface InstallInput {
  readStdin(): Promise<string>;
}

export interface InstallPrompts {
  readSecret(message: string): Promise<string>;
  selectOption<TValue extends string>(
    options: InstallSelectOptions<TValue>,
  ): Promise<TValue>;
}

export interface InstallCommandRunner {
  run(
    command: string,
    args: readonly string[],
    options?: InstallCommandOptions,
  ): Promise<InstallCommandResult>;
}

export interface InstallRuntimeEnvironment {
  cwd: string;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  osRelease: string;
  platform: NodeJS.Platform;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export type InstallRuntimeOverrides = Partial<InstallRuntimeEnvironment>;

export interface InstallDependencies {
  clock: InstallClock;
  commands: InstallCommandRunner;
  fs: InstallFs;
  input: InstallInput;
  prompts: InstallPrompts;
  runtime: InstallRuntimeEnvironment;
}

export interface InstallSelectChoice<TValue extends string = string> {
  description?: string;
  label: string;
  value: TValue;
}

export interface InstallSelectOptions<TValue extends string = string> {
  choices: readonly InstallSelectChoice<TValue>[];
  defaultValue?: TValue;
  message: string;
  pageSize?: number;
}

export interface CreateNodeInstallDependenciesOverrides {
  clock?: Partial<InstallClock>;
  commands?: Partial<InstallCommandRunner>;
  fs?: Partial<InstallFs>;
  input?: Partial<InstallInput>;
  prompts?: Partial<InstallPrompts>;
  runtime?: InstallRuntimeOverrides;
}

interface PreparedInstallCommand {
  args: string[];
  command: string;
  shell?: boolean;
  windowsHide?: boolean;
}

type PathExistsChecker = (path: string) => Promise<boolean>;

const DEFAULT_WINDOWS_PATH_EXTENSIONS = Object.freeze([
  ".COM",
  ".EXE",
  ".BAT",
  ".CMD",
] as const);
const WINDOWS_SHELL_SCRIPT_EXTENSIONS = new Set([".BAT", ".CMD"]);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function mkdir(
  path: string,
  options?: {
    mode?: number;
    recursive?: boolean;
  },
): Promise<void> {
  await mkdirFs(path, options);
}

async function readFile(
  path: string,
  encoding: BufferEncoding,
): Promise<string> {
  return await readFileFs(path, encoding);
}

async function removeFile(path: string): Promise<void> {
  await rmFs(path, {
    force: false,
  });
}

async function writeFile(
  path: string,
  data: string | Uint8Array,
  options?: {
    encoding?: BufferEncoding;
    mode?: number;
  },
): Promise<void> {
  await writeFileFs(path, data, options);
}

async function writeFileAtomically(
  path: string,
  data: string | Uint8Array,
  options?: {
    encoding?: BufferEncoding;
    mode?: number;
  },
): Promise<void> {
  await writeFileAtomic(
    path,
    typeof data === "string" ? data : Buffer.from(data),
    options,
  );
}

async function chmod(path: string, mode: number): Promise<void> {
  await chmodFs(path, mode);
}

function compareEnvironmentKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function normalizeEnvironmentForPlatform(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  if (platform !== "win32") {
    return env;
  }

  const normalizedEnv: NodeJS.ProcessEnv = {};
  const seenKeys = new Set<string>();
  const sortedKeys = Object.keys(env).sort(compareEnvironmentKeys);

  for (const key of sortedKeys) {
    const normalizedKey = key.toUpperCase();

    if (seenKeys.has(normalizedKey)) {
      continue;
    }

    seenKeys.add(normalizedKey);
    normalizedEnv[key] = env[key];
  }

  return normalizedEnv;
}

function getEnvironmentValue(
  env: NodeJS.ProcessEnv,
  key: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (platform !== "win32") {
    return env[key];
  }

  const normalizedKey = key.toLowerCase();
  const sortedKeys = Object.keys(env).sort(compareEnvironmentKeys);

  for (const candidateKey of sortedKeys) {
    const value = env[candidateKey];

    if (candidateKey.toLowerCase() === normalizedKey) {
      return value;
    }
  }

  return undefined;
}

function getWindowsPathExtensions(env: NodeJS.ProcessEnv): readonly string[] {
  const rawPathExtensions = getEnvironmentValue(env, "PATHEXT", "win32");

  if (rawPathExtensions === undefined || rawPathExtensions.length === 0) {
    return DEFAULT_WINDOWS_PATH_EXTENSIONS;
  }

  const parsedExtensions = rawPathExtensions
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0)
    .map((extension) =>
      extension.startsWith(".")
        ? extension.toUpperCase()
        : `.${extension.toUpperCase()}`,
    );

  return parsedExtensions.length > 0
    ? parsedExtensions
    : DEFAULT_WINDOWS_PATH_EXTENSIONS;
}

function stripWrappingQuotes(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

function createWindowsCommandCandidates(
  command: string,
  pathExtensions: readonly string[],
): string[] {
  if (path.win32.extname(command).length > 0) {
    return [command];
  }

  return [
    command,
    ...pathExtensions.map((extension) => `${command}${extension}`),
  ];
}

export async function resolveWindowsCommandPath(
  command: string,
  env: NodeJS.ProcessEnv,
  pathExistsChecker: PathExistsChecker = pathExists,
): Promise<string | undefined> {
  const normalizedEnv = normalizeEnvironmentForPlatform(env, "win32");
  const commandCandidates = createWindowsCommandCandidates(
    command,
    getWindowsPathExtensions(normalizedEnv),
  );
  const hasPathQualifier =
    command.includes("\\") ||
    command.includes("/") ||
    path.win32.isAbsolute(command);

  if (hasPathQualifier) {
    for (const candidate of commandCandidates) {
      if (await pathExistsChecker(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  const rawPath = getEnvironmentValue(normalizedEnv, "PATH", "win32") ?? "";

  for (const rawDirectory of rawPath.split(path.win32.delimiter)) {
    const directory = stripWrappingQuotes(rawDirectory.trim());

    if (directory.length === 0) {
      continue;
    }

    const joinedCandidates = commandCandidates.map((candidate) =>
      path.win32.join(directory, candidate),
    );

    for (const candidate of joinedCandidates) {
      if (await pathExistsChecker(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function createCommandNotFoundError(command: string): NodeJS.ErrnoException {
  const error = new Error(`spawn ${command} ENOENT`) as NodeJS.ErrnoException;

  error.code = "ENOENT";
  error.errno = -2;
  error.path = command;
  error.syscall = "spawn";

  return error;
}

export async function prepareInstallCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
  pathExistsChecker: PathExistsChecker = pathExists,
): Promise<PreparedInstallCommand> {
  if (platform !== "win32") {
    return {
      args: [...args],
      command,
    };
  }

  const normalizedEnv = normalizeEnvironmentForPlatform(env, platform);
  const resolvedCommandPath = await resolveWindowsCommandPath(
    command,
    normalizedEnv,
    pathExistsChecker,
  );

  if (resolvedCommandPath === undefined) {
    throw createCommandNotFoundError(command);
  }

  const extension = path.win32.extname(resolvedCommandPath).toUpperCase();

  if (!WINDOWS_SHELL_SCRIPT_EXTENSIONS.has(extension)) {
    return {
      args: [...args],
      command: resolvedCommandPath,
      windowsHide: true,
    };
  }

  return {
    args: ["/d", "/s", "/c", resolvedCommandPath, ...args],
    command:
      getEnvironmentValue(normalizedEnv, "ComSpec", platform) ?? "cmd.exe",
    windowsHide: true,
  };
}

async function runCommand(
  command: string,
  args: readonly string[],
  options?: InstallCommandOptions,
): Promise<InstallCommandResult> {
  const runtimeEnv = normalizeEnvironmentForPlatform(
    options?.env ?? process.env,
    process.platform,
  );
  const preparedCommand = await prepareInstallCommand(
    command,
    args,
    runtimeEnv,
    process.platform,
  );

  return await new Promise<InstallCommandResult>((resolve, reject) => {
    const child = spawn(preparedCommand.command, preparedCommand.args, {
      cwd: options?.cwd,
      env: runtimeEnv,
      shell: preparedCommand.shell,
      stdio: "pipe",
      windowsHide: preparedCommand.windowsHide,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    child.on("error", reject);

    child.on("close", (code, signal) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const combinedOutput = `${stdout}\n${stderr}`;

      if (
        preparedCommand.shell === true &&
        code !== 0 &&
        /is not recognized as an internal or external command/u.test(
          combinedOutput,
        )
      ) {
        reject(createCommandNotFoundError(command));
        return;
      }

      resolve({
        exitCode: code ?? 1,
        signal,
        stderr,
        stdout,
      });
    });

    child.stdin?.end();
  });
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");

  let contents = "";

  for await (const chunk of process.stdin) {
    contents += chunk;
  }

  return contents;
}

async function readSecret(message: string): Promise<string> {
  return await password({ message });
}

async function selectOption<TValue extends string>(
  options: InstallSelectOptions<TValue>,
): Promise<TValue> {
  return await select<TValue>({
    choices: options.choices.map((choice) => ({
      description: choice.description,
      name: choice.label,
      value: choice.value,
    })),
    default: options.defaultValue,
    message: options.message,
    pageSize: options.pageSize,
  });
}

export function createNodeInstallDependencies(
  overrides: CreateNodeInstallDependenciesOverrides = {},
): InstallDependencies {
  const defaultFs: InstallFs = {
    chmod,
    mkdir,
    pathExists,
    readFile,
    removeFile,
    writeFile,
    writeFileAtomic: writeFileAtomically,
  };

  const defaultClock: InstallClock = {
    now: () => new Date(),
  };

  const defaultInput: InstallInput = {
    readStdin,
  };

  const defaultPrompts: InstallPrompts = {
    readSecret,
    selectOption,
  };

  const defaultRuntime: InstallRuntimeEnvironment = {
    cwd: process.cwd(),
    env: process.env,
    homeDir: os.homedir(),
    osRelease: os.release(),
    platform: process.platform,
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
  };

  const defaultCommands: InstallCommandRunner = {
    run: runCommand,
  };

  return {
    clock: { ...defaultClock, ...overrides.clock },
    commands: { ...defaultCommands, ...overrides.commands },
    fs: { ...defaultFs, ...overrides.fs },
    input: { ...defaultInput, ...overrides.input },
    prompts: { ...defaultPrompts, ...overrides.prompts },
    runtime: { ...defaultRuntime, ...overrides.runtime },
  };
}
