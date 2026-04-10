import type { ManagedArtifactRollbackAction } from "./contracts/managed-artifact.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import { writeManagedTextFile } from "./managed-files.js";

export async function rollbackManagedWrites(
  rollbackActions: readonly ManagedArtifactRollbackAction[],
  dependencies: InstallDependencies,
): Promise<void> {
  try {
    for (const rollbackAction of [...rollbackActions].reverse()) {
      await rollbackManagedWrite(rollbackAction, dependencies);
    }
  } catch (cause) {
    throw createInstallError("managed_rollback_failed", {
      cause,
    });
  }
}

async function rollbackManagedWrite(
  rollbackAction: ManagedArtifactRollbackAction,
  dependencies: InstallDependencies,
): Promise<void> {
  switch (rollbackAction.kind) {
    case "restore_backup": {
      const backupContents = await dependencies.fs.readFile(
        rollbackAction.backupPath,
        "utf8",
      );

      await writeManagedTextFile(
        dependencies,
        rollbackAction.path,
        backupContents,
      );
      return;
    }
    case "delete_created_file":
      if (await dependencies.fs.pathExists(rollbackAction.path)) {
        await dependencies.fs.removeFile(rollbackAction.path);
      }
      return;
    default:
      assertNever(rollbackAction);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled rollback action: ${JSON.stringify(value)}`);
}
