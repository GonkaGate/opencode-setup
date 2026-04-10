import type { ManagedPaths } from "./paths.js";
import type { ResolvedSecretInput } from "./secrets.js";
import type { InstallDependencies } from "./deps.js";
import type { ManagedArtifactWriteResult } from "./contracts/managed-artifact.js";
import {
  assertUserProfileScopedManagedPath,
  ensureManagedFileProtection,
  replaceManagedTextFile,
} from "./managed-files.js";
import { createInstallError } from "./errors.js";

export type ManagedSecretWriteResult = ManagedArtifactWriteResult;

export async function readManagedSecret(
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<string | undefined> {
  assertUserProfileScopedManagedPath(dependencies, managedPaths.secretPath);

  if (!(await dependencies.fs.pathExists(managedPaths.secretPath))) {
    return undefined;
  }

  return await dependencies.fs.readFile(managedPaths.secretPath, "utf8");
}

export async function writeManagedSecret(
  secretInput: ResolvedSecretInput,
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<ManagedSecretWriteResult> {
  try {
    assertUserProfileScopedManagedPath(dependencies, managedPaths.secretPath);
  } catch (cause) {
    throw createInstallError("managed_secret_write_failed", {
      cause,
      source: secretInput.source,
      target: "managed_secret",
    });
  }

  const existedBefore = await dependencies.fs.pathExists(
    managedPaths.secretPath,
  );
  const existingSecret = existedBefore
    ? await dependencies.fs.readFile(managedPaths.secretPath, "utf8")
    : undefined;

  if (existingSecret === secretInput.secret) {
    try {
      await ensureManagedFileProtection(dependencies, managedPaths.secretPath);
    } catch (cause) {
      throw createInstallError("managed_secret_write_failed", {
        cause,
        source: secretInput.source,
        target: "managed_secret",
      });
    }

    return {
      backupPath: undefined,
      changed: false,
      existedBefore,
      path: managedPaths.secretPath,
      rollbackAction: undefined,
    };
  }

  return await replaceManagedTextFile(
    {
      contents: secretInput.secret,
      mapBackupError: (cause) =>
        createInstallError("managed_secret_backup_failed", {
          cause,
          source: secretInput.source,
          target: "managed_secret",
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_secret_write_failed", {
          cause,
          source: secretInput.source,
          target: "managed_secret",
        }),
      path: managedPaths.secretPath,
    },
    dependencies,
  );
}
