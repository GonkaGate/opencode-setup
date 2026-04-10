import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { formatOpencodeModelRef } from "../src/constants/models.js";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { GONKAGATE_BASE_URL } from "../src/constants/gateway.js";
import { parseCliOptions, renderCliEntrypointError, run } from "../src/cli.js";
import type { InstallSelectOptions } from "../src/install/deps.js";
import {
  buildManagedProviderConfig,
  resolveValidatedModel,
} from "../src/install/managed-provider-config.js";
import { escapeRegExp, repoRoot } from "./contract-helpers.js";
import { createInstallIntegrationHarness } from "./install/harness.js";

const MODEL_KEY = "qwen3-235b-a22b-instruct-2507-fp8" as const;

type TestSelectOption = <TValue extends string>(
  options: InstallSelectOptions<TValue>,
) => Promise<TValue>;

interface BufferWriter {
  contents: string;
  write(text: string): void;
}

function createBufferWriter(): BufferWriter {
  return {
    contents: "",
    write(text) {
      this.contents += text;
    },
  };
}

function createResolvedConfigFixture(
  mutate?: (config: Record<string, unknown>) => void,
): string {
  const model = resolveValidatedModel(MODEL_KEY);
  const providerConfig = buildManagedProviderConfig(model);
  const resolvedConfig = {
    model: formatOpencodeModelRef(model),
    provider: {
      gonkagate: providerConfig,
    },
    small_model: formatOpencodeModelRef(model),
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

async function createCliFixture(
  options: {
    debugConfigPureOutput?: string;
    debugConfigPureOutputWhenInlineConfigPresent?: string;
    env?: NodeJS.ProcessEnv;
    interactive?: boolean;
    selectOption?: TestSelectOption;
  } = {},
) {
  const harness = await createInstallIntegrationHarness();

  try {
    const repositoryRoot = await harness.createGitRepository("repo");

    await harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput:
        options.debugConfigPureOutput ?? createResolvedConfigFixture(),
      debugConfigPureOutputWhenInlineConfigPresent:
        options.debugConfigPureOutputWhenInlineConfigPresent,
      output: "opencode-ai 1.4.0",
    });

    const stdout = createBufferWriter();
    const stderr = createBufferWriter();

    return {
      dependencies: harness.createDependencies({
        prompts:
          options.selectOption === undefined
            ? undefined
            : {
                async selectOption<TValue extends string>(
                  promptOptions: InstallSelectOptions<TValue>,
                ): Promise<TValue> {
                  return await options.selectOption!(promptOptions);
                },
              },
        runtime: {
          cwd: repositoryRoot,
          env: {
            GONKAGATE_API_KEY: "gp-cli-test-secret",
            ...options.env,
          },
          stdinIsTTY: options.interactive ?? false,
          stdoutIsTTY: options.interactive ?? false,
        },
      }),
      harness,
      repositoryRoot,
      stderr,
      stdout,
    };
  } catch (error) {
    await harness.cleanup();
    throw error;
  }
}

test("parseCliOptions reads supported runtime flags", () => {
  const options = parseCliOptions([
    "--scope",
    "project",
    "--model",
    MODEL_KEY,
    "--cwd",
    "/tmp/project",
    "--yes",
    "--json",
    "--api-key-stdin",
  ]);

  assert.equal(options.scope, "project");
  assert.equal(options.modelKey, MODEL_KEY);
  assert.equal(options.cwd, "/tmp/project");
  assert.equal(options.yes, true);
  assert.equal(options.json, true);
  assert.equal(options.apiKeyStdin, true);
});

test("parseCliOptions rejects plain api-key flags", () => {
  assert.throws(
    () => parseCliOptions(["--api-key", "gp-secret-value"]),
    /intentionally unsupported/i,
  );
});

