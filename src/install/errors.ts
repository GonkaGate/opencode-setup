import { CONTRACT_METADATA } from "../constants/contract.js";
import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationFileLayerSource,
  EffectiveConfigVerificationInputLayerSource,
  EffectiveConfigVerificationMismatch,
  EffectiveConfigVerificationTarget,
} from "./contracts/effective-config.js";
import type {
  ManagedConfigScope,
  ManagedConfigTarget,
} from "./contracts/managed-config.js";
import type { AllowedSecretInput } from "./contracts/secret-intake.js";
import type { InstallCommandResult } from "./deps.js";

type ManagedTarget = "managed_install_state" | "managed_secret";
type ManagedArtifactOperation = "backup" | "write";
type VerificationConflict = Pick<
  EffectiveConfigVerificationBlocker | EffectiveConfigVerificationMismatch,
  "key" | "layer"
>;

export interface InstallErrorDetailsByCode {
  managed_config_backup_failed: {
    cause: unknown;
    path: string;
    target: ManagedConfigTarget;
  };
  managed_config_merge_failed: {
    keyPath: string;
    path: string;
    reason: string;
    target: ManagedConfigTarget;
  };
  managed_config_parse_failed: {
    path: string;
    reason: string;
    target: ManagedConfigTarget;
  };
  managed_config_plan_invalid: {
    missingTarget: ManagedConfigTarget;
    scope: ManagedConfigScope;
  };
  managed_config_write_failed: {
    cause: unknown;
    path: string;
    target: ManagedConfigTarget;
  };
  managed_secret_backup_failed: {
    cause: unknown;
    source: AllowedSecretInput;
    target: "managed_secret";
  };
  managed_secret_write_failed: {
    cause: unknown;
    source: AllowedSecretInput;
    target: "managed_secret";
  };
  managed_rollback_failed: {
    cause: unknown;
  };
  managed_state_backup_failed: {
    cause: unknown;
    target: "managed_install_state";
  };
  managed_state_write_failed: {
    cause: unknown;
    target: "managed_install_state";
  };
  effective_config_blocked: {
    blockers: readonly EffectiveConfigVerificationBlocker[];
    target: EffectiveConfigVerificationTarget;
  };
  effective_config_command_failed:
    | {
        cause: unknown;
        command: readonly string[];
      }
    | {
        command: readonly string[];
        exitCode: number;
        signal: NodeJS.Signals | null;
      };
  effective_config_layer_parse_failed: {
    reason: string;
  } & EffectiveConfigVerificationInputLayerSource;
  effective_config_layer_read_failed: {
    cause: unknown;
  } & EffectiveConfigVerificationFileLayerSource;
  effective_config_mismatch: {
    mismatches: readonly EffectiveConfigVerificationMismatch[];
    target: EffectiveConfigVerificationTarget;
  };
  effective_config_parse_failed: {
    reason: string;
  };
  opencode_not_found: {
    cause: unknown;
  };
  opencode_version_unparseable:
    | (Pick<InstallCommandResult, "signal"> & {
        exitCode: number;
        rawVersionOutput: string;
      })
    | {
        rawVersionOutput: string;
      };
  opencode_version_unsupported: {
    installedVersion: string;
    minimumSupportedVersion: string;
  };
  scope_selection_required: {
    insideGitRepository: boolean;
  };
  model_selection_required: {
    validatedModelCount: number;
  };
  unsupported_model_key: {
    modelKey: string;
  };
  validated_models_unavailable: Record<string, never>;
  secret_prompt_unavailable: {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
  };
  secret_source_unavailable: {
    source: AllowedSecretInput;
  };
  secret_stdin_empty: {
    source: "api_key_stdin";
  };
}

export type InstallErrorCode = keyof InstallErrorDetailsByCode;
export type InstallErrorDetails<TCode extends InstallErrorCode> =
  InstallErrorDetailsByCode[TCode];

