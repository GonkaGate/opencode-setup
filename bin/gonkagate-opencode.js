#!/usr/bin/env node

import process from "node:process";
import { main, renderCliEntrypointError } from "../dist/cli.js";
import { isEntrypointInvocation } from "../dist/entrypoint.js";

export { renderCliEntrypointError };

const isEntrypoint = isEntrypointInvocation(import.meta.url);

function handleCliError(error) {
  const renderedError = renderCliEntrypointError(error);

  if (renderedError.stderrText !== undefined) {
    process.stderr.write(renderedError.stderrText);
  }

  process.exitCode = renderedError.exitCode;
}

if (isEntrypoint) {
  main().catch(handleCliError);
}
