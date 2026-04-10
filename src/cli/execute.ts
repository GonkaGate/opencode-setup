import { createNodeInstallDependencies } from "../install/deps.js";
import { runInstallFlow } from "../install/index.js";
import type {
  CliBufferedOutput,
  CliExecutionResult,
  CliRunOptions,
  CliRunResult,
  OutputWriter,
} from "./contracts.js";
import { inferFallbackCliRenderMode, parseCliRequest } from "./parse.js";
import { renderCliExecution } from "./render.js";

export async function run(
  argv: string[] = [],
  options: CliRunOptions = {},
): Promise<CliRunResult> {
  const execution = await executeCli(argv, {
    dependencies: options.dependencies,
  });

  writeBufferedOutput(options.stdout, execution.stdoutText);
  writeBufferedOutput(options.stderr, execution.stderrText);

  return {
    exitCode: execution.exitCode,
    result: execution.result,
  };
}

export async function executeCli(
  argv: string[],
  options: Pick<CliRunOptions, "dependencies"> = {},
): Promise<CliExecutionResult> {
  const bufferedOutput = createBufferedOutput();
  let renderMode = inferFallbackCliRenderMode(argv);

  try {
    const parsedRequest = parseCliRequest(argv, bufferedOutput.output);
    const { options: cliOptions } = parsedRequest;
    renderMode = parsedRequest.renderMode;
    const dependencies =
      options.dependencies ?? createNodeInstallDependencies();
    const result = await runInstallFlow(cliOptions, dependencies);

    return renderCliExecution({
      bufferedOutput,
      renderMode,
      result,
      type: "result",
    });
  } catch (error) {
    return renderCliExecution({
      bufferedOutput,
      error,
      renderMode,
      type: "error",
    });
  }
}

function createBufferedOutput(): CliBufferedOutput {
  const bufferedOutput: CliBufferedOutput = {
    output: {
      writeErr(text) {
        bufferedOutput.stderrText += text;
      },
      writeOut(text) {
        bufferedOutput.stdoutText += text;
      },
    },
    stderrText: "",
    stdoutText: "",
  };

  return bufferedOutput;
}

function writeBufferedOutput(
  writer: OutputWriter | undefined,
  text: string | undefined,
): void {
  if (writer !== undefined && text !== undefined) {
    writer.write(text);
  }
}
