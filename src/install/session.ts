import { GONKAGATE_PROVIDER_ID } from "../constants/gateway.js";
import type {
  CuratedModelKey,
  OpencodeModelRef,
  ValidatedCuratedModel,
} from "../constants/models.js";
import { formatOpencodeModelRef } from "../constants/models.js";
import type { ResolvedInstallContext } from "./context.js";
import type {
  InstallFlowProgress,
  InstallFlowSelectionSummary,
  InstallFlowSuccess,
} from "./contracts/install-flow.js";
import type { ManagedConfigScope } from "./contracts/managed-config.js";

export type InstallProgressState = InstallFlowProgress;

export interface PreparedInstallSession {
  context: ResolvedInstallContext;
  model: ValidatedCuratedModel;
  summary: InstallFlowSelectionSummary;
}

export function createInstallProgressStateForModel(
  model: ValidatedCuratedModel,
): Omit<InstallFlowSelectionSummary, "scope"> {
  return {
    modelDisplayName: model.displayName,
    modelKey: model.key,
    modelRef: formatOpencodeModelRef(model),
  };
}

export function prepareInstallSession(
  context: ResolvedInstallContext,
  model: ValidatedCuratedModel,
  scope: ManagedConfigScope,
): PreparedInstallSession {
  return {
    context,
    model,
    summary: {
      ...createInstallProgressStateForModel(model),
      scope,
    },
  };
}

export function createSuccessfulInstallResult(
  session: PreparedInstallSession,
): InstallFlowSuccess {
  return {
    message: "GonkaGate is configured for OpenCode.",
    ...session.summary,
    ok: true,
    providerId: GONKAGATE_PROVIDER_ID,
    status: "success",
    transport: session.model.transport,
  };
}
