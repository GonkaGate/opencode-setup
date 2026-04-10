import { GONKAGATE_PROVIDER_ID } from "../../constants/gateway.js";
import type {
  CuratedModelKey,
  CuratedModelTransport,
  OpencodeModelRef,
} from "../../constants/models.js";
import type { InstallErrorCode } from "../errors.js";
import type { ManagedConfigScope } from "./managed-config.js";
import type { EffectiveConfigVerificationBlocker } from "./effective-config.js";

export interface InstallFlowSelectionSummary {
  modelDisplayName: string;
  modelKey: CuratedModelKey;
  modelRef: OpencodeModelRef;
  scope: ManagedConfigScope;
}

export type InstallFlowProgress = Partial<InstallFlowSelectionSummary>;

export interface InstallFlowSuccess extends InstallFlowSelectionSummary {
  message: string;
  ok: true;
  providerId: typeof GONKAGATE_PROVIDER_ID;
  status: "success";
  transport: CuratedModelTransport;
}

export type InstallFlowBlocked = InstallFlowProgress & {
  blockers: readonly EffectiveConfigVerificationBlocker[];
  errorCode: Extract<InstallErrorCode, "effective_config_blocked">;
  message: string;
  ok: false;
  status: "blocked";
};

export type InstallFlowFailed = InstallFlowProgress & {
  errorCode: InstallErrorCode | "unexpected_error";
  message: string;
  ok: false;
  status: "failed";
};

export type InstallFlowResult =
  | InstallFlowBlocked
  | InstallFlowFailed
  | InstallFlowSuccess;
