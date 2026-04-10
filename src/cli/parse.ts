import { Command, Option } from "commander";
import { CONTRACT_METADATA } from "../constants/contract.js";
import {
  CURRENT_TRANSPORT,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_ID,
} from "../constants/gateway.js";
import type {
  CliOptions,
  CliRenderMode,
  InstallScope,
  ProgramOutput,
} from "./contracts.js";

interface ParsedProgramOptions {
  apiKeyStdin?: boolean;
  cwd?: string;
  json?: boolean;
  model?: string;
  scope?: InstallScope;
  yes?: boolean;
}

export interface ParsedCliRequest {
  options: CliOptions;
  renderMode: CliRenderMode;
}

function toCliRenderMode(jsonOutputRequested: boolean): CliRenderMode {
  return jsonOutputRequested ? "json" : "human";
}

function rejectPlainApiKeyArgs(argv: string[]): void {
  if (argv.some((arg) => arg === "--api-key" || arg.startsWith("--api-key="))) {
    throw new Error(
      'Passing API keys via "--api-key" is intentionally unsupported. Use the hidden prompt, GONKAGATE_API_KEY, or --api-key-stdin instead.',
    );
  }
}

function createProgram(output?: ProgramOutput): Command {
  const program = new Command()
    .name(CONTRACT_METADATA.binName)
    .description("Configure OpenCode to use GonkaGate.")
    .addOption(
      new Option(
        "--model <model-key>",
        "Choose a curated validated GonkaGate model without using the picker.",
      ),
    )
    .addOption(
      new Option(
        "--scope <scope>",
        "Choose whether GonkaGate is activated for this machine or this project.",
      ).choices(["user", "project"]),
    )
    .addOption(
      new Option(
        "--cwd <path>",
        "Override the working directory used for project-scope path resolution.",
      ),
    )
    .addOption(
      new Option(
        "--api-key-stdin",
        "Read the GonkaGate API key from stdin for automation.",
      ).default(false),
    )
    .addOption(
      new Option(
        "--yes",
        "Accept the recommended model and scope defaults without prompting.",
      ).default(false),
    )
    .addOption(
      new Option("--json", "Emit machine-readable status output.").default(
        false,
      ),
    )
    .helpOption("-h, --help", "Show this help.")
    .version(
      CONTRACT_METADATA.cliVersion,
      "-v, --version",
      "Show the package version.",
    )
    .addHelpText(
      "after",
      `
Examples:
  ${CONTRACT_METADATA.publicEntrypoint}
  ${CONTRACT_METADATA.publicEntrypoint} --scope project
  printf '%s' "$GONKAGATE_API_KEY" | ${CONTRACT_METADATA.publicEntrypoint} --api-key-stdin --scope project --yes --json

Runtime contract:
  - Provider id: ${GONKAGATE_PROVIDER_ID}
  - Base URL: ${GONKAGATE_BASE_URL}
  - Current transport target: ${CURRENT_TRANSPORT}
  - Curated model picker: public and validated-model-only
  - Verified OpenCode baseline: ${CONTRACT_METADATA.verifiedOpencode.minVersion}+

Safe secret inputs:
  - hidden interactive prompt
  - GONKAGATE_API_KEY
  - --api-key-stdin
`,
    )
    .exitOverride();

  if (output) {
    program.configureOutput(output);
  }

  return program;
}

export function parseCliOptions(
  argv: string[],
  output?: ProgramOutput,
): CliOptions {
  rejectPlainApiKeyArgs(argv);

  const program = createProgram(output);
  program.parse(["node", CONTRACT_METADATA.binName, ...argv]);

  const options = program.opts<ParsedProgramOptions>();
  return {
    apiKeyStdin: options.apiKeyStdin ?? false,
    cwd: options.cwd,
    json: options.json ?? false,
    modelKey: options.model,
    scope: options.scope,
    yes: options.yes ?? false,
  };
}

export function inferFallbackCliRenderMode(
  argv: readonly string[],
): CliRenderMode {
  return toCliRenderMode(argv.includes("--json"));
}

export function parseCliRequest(
  argv: string[],
  output?: ProgramOutput,
): ParsedCliRequest {
  const options = parseCliOptions(argv, output);

  return {
    options,
    renderMode: toCliRenderMode(options.json),
  };
}
