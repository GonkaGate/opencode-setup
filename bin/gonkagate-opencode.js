#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { main, renderCliEntrypointError } from "../dist/cli.js";

export { renderCliEntrypointError };

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

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
