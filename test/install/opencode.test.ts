import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../../src/constants/contract.js";
import { formatInstallErrorMessage } from "../../src/install/error-format.js";
import {
  detectOpenCode,
  type DetectedOpenCode,
} from "../../src/install/opencode.js";
import {
  isInstallErrorCode,
  type InstallError,
  type InstallErrorCode,
} from "../../src/install/errors.js";
import { createInstallIntegrationHarness } from "./harness.js";
import { createTestInstallDependencies } from "./test-deps.js";

function createDetectedOpenCode(output: string): Promise<DetectedOpenCode> {
  return detectOpenCode(
    createTestInstallDependencies({
      commands: {
        kind: "stub",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: output,
        },
      },
    }),
  );
}

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

test("formatInstallErrorMessage keeps install guidance outside the detection implementation", () => {
  assert.equal(
    formatInstallErrorMessage("opencode_not_found", {
      cause: new Error("spawn ENOENT"),
    }),
    `OpenCode was not found on PATH. Install opencode-ai ${CONTRACT_METADATA.verifiedOpencode.minVersion}+ and rerun ${CONTRACT_METADATA.publicEntrypoint}.`,
  );
});

test("detectOpenCode fails with install guidance when opencode is missing", async () => {
  await assert.rejects(
    () =>
      detectOpenCode(
        createTestInstallDependencies({
          commands: {
            error: new Error("spawn ENOENT"),
            kind: "stub",
          },
        }),
      ),
    expectInstallErrorCode("opencode_not_found", (error) => {
      assert.match(error.message, /Install opencode-ai 1\.4\.0\+/i);
    }),
  );
});

test("detectOpenCode rejects malformed version output", async () => {
  await assert.rejects(
    () =>
      detectOpenCode(
        createTestInstallDependencies({
          commands: {
            kind: "stub",
            result: {
              exitCode: 0,
              signal: null,
              stderr: "",
              stdout: "opencode version unknown",
            },
          },
        }),
      ),
    expectInstallErrorCode("opencode_version_unparseable"),
  );
});

test("detectOpenCode rejects versions below the verified minimum", async () => {
  await assert.rejects(
    () =>
      detectOpenCode(
        createTestInstallDependencies({
          commands: {
            kind: "stub",
            result: {
              exitCode: 0,
              signal: null,
              stderr: "",
              stdout: "opencode-ai 1.3.9",
            },
          },
        }),
      ),
    expectInstallErrorCode("opencode_version_unsupported", (error) => {
      assert.match(error.message, /below the verified minimum/i);
    }),
  );
});

test("detectOpenCode distinguishes the exact verified minimum", async () => {
  const detection = await createDetectedOpenCode("opencode-ai 1.4.0");

  assert.equal(detection.installedVersion, "1.4.0");
  assert.equal(detection.support, "exact_minimum");
});

test("detectOpenCode distinguishes versions newer than the verified minimum", async () => {
  const detection = await createDetectedOpenCode("opencode-ai 1.4.2");

  assert.equal(detection.installedVersion, "1.4.2");
  assert.equal(detection.support, "newer_than_verified");
});

test("detectOpenCode also works through the real process runner seam", async () => {
  const harness = await createInstallIntegrationHarness();

  try {
    await harness.installFakeOpenCodeOnPath({ output: "opencode-ai 1.4.0" });
    const detection = await detectOpenCode(harness.createDependencies());

    assert.equal(detection.installedVersion, "1.4.0");
    assert.equal(detection.support, "exact_minimum");
  } finally {
    await harness.cleanup();
  }
});

test(
  "detectOpenCode also works through the Windows fake launcher on native Windows hosts",
  { skip: process.platform !== "win32" },
  async () => {
    const harness = await createInstallIntegrationHarness();

    try {
      await harness.installFakeOpenCodeOnPath({ output: "opencode-ai 1.4.0" });
      const detection = await detectOpenCode(harness.createDependencies());
      const invocations = await harness.readFakeOpenCodeInvocations();

      assert.equal(detection.installedVersion, "1.4.0");
      assert.equal(
        invocations.some(
          (args) => args.length === 1 && args[0] === "--version",
        ),
        true,
      );
    } finally {
      await harness.cleanup();
    }
  },
);
