import type {
  CuratedModelCompatibility,
  CuratedModelKey,
  CuratedModelTransport,
  OpencodeModelRef,
} from "../../constants/models.js";
import type { JsonValue } from "../../json.js";

export type EffectiveConfigVerificationBlockingLayer =
  | "OPENCODE_CONFIG"
  | "OPENCODE_CONFIG_CONTENT"
  | "inferred_higher_precedence"
  | "project_config"
  | "system_managed_config"
  | "user_config";

export type EffectiveConfigVerificationFileBackedLayer = Exclude<
  EffectiveConfigVerificationBlockingLayer,
  "OPENCODE_CONFIG_CONTENT" | "inferred_higher_precedence"
>;

export type EffectiveConfigVerificationResolvedLayer = "resolved_config";

export type EffectiveConfigVerificationLayer =
  | EffectiveConfigVerificationBlockingLayer
  | EffectiveConfigVerificationResolvedLayer;

export type EffectiveConfigVerificationFileLayerSource = {
  kind: "file";
  layer: EffectiveConfigVerificationFileBackedLayer;
  path: string;
};

export type EffectiveConfigVerificationInlineLayerSource = {
  kind: "inline";
  layer: "OPENCODE_CONFIG_CONTENT";
};

export type EffectiveConfigVerificationResolvedLayerSource = {
  kind: "resolved";
  layer: EffectiveConfigVerificationResolvedLayer;
};

export type EffectiveConfigVerificationInputLayerSource =
  | EffectiveConfigVerificationFileLayerSource
  | EffectiveConfigVerificationInlineLayerSource;

export type EffectiveConfigVerificationLayerSource =
  | EffectiveConfigVerificationInputLayerSource
  | EffectiveConfigVerificationResolvedLayerSource;

export interface EffectiveConfigVerificationTarget {
  modelKey: CuratedModelKey;
  modelRef: OpencodeModelRef;
  providerId: string;
  runtimeCompatibility?: CuratedModelCompatibility;
  transport: CuratedModelTransport;
}

export type EffectiveConfigDiagnosticData = JsonValue;

export type EffectiveConfigDiagnosticValue =
  | {
      kind: "undefined";
    }
  | {
      kind: "value";
      value: EffectiveConfigDiagnosticData;
    };

interface EffectiveConfigVerificationIssue<
  TLayer extends EffectiveConfigVerificationLayer,
> {
  key: string;
  layer: TLayer;
  reason: string;
}

export interface EffectiveConfigVerificationBlocker extends EffectiveConfigVerificationIssue<EffectiveConfigVerificationBlockingLayer> {}

export interface EffectiveConfigVerificationMismatch extends EffectiveConfigVerificationIssue<EffectiveConfigVerificationResolvedLayer> {
  actualValue: EffectiveConfigDiagnosticValue;
  expectedValue: EffectiveConfigDiagnosticValue;
}

export interface EffectiveConfigVerificationSuccess {
  blockers: readonly [];
  ok: true;
  resolvedMatch: true;
  target: EffectiveConfigVerificationTarget;
}
