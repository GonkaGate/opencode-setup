import type {
  ManagedConfigDocument,
  ManagedConfigTarget,
  ManagedConfigWriteResult,
} from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import { replaceManagedTextFile } from "./managed-files.js";

type ManagedConfigWritableDocument<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> = Pick<
  ManagedConfigDocument<TTarget>,
  "contents" | "exists" | "path" | "target"
>;

export interface WriteManagedConfigOptions {
  backupDirectoryPath?: string;
}

export async function writeManagedConfig<TTarget extends ManagedConfigTarget>(
  document: ManagedConfigWritableDocument<TTarget>,
  nextContents: string,
  dependencies: InstallDependencies,
  options: WriteManagedConfigOptions = {},
): Promise<ManagedConfigWriteResult<TTarget>> {
  if (document.contents === nextContents) {
    return {
      backupPath: undefined,
      changed: false,
      existedBefore: document.exists,
      path: document.path,
      rollbackAction: undefined,
      target: document.target,
    };
  }

  return await replaceManagedTextFile(
    {
      backupDirectoryPath: options.backupDirectoryPath,
      contents: nextContents,
      mapBackupError: (cause) =>
        createInstallError("managed_config_backup_failed", {
          cause,
          path: document.path,
          target: document.target,
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_config_write_failed", {
          cause,
          path: document.path,
          target: document.target,
        }),
      path: document.path,
      toWriteResult: (result) => ({
        ...result,
        target: document.target,
      }),
    },
    dependencies,
  );
}
