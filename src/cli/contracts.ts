import type { InstallFlowResult } from "../install/contracts/install-flow.js";
import type { ManagedConfigScope } from "../install/contracts/managed-config.js";
import type { InstallDependencies } from "../install/deps.js";

export type InstallScope = ManagedConfigScope;

export interface CliOptions {
  apiKeyStdin: boolean;
  cwd?: string;
  json: boolean;
  modelKey?: string;
  scope?: InstallScope;
  yes: boolean;
}

export interface OutputWriter {
  write(text: string): void;
}

export interface ProgramOutput {
  writeErr?: (str: string) => void;
  writeOut?: (str: string) => void;
}

export interface CliRunOptions {
  dependencies?: InstallDependencies;
  stderr?: OutputWriter;
  stdout?: OutputWriter;
}

export interface CliRunResult {
  exitCode: number;
  result?: InstallFlowResult;
}

export type CliRenderMode = "human" | "json";

export interface CliExecutionResult extends CliRunResult {
  stderrText?: string;
  stdoutText?: string;
}

export interface CliBufferedOutput {
  output: ProgramOutput;
  stderrText: string;
  stdoutText: string;
}

export type CliExecutionOutcome =
  | {
      bufferedOutput: CliBufferedOutput;
      renderMode: CliRenderMode;
      result: InstallFlowResult;
      type: "result";
    }
  | {
      bufferedOutput: CliBufferedOutput;
      error: unknown;
      renderMode: CliRenderMode;
      type: "error";
    };
