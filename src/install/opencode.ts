import { CONTRACT_METADATA } from "../constants/contract.js";
import { compare, valid } from "semver";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";

export type OpenCodeVersionSupport = "exact_minimum" | "newer_than_verified";

export interface DetectedOpenCode {
  command: "opencode";
  installedVersion: string;
  minimumSupportedVersion: string;
  rawVersionOutput: string;
  support: OpenCodeVersionSupport;
}

const OPENCODE_VERSION_PATTERN = /\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/u;

export function parseOpenCodeVersion(output: string): string | null {
  const versionMatch = output.match(OPENCODE_VERSION_PATTERN);

  if (versionMatch === null) {
    return null;
  }

  return valid(versionMatch[1]);
}

export function classifyOpenCodeVersionSupport(
  installedVersion: string,
  minimumSupportedVersion = CONTRACT_METADATA.verifiedOpencode.minVersion,
): OpenCodeVersionSupport | "unsupported_old" {
  if (valid(installedVersion) === null) {
    throw new Error(`Invalid OpenCode version: ${installedVersion}`);
  }

  if (valid(minimumSupportedVersion) === null) {
    throw new Error(
      `Invalid minimum OpenCode version: ${minimumSupportedVersion}`,
    );
  }

  const versionComparison = compare(installedVersion, minimumSupportedVersion);

  if (versionComparison < 0) {
    return "unsupported_old";
  }

  return versionComparison === 0 ? "exact_minimum" : "newer_than_verified";
}

export async function detectOpenCode(
  dependencies: InstallDependencies,
): Promise<DetectedOpenCode> {
  const versionResult = await dependencies.commands
    .run("opencode", ["--version"], {
      cwd: dependencies.runtime.cwd,
      env: dependencies.runtime.env,
    })
    .catch((cause: unknown) => {
      throw createInstallError("opencode_not_found", { cause });
    });

  const rawVersionOutput =
    `${versionResult.stdout}\n${versionResult.stderr}`.trim();

  if (versionResult.exitCode !== 0) {
    throw createInstallError("opencode_version_unparseable", {
      exitCode: versionResult.exitCode,
      rawVersionOutput,
      signal: versionResult.signal,
    });
  }

  const installedVersion = parseOpenCodeVersion(rawVersionOutput);

  if (installedVersion === null) {
    throw createInstallError("opencode_version_unparseable", {
      rawVersionOutput,
    });
  }

  const support = classifyOpenCodeVersionSupport(installedVersion);

  if (support === "unsupported_old") {
    throw createInstallError("opencode_version_unsupported", {
      installedVersion,
      minimumSupportedVersion: CONTRACT_METADATA.verifiedOpencode.minVersion,
    });
  }

  return {
    command: "opencode",
    installedVersion,
    minimumSupportedVersion: CONTRACT_METADATA.verifiedOpencode.minVersion,
    rawVersionOutput,
    support,
  };
}
