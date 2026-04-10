import { GONKAGATE_PROVIDER_NAME } from "../constants/gateway.js";
import type { AllowedSecretInput } from "./contracts/secret-intake.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";

export const GONKAGATE_API_KEY_ENV_VAR = "GONKAGATE_API_KEY";

export interface SecretIntakeRequest {
  apiKeyStdin: boolean;
}

export interface ResolvedSecretInput {
  secret: string;
  source: AllowedSecretInput;
}

const SECRET_PROMPT_MESSAGE = `Enter your ${GONKAGATE_PROVIDER_NAME} API key`;

export async function resolveSecretInput(
  request: SecretIntakeRequest,
  dependencies: InstallDependencies,
): Promise<ResolvedSecretInput> {
  if (request.apiKeyStdin) {
    const stdinSecret = normalizeSecretValue(
      await dependencies.input.readStdin(),
    );

    if (stdinSecret === undefined) {
      throw createInstallError("secret_stdin_empty", {
        source: "api_key_stdin",
      });
    }

    return {
      secret: stdinSecret,
      source: "api_key_stdin",
    };
  }

  const envSecret = normalizeSecretValue(
    dependencies.runtime.env[GONKAGATE_API_KEY_ENV_VAR],
  );

  if (envSecret !== undefined) {
    return {
      secret: envSecret,
      source: "env",
    };
  }

  if (!canPromptForSecret(dependencies)) {
    throw createInstallError("secret_prompt_unavailable", {
      stdinIsTTY: dependencies.runtime.stdinIsTTY,
      stdoutIsTTY: dependencies.runtime.stdoutIsTTY,
    });
  }

  const promptedSecret = normalizeSecretValue(
    await dependencies.prompts.readSecret(SECRET_PROMPT_MESSAGE),
  );

  if (promptedSecret === undefined) {
    throw createInstallError("secret_source_unavailable", {
      source: "hidden_prompt",
    });
  }

  return {
    secret: promptedSecret,
    source: "hidden_prompt",
  };
}

function normalizeSecretValue(
  rawValue: string | undefined,
): string | undefined {
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const normalizedValue = rawValue.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function canPromptForSecret(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return dependencies.runtime.stdinIsTTY && dependencies.runtime.stdoutIsTTY;
}