test("CLI wrapper exposes the shipped help surface", () => {
  const binPath = resolve(repoRoot, CONTRACT_METADATA.binPath);
  const helpResult = spawnSync(process.execPath, [binPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(helpResult.status, 0);
  assert.match(helpResult.stdout, /Configure OpenCode to use GonkaGate/i);
  assert.match(helpResult.stdout, /validated-model-only/i);
  assert.match(helpResult.stdout, /--scope <scope>/);
  assert.match(helpResult.stdout, /--api-key-stdin/);
  assert.match(helpResult.stdout, /GONKAGATE_API_KEY/);
  assert.match(
    helpResult.stdout,
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
  );
  assert.match(helpResult.stdout, new RegExp(escapeRegExp(GONKAGATE_BASE_URL)));
});

test("interactive runs show the public model picker even when one validated model is available", async () => {
  const promptMessages: string[] = [];
  const promptChoiceSnapshots: string[][] = [];
  const fixture = await createCliFixture({
    interactive: true,
    selectOption: async (options) => {
      promptMessages.push(options.message);
      promptChoiceSnapshots.push(
        options.choices.map((choice: { label: string }) => choice.label),
      );
      return options.defaultValue ?? options.choices[0]?.value ?? MODEL_KEY;
    },
  });

  try {
    const result = await run([], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.match(
      promptMessages[0] ?? "",
      /Choose the GonkaGate model to configure for OpenCode/i,
    );
    assert.deepEqual(promptChoiceSnapshots[0], [
      "Qwen3 235B A22B Instruct 2507 FP8 (Recommended)",
    ]);
    assert.match(
      promptMessages[1] ?? "",
      /Where should GonkaGate be activated for OpenCode on this machine/i,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("--yes auto-selects the recommended model and scope without prompting", async () => {
  let selectCallCount = 0;
  const fixture = await createCliFixture({
    interactive: true,
    selectOption: async (options) => {
      selectCallCount += 1;
      return options.defaultValue ?? options.choices[0]?.value ?? MODEL_KEY;
    },
  });

  try {
    const result = await run(["--yes", "--json"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(selectCallCount, 0);
    assert.match(fixture.stdout.contents, /"status": "success"/);
    assert.match(fixture.stdout.contents, /"scope": "project"/);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("non-interactive runs require --scope or --yes", async () => {
  const fixture = await createCliFixture();

  try {
    const result = await run(["--json"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.match(fixture.stdout.contents, /"status": "failed"/);
    assert.match(
      fixture.stdout.contents,
      /"errorCode": "scope_selection_required"/,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("CLI emits structured JSON success payloads for the real installer flow", async () => {
  const fixture = await createCliFixture();

  try {
    const result = await run(["--json", "--yes"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.match(fixture.stdout.contents, /"status": "success"/);
    assert.match(fixture.stdout.contents, /"ok": true/);
    assert.match(fixture.stdout.contents, /"providerId": "gonkagate"/);
    assert.match(fixture.stdout.contents, /"transport": "chat_completions"/);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("CLI emits structured JSON blocked payloads when higher-precedence layers prevent success", async () => {
  const fixture = await createCliFixture({
    debugConfigPureOutputWhenInlineConfigPresent: createResolvedConfigFixture(
      (config) => {
        config.model = "openai/gpt-4.1";
      },
    ),
    env: {
      OPENCODE_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
    },
  });

  try {
    const result = await run(["--json", "--yes"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.match(fixture.stdout.contents, /"status": "blocked"/);
    assert.match(
      fixture.stdout.contents,
      /"errorCode": "effective_config_blocked"/,
    );
    assert.match(fixture.stdout.contents, /OPENCODE_CONFIG_CONTENT/);
  } finally {
    await fixture.harness.cleanup();
  }
});

test("renderCliEntrypointError redacts unexpected fatal error messages", () => {
  const renderedError = renderCliEntrypointError(
    new Error("gp-live-secret Bearer session-token"),
  );

  assert.equal(renderedError.exitCode, 1);
  assert.doesNotMatch(renderedError.stderrText ?? "", /gp-live-secret/);
  assert.doesNotMatch(renderedError.stderrText ?? "", /Bearer session-token/);
  assert.match(renderedError.stderrText ?? "", /\[REDACTED\]/);
});

test("bin wrapper reuses the shared CLI entrypoint error renderer", async () => {
  const binModule = (await import(
    pathToFileURL(resolve(repoRoot, CONTRACT_METADATA.binPath)).href
  )) as {
    renderCliEntrypointError: typeof renderCliEntrypointError;
  };
  const error = new Error("gp-bin-secret");

  assert.deepEqual(
    binModule.renderCliEntrypointError(error),
    renderCliEntrypointError(error),
  );
});

test("CLI emits structured JSON failed payloads for resolved-config mismatches", async () => {
  const fixture = await createCliFixture({
    debugConfigPureOutput: createResolvedConfigFixture((config) => {
      config.small_model = "openai/gpt-4.1-mini";
    }),
  });

  try {
    const result = await run(["--json", "--yes"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.match(fixture.stdout.contents, /"status": "failed"/);
    assert.match(
      fixture.stdout.contents,
      /"errorCode": "effective_config_mismatch"/,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("human-readable success output ends with the minimal next step", async () => {
  const fixture = await createCliFixture();

  try {
    const result = await run(["--yes"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.match(
      fixture.stdout.contents,
      /GonkaGate is configured for OpenCode\./,
    );
    assert.match(fixture.stdout.contents, /Next: opencode\n$/);
  } finally {
    await fixture.harness.cleanup();
  }
});
