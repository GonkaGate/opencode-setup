import { CONTRACT_METADATA } from "../constants/contract.js";
import type { CuratedModelKey } from "../constants/models.js";
import { resolveInstallContext } from "./context.js";
import type { ManagedArtifactRollbackAction } from "./contracts/managed-artifact.js";
import type { ManagedConfigScope } from "./contracts/managed-config.js";
import type { InstallFlowResult } from "./contracts/install-flow.js";
import type { InstallDependencies } from "./deps.js";
import { isInstallError, isInstallErrorCode } from "./errors.js";
import { redactSecretBearingText } from "./redact.js";
import { rollbackManagedWrites } from "./rollback.js";
import { resolveInstallModel, resolveInstallScope } from "./selection.js";
import { resolveSecretInput } from "./secrets.js";
import {
  createInstallProgressStateForModel,
  createSuccessfulInstallResult,
  prepareInstallSession,
  type InstallProgressState,
  type PreparedInstallSession,
} from "./session.js";
import {
  createManagedWriteTransaction,
  type ManagedWriteTransaction,
} from "./managed-write-transaction.js";
import { writeScopeManagedConfigs } from "./scope.js";
import { readManagedInstallState, writeManagedInstallState } from "./state.js";
import { writeManagedSecret } from "./storage.js";
import {
  verifyCurrentSessionEffectiveConfig,
  verifyEffectiveConfig,
} from "./verify-effective.js";

export interface InstallFlowRequest {
  apiKeyStdin: boolean;
  cwd?: string;
  modelKey?: string;
  scope?: ManagedConfigScope;
  yes: boolean;
}

