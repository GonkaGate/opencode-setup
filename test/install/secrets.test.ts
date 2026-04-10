import assert from "node:assert/strict";
import test from "node:test";
import {
  GONKAGATE_API_KEY_ENV_VAR,
  resolveSecretInput,
} from "../../src/install/secrets.js";
import {
  isInstallErrorCode,
  type InstallError,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import { createTestInstallDependencies } from "./test-deps.js";

function expectInstallErrorCode<TCode extends InstallErrorCode>(
  code: TCode,
  assertError: (error: InstallError<TCode>) => void = () => {},
): (error: unknown) => boolean {
  return (error: unknown) => {
    if (!isInstallErrorCode(error, code)) {
      return false;
    }

    assertError(error);
    return true;
  };
}

test("resolveSecretInput prefers explicit stdin over environment input", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: true },
    createTestInstallDependencies({
      prompts: {
        kind: "stub",
        secret: "gp-from-prompt",
      },
      runtime: {
        env: {
          [GONKAGATE_API_KEY_ENV_VAR]: "gp-from-env",
        },
      },
      input: {
        kind: "stub",
        stdinText: "  gp-from-stdin \n",
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-stdin",
    source: "api_key_stdin",
  });
});

test("resolveSecretInput prefers a non-empty environment variable over the prompt", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: false },
    createTestInstallDependencies({
      prompts: {
        kind: "stub",
        secret: "gp-from-prompt",
      },
      runtime: {
        env: {
          [GONKAGATE_API_KEY_ENV_VAR]: " gp-from-env ",
        },
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-env",
    source: "env",
  });
});

test("resolveSecretInput uses the hidden prompt only in interactive terminals", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: false },
    createTestInstallDependencies({
      prompts: {
        kind: "stub",
        secret: "\n gp-from-prompt \n",
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-prompt",
    source: "hidden_prompt",
  });
});

test("resolveSecretInput hard-fails when --api-key-stdin is requested but stdin is empty", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: true },
        createTestInstallDependencies({
          runtime: {
            env: {
              [GONKAGATE_API_KEY_ENV_VAR]: "gp-should-not-leak",
            },
          },
          input: {
            kind: "stub",
            stdinText: "   \n",
          },
        }),
      ),
    expectInstallErrorCode("secret_stdin_empty", (error) => {
      assert.doesNotMatch(error.message, /gp-should-not-leak/);
    }),
  );
});

test("resolveSecretInput fails cleanly when no non-interactive source exists and prompting is unavailable", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: false },
        createTestInstallDependencies({
          runtime: {
            stdinIsTTY: false,
            stdoutIsTTY: false,
          },
        }),
      ),
    expectInstallErrorCode("secret_prompt_unavailable", (error) => {
      assert.match(error.message, /interactive terminal/i);
    }),
  );
});

test("resolveSecretInput rejects an empty hidden prompt result without leaking secrets", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: false },
        createTestInstallDependencies({
          prompts: {
            kind: "stub",
            secret: " \n ",
          },
          runtime: {
            stdinIsTTY: true,
            stdoutIsTTY: true,
          },
        }),
      ),
    expectInstallErrorCode("secret_source_unavailable", (error) => {
      assert.doesNotMatch(error.message, /gp-/);
    }),
  );
});
