import { CURRENT_TRANSPORT } from "./gateway.js";

export const GONKAGATE_MODEL_TRANSPORTS = Object.freeze([
  "chat_completions",
  "responses",
] as const);

export type CuratedModelTransport = (typeof GONKAGATE_MODEL_TRANSPORTS)[number];
export type CuratedModelKey = string;

export interface GonkagateModel {
  displayName: string;
  key: CuratedModelKey;
  modelId: string;
  transport: CuratedModelTransport;
}

export type ValidatedCuratedModel = GonkagateModel;

export type OpencodeModelRef<TKey extends string = string> =
  `gonkagate/${TKey}`;

export function createGonkagateModel(
  id: string,
  name: string | undefined,
): GonkagateModel {
  return {
    displayName: name ?? id,
    key: id,
    modelId: id,
    transport: CURRENT_TRANSPORT,
  };
}

export function isCuratedModelKey(key: string): key is CuratedModelKey {
  return key.trim().length > 0;
}

export function isCuratedModelTransport(
  value: unknown,
): value is CuratedModelTransport {
  return (
    typeof value === "string" &&
    GONKAGATE_MODEL_TRANSPORTS.includes(value as CuratedModelTransport)
  );
}

export function formatOpencodeModelRef<TKey extends string>(
  model: TKey | { key: TKey },
): OpencodeModelRef<TKey> {
  const modelKey = typeof model === "string" ? model : model.key;
  return `gonkagate/${modelKey}`;
}