export async function runInstallFlow(
  request: InstallFlowRequest,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult> {
  let progressState: InstallProgressState = {};
  const managedWrites = createManagedWriteTransaction();
  let installFlow: PreparedInstallSession;

  try {
    const context = await resolveInstallContext(dependencies, {
      cwd: request.cwd,
    });
    const model = await resolveInstallModel(
      {
        modelKey: request.modelKey,
        yes: request.yes,
      },
      dependencies,
    );

    progressState = createInstallProgressStateForModel(model);

    const scope = await resolveInstallScope(
      {
        insideGitRepository: context.workspace.insideGitRepository,
        scope: request.scope,
        yes: request.yes,
      },
      dependencies,
    );
    installFlow = prepareInstallSession(context, model, scope);

    progressState = installFlow.summary;
  } catch (error) {
    return buildInstallResultFromError(error, progressState);
  }

  try {
    await applyManagedWrites(request, installFlow, managedWrites, dependencies);
    await verifyPreparedInstall(installFlow, dependencies);
    await persistInstallState(installFlow, managedWrites, dependencies);
  } catch (error) {
    return await buildInstallFailureResult(
      error,
      progressState,
      managedWrites.rollbackActions,
      dependencies,
    );
  }

  const currentSessionResult = await verifyCurrentSessionInstall(
    installFlow,
    progressState,
    dependencies,
  );

  return currentSessionResult ?? createSuccessfulInstallResult(installFlow);
}

async function applyManagedWrites(
  request: InstallFlowRequest,
  installFlow: PreparedInstallSession,
  managedWrites: ManagedWriteTransaction,
  dependencies: InstallDependencies,
): Promise<void> {
  const previousInstallState = await readManagedInstallState(
    dependencies,
    installFlow.context.workspace.managedPaths,
  );

  await writeManagedSecretForInstall(
    request,
    installFlow,
    managedWrites,
    dependencies,
  );
  await writeManagedConfigsForInstall(
    installFlow,
    previousInstallState?.selectedModelKey,
    managedWrites,
    dependencies,
  );
}

async function writeManagedSecretForInstall(
  request: InstallFlowRequest,
  installFlow: PreparedInstallSession,
  managedWrites: ManagedWriteTransaction,
  dependencies: InstallDependencies,
): Promise<void> {
  const secretInput = await resolveSecretInput(
    {
      apiKeyStdin: request.apiKeyStdin,
    },
    dependencies,
  );
  await managedWrites.run(
    writeManagedSecret(
      secretInput,
      dependencies,
      installFlow.context.workspace.managedPaths,
    ),
  );
}

async function writeManagedConfigsForInstall(
  installFlow: PreparedInstallSession,
  previousManagedModelKey: CuratedModelKey | undefined,
  managedWrites: ManagedWriteTransaction,
  dependencies: InstallDependencies,
): Promise<void> {
  await managedWrites.runAll(
    writeScopeManagedConfigs(
      {
        managedPaths: installFlow.context.workspace.managedPaths,
        model: installFlow.model.key,
        previousManagedModelKey,
        scope: installFlow.summary.scope,
      },
      dependencies,
    ).then(
      ({ projectConfig, userConfig }) => [userConfig, projectConfig] as const,
    ),
  );
}

async function verifyPreparedInstall(
  installFlow: PreparedInstallSession,
  dependencies: InstallDependencies,
): Promise<void> {
  await verifyEffectiveConfig(
    {
      context: installFlow.context,
      model: installFlow.model.key,
      scope: installFlow.summary.scope,
    },
    dependencies,
  );
}

async function verifyCurrentSessionInstall(
  installFlow: PreparedInstallSession,
  progressState: InstallProgressState,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult | undefined> {
  if (dependencies.runtime.env.OPENCODE_CONFIG_CONTENT === undefined) {
    return undefined;
  }

  try {
    await verifyCurrentSessionEffectiveConfig(
      {
        context: installFlow.context,
        model: installFlow.model.key,
        scope: installFlow.summary.scope,
      },
      dependencies,
    );
  } catch (error) {
    return buildCurrentSessionResultFromError(error, progressState);
  }

  return undefined;
}

async function persistInstallState(
  installFlow: PreparedInstallSession,
  managedWrites: ManagedWriteTransaction,
  dependencies: InstallDependencies,
): Promise<void> {
  await managedWrites.run(
    writeManagedInstallState(
      {
        currentTransport: installFlow.model.transport,
        installerVersion: CONTRACT_METADATA.cliVersion,
        lastDurableSetupAt: dependencies.clock.now().toISOString(),
        selectedModelKey: installFlow.model.key,
        selectedScope: installFlow.summary.scope,
      },
      dependencies,
      installFlow.context.workspace.managedPaths,
    ),
  );
}

async function buildInstallFailureResult(
  error: unknown,
  progressState: InstallProgressState,
  rollbackActions: readonly ManagedArtifactRollbackAction[],
  dependencies: InstallDependencies,
): Promise<InstallFlowResult> {
  if (rollbackActions.length === 0) {
    return buildInstallResultFromError(error, progressState);
  }

  try {
    await rollbackManagedWrites(rollbackActions, dependencies);
  } catch (rollbackError) {
    return buildFailedInstallResult(rollbackError, progressState);
  }

  return buildInstallResultFromError(error, progressState);
}

function buildInstallResultFromError(
  error: unknown,
  progressState: InstallProgressState,
): InstallFlowResult {
  if (isInstallErrorCode(error, "effective_config_blocked")) {
    return {
      ...progressState,
      blockers: error.details.blockers,
      errorCode: error.code,
      message: error.message,
      ok: false,
      status: "blocked",
    };
  }

  return buildFailedInstallResult(error, progressState);
}

function buildFailedInstallResult(
  error: unknown,
  progressState: InstallProgressState,
): InstallFlowResult {
  return {
    ...progressState,
    errorCode: isInstallError(error) ? error.code : "unexpected_error",
    message: formatInstallFailureMessage(error),
    ok: false,
    status: "failed",
  };
}

function buildCurrentSessionResultFromError(
  error: unknown,
  progressState: InstallProgressState,
): InstallFlowResult {
  if (isInstallErrorCode(error, "effective_config_blocked")) {
    return {
      ...progressState,
      blockers: error.details.blockers,
      errorCode: error.code,
      message:
        "GonkaGate was installed durably, but the current shell is still overridden by OPENCODE_CONFIG_CONTENT.",
      ok: false,
      status: "blocked",
    };
  }

  return {
    ...progressState,
    errorCode: isInstallError(error) ? error.code : "unexpected_error",
    message: formatCurrentSessionFailureMessage(error),
    ok: false,
    status: "failed",
  };
}

function formatInstallFailureMessage(error: unknown): string {
  if (isInstallError(error)) {
    return redactSecretBearingText(error.message);
  }

  if (error instanceof Error) {
    return redactSecretBearingText(error.message);
  }

  return redactSecretBearingText(String(error));
}

function formatCurrentSessionFailureMessage(error: unknown): string {
  return `GonkaGate was installed durably, but the current shell could not be verified. ${formatInstallFailureMessage(error)}`;
}