const INSTALL_ERROR_MESSAGE_FACTORIES: {
  [TCode in InstallErrorCode]: (details: InstallErrorDetails<TCode>) => string;
} = {
  managed_config_backup_failed: (details) =>
    `Failed to back up the existing ${formatManagedConfigTarget(details.target)} at ${details.path} before replacement.`,
  managed_config_merge_failed: (details) =>
    `Could not safely merge GonkaGate-managed keys into the ${formatManagedConfigTarget(details.target)} at ${details.path} (${details.keyPath}: ${details.reason}).`,
  managed_config_parse_failed: (details) =>
    `Failed to parse the existing ${formatManagedConfigTarget(details.target)} at ${details.path} as JSON or JSONC (${details.reason}).`,
  managed_config_plan_invalid: (details) =>
    `Managed config plan for ${details.scope} scope is missing the required ${formatManagedConfigTarget(details.missingTarget)} step.`,
  managed_config_write_failed: (details) =>
    `Failed to write the ${formatManagedConfigTarget(details.target)} at ${details.path}.`,
  managed_secret_backup_failed: (details) =>
    formatManagedArtifactFailureMessage({
      operation: "backup",
      source: details.source,
      subject: "managed GonkaGate secret",
      target: details.target,
    }),
  managed_secret_write_failed: (details) =>
    formatManagedArtifactFailureMessage({
      operation: "write",
      source: details.source,
      subject: "managed GonkaGate secret",
      target: details.target,
    }),
  managed_rollback_failed: () =>
    "The installer failed and automatic rollback did not complete cleanly. Restore the GonkaGate-managed backups and rerun setup.",
  managed_state_backup_failed: (details) =>
    formatManagedArtifactFailureMessage({
      operation: "backup",
      subject: "GonkaGate install state",
      target: details.target,
    }),
  managed_state_write_failed: (details) =>
    formatManagedArtifactFailureMessage({
      operation: "write",
      subject: "GonkaGate install state",
      target: details.target,
    }),
  effective_config_blocked: (details) =>
    `Higher-precedence OpenCode settings are blocking GonkaGate from becoming effective (${formatVerificationConflicts(details.blockers)}).`,
  effective_config_command_failed: (details) =>
    "cause" in details
      ? `Failed to run \`${formatCommand(details.command)}\` to verify the resolved OpenCode config.`
      : `\`${formatCommand(details.command)}\` exited unsuccessfully while verifying the resolved OpenCode config.`,
  effective_config_layer_parse_failed: (details) =>
    `Failed to parse the ${formatVerificationLayerSource(details)} as JSON or JSONC (${details.reason}).`,
  effective_config_layer_read_failed: (details) =>
    `Failed to read the ${formatVerificationLayerSource(details)}.`,
  effective_config_mismatch: (details) =>
    `Resolved OpenCode config does not match the expected GonkaGate setup for ${details.target.modelRef} (${formatVerificationConflicts(details.mismatches)}).`,
  effective_config_parse_failed: (details) =>
    `Failed to parse the resolved OpenCode config output (${details.reason}).`,
  opencode_not_found: () =>
    `OpenCode was not found on PATH. Install opencode-ai ${CONTRACT_METADATA.verifiedOpencode.minVersion}+ and rerun ${CONTRACT_METADATA.publicEntrypoint}.`,
  opencode_version_unparseable: (details) =>
    "exitCode" in details
      ? "Failed to run `opencode --version` successfully."
      : "Could not determine the installed OpenCode version from `opencode --version`.",
  opencode_version_unsupported: (details) =>
    `OpenCode ${details.installedVersion} is below the verified minimum ${details.minimumSupportedVersion}. Upgrade opencode-ai and rerun ${CONTRACT_METADATA.publicEntrypoint}.`,
  scope_selection_required: (details) =>
    details.insideGitRepository
      ? "Non-interactive setup inside a git repository requires --scope or --yes so the installer can choose between user and project activation safely."
      : "Non-interactive setup requires --scope or --yes so the installer can confirm the activation scope safely.",
  model_selection_required: (details) =>
    details.validatedModelCount <= 1
      ? "A validated GonkaGate model could not be selected automatically. Pass --model or rerun interactively."
      : "Multiple validated GonkaGate models are available. Pass --model, use --yes for the recommended default, or rerun interactively.",
  unsupported_model_key: (details) =>
    `The requested GonkaGate model key "${details.modelKey}" is not in the current validated public picker.`,
  validated_models_unavailable: () =>
    "No validated GonkaGate models are currently available for setup.",
  secret_prompt_unavailable: () =>
    "A hidden GonkaGate API key prompt requires an interactive terminal. Use GONKAGATE_API_KEY or --api-key-stdin for non-interactive setup.",
  secret_source_unavailable: (details) =>
    `A GonkaGate API key was not provided through the allowed ${details.source} input.`,
  secret_stdin_empty: () =>
    "No GonkaGate API key was received on stdin after --api-key-stdin was requested.",
};

function formatManagedTarget(target: ManagedTarget): string {
  return target === "managed_secret"
    ? "managed secret storage"
    : "managed install state";
}

function formatManagedConfigTarget(target: ManagedConfigTarget): string {
  return target === "user_config"
    ? "user OpenCode config"
    : "project OpenCode config";
}

function formatManagedArtifactFailureMessage(options: {
  operation: ManagedArtifactOperation;
  source?: AllowedSecretInput;
  subject: string;
  target: ManagedTarget;
}): string {
  const action =
    options.operation === "backup"
      ? `Failed to back up the existing ${options.subject} before replacement`
      : `Failed to write the ${options.subject}`;
  const sourceSuffix =
    options.source === undefined ? "" : `, source: ${options.source}`;

  return `${action} (${formatManagedTarget(options.target)}${sourceSuffix}).`;
}

function formatCommand(command: readonly string[]): string {
  return command.join(" ");
}

function formatVerificationConflicts(
  conflicts: readonly VerificationConflict[],
): string {
  return conflicts
    .slice(0, 3)
    .map((conflict) => `${conflict.layer}:${conflict.key}`)
    .join(", ");
}

function formatVerificationLayerSource(
  source:
    | EffectiveConfigVerificationFileLayerSource
    | EffectiveConfigVerificationInputLayerSource,
): string {
  return source.kind === "file"
    ? `${source.layer} verification layer at ${source.path}`
    : `${source.layer} verification layer`;
}

export function formatInstallErrorMessage<TCode extends InstallErrorCode>(
  code: TCode,
  details: InstallErrorDetails<TCode>,
): string {
  return INSTALL_ERROR_MESSAGE_FACTORIES[code](details);
}

export class InstallError<
  TCode extends InstallErrorCode = InstallErrorCode,
> extends Error {
  readonly code: TCode;
  readonly details: InstallErrorDetails<TCode>;

  constructor(
    code: TCode,
    details: InstallErrorDetails<TCode>,
    message = formatInstallErrorMessage(code, details),
  ) {
    super(message);
    this.name = "InstallError";
    this.code = code;
    this.details = details;
  }
}

export function createInstallError<TCode extends InstallErrorCode>(
  code: TCode,
  details: InstallErrorDetails<TCode>,
): InstallError<TCode> {
  return new InstallError(code, details);
}

export function isInstallError(error: unknown): error is InstallError {
  return error instanceof InstallError;
}

export function isInstallErrorCode<TCode extends InstallErrorCode>(
  error: unknown,
  code: TCode,
): error is InstallError<TCode> {
  return isInstallError(error) && error.code === code;
}
