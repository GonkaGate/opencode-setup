import { GONKAGATE_MODELS_URL } from "../constants/gateway.js";
import {
  createGonkagateModel,
  type ValidatedCuratedModel,
} from "../constants/models.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";

export async function fetchGonkagateModels(
  apiKey: string,
  dependencies: Pick<InstallDependencies, "http">,
): Promise<readonly ValidatedCuratedModel[]> {
  let response;

  try {
    response = await dependencies.http.fetch(GONKAGATE_MODELS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      method: "GET",
    });
  } catch (cause) {
    throw createInstallError("model_catalog_fetch_failed", {
      cause,
      url: GONKAGATE_MODELS_URL,
    });
  }

  if (!response.ok) {
    throw createInstallError("model_catalog_fetch_failed", {
      status: response.status,
      statusText: response.statusText,
      url: GONKAGATE_MODELS_URL,
    });
  }

  return parseGonkagateModelsResponse(
    await response.text(),
    GONKAGATE_MODELS_URL,
  );
}

export function parseGonkagateModelsResponse(
  body: string,
  url = GONKAGATE_MODELS_URL,
): readonly ValidatedCuratedModel[] {
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(body) as unknown;
  } catch {
    throw createInstallError("model_catalog_invalid", {
      reason: "response body is not valid JSON",
      url,
    });
  }

  if (!isObjectRecord(parsedBody) || !Array.isArray(parsedBody.data)) {
    throw createInstallError("model_catalog_invalid", {
      reason: "expected an object with a data array",
      url,
    });
  }

  const models = new Map<string, ValidatedCuratedModel>();

  for (const entry of parsedBody.data) {
    const model = parseModelEntry(entry, url);

    if (!models.has(model.key)) {
      models.set(model.key, model);
    }
  }

  if (models.size === 0) {
    throw createInstallError("model_catalog_invalid", {
      reason: "data must include at least one model id",
      url,
    });
  }

  return Object.freeze([...models.values()]);
}

function parseModelEntry(entry: unknown, url: string): ValidatedCuratedModel {
  if (!isObjectRecord(entry)) {
    throw createInstallError("model_catalog_invalid", {
      reason: "each data entry must be an object",
      url,
    });
  }

  const rawId = entry.id;
  const rawName = entry.name;

  if (typeof rawId !== "string" || rawId.trim().length === 0) {
    throw createInstallError("model_catalog_invalid", {
      reason: "each data entry must include a non-empty string id",
      url,
    });
  }

  if (rawName !== undefined && typeof rawName !== "string") {
    throw createInstallError("model_catalog_invalid", {
      reason: "model name must be a string when present",
      url,
    });
  }

  const id = rawId.trim();
  const name = rawName?.trim();

  return createGonkagateModel(id, name === "" ? undefined : name);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
