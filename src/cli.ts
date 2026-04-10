import process from "node:process";
import { run as runCli } from "./cli/execute.js";
import { parseCliOptions } from "./cli/parse.js";
import { renderCliEntrypointError } from "./cli/render.js";
import type { CliRunOptions, CliRunResult } from "./cli/contracts.js";
import { isEntrypointInvocation } from "./entrypoint.js";

export { parseCliOptions };
export { renderCliEntrypointError } from "./cli/render.js";
export type {
  CliOptions,
  CliRunOptions,
  CliRunResult,
  InstallScope,
} from "./cli/contracts.js";

export async function run(
  argv = process.argv.slice(2),
  options: CliRunOptions = {},
): Promise<CliRunResult> {
  return await runCli(argv, {
    dependencies: options.dependencies,
    stderr: options.stderr ?? process.stderr,
    stdout: options.stdout ?? process.stdout,
  });
}

export async function main(
  argv = process.argv.slice(2),
): Promise<CliRunResult> {
  const result = await run(argv);

  process.exitCode = result.exitCode;

  return result;
}

function handleCliError(error: unknown): void {
  const renderedError = renderCliEntrypointError(error);

  if (renderedError.stderrText !== undefined) {
    process.stderr.write(renderedError.stderrText);
  }

  process.exitCode = renderedError.exitCode;
}

const isEntrypoint = isEntrypointInvocation(import.meta.url);

if (isEntrypoint) {
  main().catch(handleCliError);
}
