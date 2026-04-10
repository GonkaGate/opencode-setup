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

async function runCommand(
  command: string,
  args: readonly string[],
  options?: InstallCommandOptions,
): Promise<InstallCommandResult> {
  return await new Promise<InstallCommandResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options?.cwd,
      env: options?.env,
      stdio: "pipe",
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
      resolve({
        exitCode: code ?? 1,
        signal,
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
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
