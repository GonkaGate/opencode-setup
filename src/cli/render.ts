import { CommanderError } from "commander";
import type { InstallFlowResult } from "../install/contracts/install-flow.js";
import { redactSecretBearingText } from "../install/redact.js";
import type {
  CliExecutionOutcome,
  CliExecutionResult,
  CliRenderMode,
  InstallScope,
} from "./contracts.js";

export function renderCliExecution(
  outcome: CliExecutionOutcome,
): CliExecutionResult {
  if (outcome.type === "result") {
    return finalizeCliExecution(outcome, {
      exitCode: outcome.result.status === "success" ? 0 : 1,
      result: outcome.result,
      stdoutText: renderCliResult(outcome.result, outcome.renderMode),
    });
  }

  if (outcome.error instanceof CommanderError) {
    return finalizeCliExecution(outcome, {
      exitCode: outcome.error.exitCode,
    });
  }

  const renderedError = renderCliEntrypointError(outcome.error);

  if (outcome.renderMode === "json") {
    return finalizeCliExecution(outcome, {
      exitCode: renderedError.exitCode,
      stdoutText: `${JSON.stringify(
        {
          errorCode: "unexpected_error",
          message:
            renderedError.stderrText === undefined
              ? "Unexpected CLI failure."
              : stripEntrypointErrorPrefix(renderedError.stderrText),
          ok: false,
          status: "failed",
        },
        null,
        2,
      )}\n`,
    });
  }

  return finalizeCliExecution(outcome, {
    exitCode: renderedError.exitCode,
    stderrText: renderedError.stderrText,
  });
}

export function renderCliResult(
  result: InstallFlowResult,
  renderMode: CliRenderMode,
): string {
  if (renderMode === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return renderHumanResult(result);
}

export function formatUnexpectedCliErrorMessage(error: unknown): string {
  return redactSecretBearingText(
    error instanceof Error ? error.message : String(error),
  );
}

export interface CliEntrypointErrorRenderResult {
  exitCode: number;
  stderrText?: string;
}

export function renderCliEntrypointError(
  error: unknown,
): CliEntrypointErrorRenderResult {
  if (error instanceof CommanderError) {
    return {
      exitCode: error.exitCode,
    };
  }

  return {
    exitCode: 1,
    stderrText: `Error: ${formatUnexpectedCliErrorMessage(error)}\n`,
  };
}

function renderHumanResult(result: InstallFlowResult): string {
  if (result.status === "success") {
    return [
      "GonkaGate is configured for OpenCode.",
      `Model: ${result.modelDisplayName} (${result.modelRef})`,
      `Scope: ${formatScopeLabel(result.scope)}`,
      "Next: opencode",
      "",
    ].join("\n");
  }

  if (result.status === "blocked") {
    const formattedBlockers = result.blockers.map(
      (blocker) => `- ${blocker.layer}:${blocker.key} - ${blocker.reason}`,
    );

    return [
      "GonkaGate setup is blocked by higher-precedence OpenCode settings.",
      result.message,
      ...formattedBlockers,
      "Fix the blocking settings and rerun setup.",
      "",
    ].join("\n");
  }

  return ["GonkaGate setup failed.", result.message, ""].join("\n");
}

function formatScopeLabel(scope: InstallScope): string {
  return scope === "project" ? "project only" : "this machine";
}

function finalizeCliExecution(
  outcome: CliExecutionOutcome,
  options: {
    exitCode: number;
    result?: InstallFlowResult;
    stderrText?: string;
    stdoutText?: string;
  },
): CliExecutionResult {
  return {
    exitCode: options.exitCode,
    result: options.result,
    stderrText: mergeBufferedText(
      outcome.bufferedOutput.stderrText,
      options.stderrText,
    ),
    stdoutText: mergeBufferedText(
      outcome.bufferedOutput.stdoutText,
      options.stdoutText,
    ),
  };
}

function mergeBufferedText(
  existingText: string,
  nextText = "",
): string | undefined {
  const mergedText = `${existingText}${nextText}`;

  return mergedText === "" ? undefined : mergedText;
}

function stripEntrypointErrorPrefix(stderrText: string): string {
  return stderrText.replace(/^Error:\s*/u, "").trimEnd();
}
