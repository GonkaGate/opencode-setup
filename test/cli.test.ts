import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { GONKAGATE_BASE_URL } from "../src/constants/gateway.js";
import { parseCliOptions, renderCliEntrypointError, run } from "../src/cli.js";
import type { InstallSelectOptions } from "../src/install/deps.js";
import type { ValidatedCuratedModel } from "../src/constants/models.js";
import { escapeRegExp, repoRoot } from "./contract-helpers.js";
import { createInstallIntegrationHarness } from "./install/harness.js";
import {
  createModelsHttp,
  createResolvedConfigFixture,
  EXTRA_LIVE_MODEL,
  EXTRA_LIVE_MODEL_ID,
  LIVE_MODELS,
  LIVE_MODEL_ID,
  SECOND_LIVE_MODEL_ID,
} from "./install/model-fixtures.js";

const MODEL_KEY = LIVE_MODEL_ID;
const SECOND_MODEL_KEY = SECOND_LIVE_MODEL_ID;

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

async function createCliFixture(
  options: {
    debugConfigPureOutput?: string;
    debugConfigPureOutputWhenInlineConfigPresent?: string;
    env?: NodeJS.ProcessEnv;
    interactive?: boolean;
    models?: readonly ValidatedCuratedModel[];
    selectOption?: TestSelectOption;
  } = {},
) {
  const harness = await createInstallIntegrationHarness();

  try {
    const repositoryRoot = await harness.createGitRepository("repo");

    await harness.installFakeOpenCodeOnPath({
      debugConfigPureOutput:
        options.debugConfigPureOutput ??
        createResolvedConfigFixture({ models: options.models }),
      debugConfigPureOutputWhenInlineConfigPresent:
        options.debugConfigPureOutputWhenInlineConfigPresent,
      output: "opencode-ai 1.4.0",
    });

    const stdout = createBufferWriter();
    const stderr = createBufferWriter();

    return {
      dependencies: harness.createDependencies({
        http: createModelsHttp(options.models),
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
  assert.match(helpResult.stdout, /Usage: opencode-setup/i);
  assert.match(helpResult.stdout, /Configure OpenCode to use GonkaGate/i);
  assert.match(helpResult.stdout, /Model source/i);
  assert.match(helpResult.stdout, /--scope <scope>/);
  assert.match(helpResult.stdout, /--api-key-stdin/);
  assert.match(helpResult.stdout, /GONKAGATE_API_KEY/);
  assert.match(
    helpResult.stdout,
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
  );
  assert.match(helpResult.stdout, new RegExp(escapeRegExp(GONKAGATE_BASE_URL)));
});

test("CLI wrapper still runs when invoked through a symlinked bin path", (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "gonkagate-opencode-bin-"));
  const binPath = resolve(repoRoot, CONTRACT_METADATA.binPath);
  const linkedBinPath = resolve(tempDir, CONTRACT_METADATA.binName);

  t.after(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  try {
    symlinkSync(binPath, linkedBinPath, "file");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EPERM"
    ) {
      t.skip("Symlinks are unavailable in this environment.");
      return;
    }

    throw error;
  }

  const helpResult = spawnSync(process.execPath, [linkedBinPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(helpResult.status, 0);
  assert.match(helpResult.stdout, /Usage: opencode-setup/i);
  assert.match(helpResult.stdout, /Configure OpenCode to use GonkaGate/i);
});

test("interactive runs show the public model picker with the fetched models", async () => {
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
      "Dynamic Alpha (Default)",
      "Dynamic Beta",
    ]);
    assert.match(
      promptMessages[1] ?? "",
      /Where should GonkaGate be activated for OpenCode on this machine/i,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("installer writes every fetched model id into provider.gonkagate.models", async () => {
  const models = [...LIVE_MODELS, EXTRA_LIVE_MODEL];
  const fixture = await createCliFixture({
    debugConfigPureOutput: createResolvedConfigFixture({ models }),
    models,
  });

  try {
    const result = await run(["--json", "--yes"], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    const userConfig = JSON.parse(
      await fixture.dependencies.fs.readFile(
        resolve(
          fixture.harness.homeDir,
          ".config",
          "opencode",
          "opencode.json",
        ),
        "utf8",
      ),
    ) as {
      provider?: {
        gonkagate?: {
          models?: Record<string, unknown>;
        };
      };
    };

    assert.equal(result.exitCode, 0);
    assert.ok(
      userConfig.provider?.gonkagate?.models?.[EXTRA_LIVE_MODEL_ID] !==
        undefined,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("--yes auto-selects the default model and scope without prompting", async () => {
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
    assert.match(
      fixture.stdout.contents,
      new RegExp(escapeRegExp(`"modelRef": "gonkagate/${MODEL_KEY}"`)),
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("non-interactive runs require model selection when multiple models are available", async () => {
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
      /"errorCode": "model_selection_required"/,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});

test("non-interactive runs still require scope after an explicit model selection", async () => {
  const fixture = await createCliFixture();

  try {
    const result = await run(["--json", "--model", MODEL_KEY], {
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

test("CLI accepts an explicit fetched model id", async () => {
  const fixture = await createCliFixture({
    debugConfigPureOutput: createResolvedConfigFixture({
      modelKey: SECOND_MODEL_KEY,
    }),
  });

  try {
    const result = await run(["--json", "--yes", "--model", SECOND_MODEL_KEY], {
      dependencies: fixture.dependencies,
      stderr: fixture.stderr,
      stdout: fixture.stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.match(fixture.stdout.contents, /"status": "success"/);
    assert.match(
      fixture.stdout.contents,
      new RegExp(escapeRegExp(`"modelRef": "gonkagate/${SECOND_MODEL_KEY}"`)),
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

test("human-readable success output includes next step and key rotation guidance", async () => {
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
    assert.match(fixture.stdout.contents, /Next: opencode/);
    assert.match(
      fixture.stdout.contents,
      /Rotate key later: printf '%s' "\$GONKAGATE_API_KEY" \| npx @gonkagate\/opencode-setup --api-key-stdin --scope project --yes/,
    );
    assert.match(
      fixture.stdout.contents,
      /OpenCode Desktop: restart after rerunning setup so it reloads the managed key file\.\n$/,
    );
  } finally {
    await fixture.harness.cleanup();
  }
});
