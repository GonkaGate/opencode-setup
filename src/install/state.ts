import {
  isCuratedModelKey,
  isCuratedModelTransport,
} from "../constants/models.js";
import { isManagedConfigScope } from "./contracts/managed-config.js";
import type { ManagedInstallStateRecord } from "./contracts/install-state.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  assertUserProfileScopedManagedPath,
  replaceManagedTextFile,
  type ChangedManagedTextFileWriteResult,
} from "./managed-files.js";
import type { ManagedPaths } from "./paths.js";

export type ManagedInstallStateWriteResult = ChangedManagedTextFileWriteResult;

export async function writeManagedInstallState(
  record: ManagedInstallStateRecord,
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<ManagedInstallStateWriteResult> {
  try {
    assertUserProfileScopedManagedPath(
      dependencies,
      managedPaths.installStatePath,
    );
  } catch (cause) {
    throw createInstallError("managed_state_write_failed", {
      cause,
      target: "managed_install_state",
    });
  }

  return await replaceManagedTextFile(
    {
      contents: serializeManagedInstallState(record),
      mapBackupError: (cause) =>
        createInstallError("managed_state_backup_failed", {
          cause,
          target: "managed_install_state",
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_state_write_failed", {
          cause,
          target: "managed_install_state",
        }),
      path: managedPaths.installStatePath,
    },
    dependencies,
  );
}

export async function readManagedInstallState(
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<ManagedInstallStateRecord | undefined> {
  assertUserProfileScopedManagedPath(
    dependencies,
    managedPaths.installStatePath,
  );

  if (!(await dependencies.fs.pathExists(managedPaths.installStatePath))) {
    return undefined;
  }

  return parseManagedInstallStateRecord(
    JSON.parse(
      await dependencies.fs.readFile(managedPaths.installStatePath, "utf8"),
    ) as unknown,
  );
}

function serializeManagedInstallState(
  record: ManagedInstallStateRecord,
): string {
  return `${JSON.stringify(
    {
      currentTransport: record.currentTransport,
      installerVersion: record.installerVersion,
      lastDurableSetupAt: record.lastDurableSetupAt,
      selectedModelKey: record.selectedModelKey,
      selectedScope: record.selectedScope,
    },
    null,
    2,
  )}\n`;
}

function parseManagedInstallStateRecord(
  value: unknown,
): ManagedInstallStateRecord {
  if (!isObjectRecord(value)) {
    throw new Error("Managed install state must be a JSON object.");
  }

  const serializedRecord = mapManagedInstallStateStringFields((field) =>
    getRequiredStringField(value, field),
  );
  const currentTransport = serializedRecord.currentTransport;
  const installerVersion = serializedRecord.installerVersion;
  const lastDurableSetupAt = getLastDurableSetupAt(value);
  const selectedModelKey = serializedRecord.selectedModelKey;
  const selectedScope = serializedRecord.selectedScope;

  if (!isCuratedModelKey(selectedModelKey)) {
    throw new Error("Managed install state has an unknown selectedModelKey.");
  }

  if (!isManagedConfigScope(selectedScope)) {
    throw new Error("Managed install state has an unknown selectedScope.");
  }

  if (!isCuratedModelTransport(currentTransport)) {
    throw new Error("Managed install state has an unknown currentTransport.");
  }

  return {
    currentTransport,
    installerVersion,
    lastDurableSetupAt,
    selectedModelKey,
    selectedScope,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredStringField(
  value: Record<string, unknown>,
  key: Exclude<keyof ManagedInstallStateRecord, "lastDurableSetupAt">,
): string {
  const fieldValue = value[key];

  if (typeof fieldValue !== "string") {
    throw new Error(`Managed install state is missing ${key}.`);
  }

  return fieldValue;
}

function getLastDurableSetupAt(value: Record<string, unknown>): string {
  const currentFieldValue = value.lastDurableSetupAt;

  if (typeof currentFieldValue === "string") {
    return currentFieldValue;
  }

  const legacyFieldValue = value.lastSuccessfulSetupAt;

  if (typeof legacyFieldValue === "string") {
    return legacyFieldValue;
  }

  throw new Error("Managed install state is missing lastDurableSetupAt.");
}

function mapManagedInstallStateStringFields(
  mapField: (
    field: Exclude<keyof ManagedInstallStateRecord, "lastDurableSetupAt">,
  ) => string,
) {
  return {
    currentTransport: mapField("currentTransport"),
    installerVersion: mapField("installerVersion"),
    selectedModelKey: mapField("selectedModelKey"),
    selectedScope: mapField("selectedScope"),
  };
}
