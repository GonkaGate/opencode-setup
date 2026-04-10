import { appendFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const normalizedArgs = args.map((arg) =>
  arg.trim().replace(/^"+/u, "").replace(/"+$/u, ""),
);
const normalizedJoinedArgs = normalizedArgs.join(" ");
const invocationsFile = process.env.GONKAGATE_FAKE_OPENCODE_INVOCATIONS_FILE;

if (invocationsFile !== undefined) {
  appendFileSync(invocationsFile, `${JSON.stringify(args)}\n`, "utf8");
}

function getResult(kind) {
  if (kind === "debug_config_pure") {
    const inlineConfigActive =
      process.env.OPENCODE_CONFIG_CONTENT !== undefined;
    const pureExitCodeWithInlineConfig =
      process.env
        .GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_EXIT_CODE_WITH_INLINE_CONFIG;
    const pureOutputWithInlineConfig =
      process.env
        .GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_OUTPUT_WITH_INLINE_CONFIG;
    const pureStderrWithInlineConfig =
      process.env
        .GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_STDERR_WITH_INLINE_CONFIG;

    if (
      inlineConfigActive &&
      ((pureExitCodeWithInlineConfig ?? "").length > 0 ||
        (pureOutputWithInlineConfig ?? "").length > 0 ||
        (pureStderrWithInlineConfig ?? "").length > 0)
    ) {
      return {
        exitCode: Number(pureExitCodeWithInlineConfig || "0"),
        stderr: pureStderrWithInlineConfig ?? "",
        stdout:
          (pureOutputWithInlineConfig ?? "").length > 0
            ? pureOutputWithInlineConfig
            : "{}",
      };
    }

    return {
      exitCode: Number(
        process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_EXIT_CODE ?? "0",
      ),
      stderr:
        process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_STDERR ?? "",
      stdout:
        process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_PURE_OUTPUT ?? "{}",
    };
  }

  if (kind === "debug_config") {
    return {
      exitCode: Number(
        process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_EXIT_CODE ?? "0",
      ),
      stderr: process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_STDERR ?? "",
      stdout: process.env.GONKAGATE_FAKE_OPENCODE_DEBUG_CONFIG_OUTPUT ?? "{}",
    };
  }

  return {
    exitCode: Number(process.env.GONKAGATE_FAKE_OPENCODE_EXIT_CODE ?? "0"),
    stderr: process.env.GONKAGATE_FAKE_OPENCODE_STDERR ?? "",
    stdout: process.env.GONKAGATE_FAKE_OPENCODE_OUTPUT ?? "opencode-ai 1.4.0",
  };
}

function emitResult(result) {
  if (result.stdout.length > 0) {
    process.stdout.write(`${result.stdout}\n`);
  }

  if (result.stderr.length > 0) {
    process.stderr.write(`${result.stderr}\n`);
  }

  process.exit(result.exitCode);
}

if (normalizedArgs.length === 1 && normalizedArgs[0] === "--version") {
  emitResult(getResult("version"));
}

if (
  normalizedArgs[0] === "debug" &&
  normalizedArgs[1] === "config" &&
  normalizedArgs.includes("--pure")
) {
  emitResult(getResult("debug_config_pure"));
}

if (
  normalizedArgs.length === 2 &&
  normalizedArgs[0] === "debug" &&
  normalizedArgs[1] === "config"
) {
  emitResult(getResult("debug_config"));
}

if (/^debug config\b.*--pure\b/u.test(normalizedJoinedArgs)) {
  emitResult(getResult("debug_config_pure"));
}

process.stderr.write(
  `Unsupported fake opencode invocation: ${args.join(" ")}\n`,
);
process.exit(64);
