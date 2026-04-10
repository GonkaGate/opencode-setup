import { createHash } from "node:crypto";
import { classifyInstallPlatform } from "./context.js";
import type { InstallDependencies } from "./deps.js";
import type {
  ChangedManagedArtifactWriteResult,
  ManagedArtifactWriteResult,
} from "./contracts/managed-artifact.js";
import {
  getInstallPathApi,
  isPathInside,
  normalizeInstallPath,
} from "./platform-path.js";

export const POSIX_MANAGED_DIRECTORY_MODE = 0o700;
export const POSIX_MANAGED_FILE_MODE = 0o600;

export type ManagedFileProtectionStrategy =
  | {
      directoryMode: number;
      fileMode: number;
      kind: "posix_owner_only";
    }
  | {
      homeDirectory: string;
      kind: "windows_profile_inheritance";
    }
  | {
      kind: "platform_default";
    };

export type ManagedTextFileWriteResult = ManagedArtifactWriteResult;
export type ChangedManagedTextFileWriteResult =
  ChangedManagedArtifactWriteResult;

export interface ManagedTextArtifactWriteRequest<
  TResult extends ChangedManagedTextFileWriteResult =
    ChangedManagedTextFileWriteResult,
> {
  backupDirectoryPath?: string;
  contents: string;
  mapBackupError: (cause: unknown) => Error;
  mapWriteError: (cause: unknown) => Error;
  path: string;
  toWriteResult?: (result: ChangedManagedTextFileWriteResult) => TResult;
}

export function formatBackupTimestamp(date: Date): string {
  return date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

export function supportsOwnerOnlyPermissions(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return (
    resolveManagedFileProtectionStrategy(dependencies).kind ===
    "posix_owner_only"
  );
}

export function resolveManagedFileProtectionStrategy(
  dependencies: Pick<InstallDependencies, "runtime">,
): ManagedFileProtectionStrategy {
  const platform = classifyInstallPlatform(dependencies.runtime);

  if (
    platform.id === "darwin" ||
    platform.id === "linux" ||
    platform.id === "wsl"
  ) {
    return {
      directoryMode: POSIX_MANAGED_DIRECTORY_MODE,
      fileMode: POSIX_MANAGED_FILE_MODE,
      kind: "posix_owner_only",
    };
  }

  if (platform.id === "windows") {
    return {
      homeDirectory: normalizeInstallPath(
        dependencies.runtime.homeDir,
        dependencies.runtime.platform,
      ),
      kind: "windows_profile_inheritance",
    };
  }

  return {
    kind: "platform_default",
  };
}

export function assertUserProfileScopedManagedPath(
  dependencies: Pick<InstallDependencies, "runtime">,
  targetPath: string,
): void {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);

  if (protectionStrategy.kind !== "windows_profile_inheritance") {
    return;
  }

  if (
    isPathInside(
      protectionStrategy.homeDirectory,
      targetPath,
      dependencies.runtime.platform,
    )
  ) {
    return;
  }

  throw new Error(
    "Windows-managed user files must stay inside the current user's profile directory.",
  );
}

export async function ensureManagedDirectory(
  dependencies: InstallDependencies,
  targetPath: string,
): Promise<string> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );
  const directoryPath = pathApi.dirname(normalizedTargetPath);

  await dependencies.fs.mkdir(directoryPath, {
    recursive: true,
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(
      directoryPath,
      protectionStrategy.directoryMode,
    );
  }

  return directoryPath;
}

export async function ensureManagedFileProtection(
  dependencies: InstallDependencies,
  targetPath: string,
): Promise<void> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );

  await ensureManagedDirectory(dependencies, normalizedTargetPath);

  if (protectionStrategy.kind !== "posix_owner_only") {
    return;
  }

  if (!(await dependencies.fs.pathExists(normalizedTargetPath))) {
    return;
  }

  await dependencies.fs.chmod(
    normalizedTargetPath,
    protectionStrategy.fileMode,
  );
}

export async function createTimestampedBackup(
  dependencies: InstallDependencies,
  targetPath: string,
  backupDirectoryPath?: string,
): Promise<string> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );
  const normalizedBackupDirectoryPath =
    backupDirectoryPath === undefined
      ? pathApi.dirname(normalizedTargetPath)
      : normalizeInstallPath(
          backupDirectoryPath,
          dependencies.runtime.platform,
        );
  const backupPath = pathApi.join(
    normalizedBackupDirectoryPath,
    formatBackupFileName(
      normalizedTargetPath,
      dependencies.clock.now(),
      dependencies.runtime.platform,
      backupDirectoryPath !== undefined,
    ),
  );
  const existingContents = await dependencies.fs.readFile(
    normalizedTargetPath,
    "utf8",
  );

  await ensureManagedDirectory(dependencies, backupPath);

  await dependencies.fs.writeFile(backupPath, existingContents, {
    encoding: "utf8",
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(backupPath, protectionStrategy.fileMode);
  }

  return backupPath;
}

function formatBackupFileName(
  targetPath: string,
  now: Date,
  platform: NodeJS.Platform,
  includePathHash: boolean,
): string {
  const pathApi = getInstallPathApi(platform);
  const baseName = pathApi.basename(targetPath);

  if (!includePathHash) {
    return `${baseName}.bak-${formatBackupTimestamp(now)}`;
  }

  const pathHash = createHash("sha256")
    .update(targetPath)
    .digest("hex")
    .slice(0, 12);

  return `${baseName}.${pathHash}.bak-${formatBackupTimestamp(now)}`;
}

export async function writeManagedTextFile(
  dependencies: InstallDependencies,
  targetPath: string,
  contents: string,
): Promise<void> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );

  await ensureManagedDirectory(dependencies, normalizedTargetPath);

  const mode =
    protectionStrategy.kind === "posix_owner_only"
      ? protectionStrategy.fileMode
      : undefined;

  await dependencies.fs.writeFileAtomic(normalizedTargetPath, contents, {
    encoding: "utf8",
    mode,
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(
      normalizedTargetPath,
      protectionStrategy.fileMode,
    );
  }
}

export async function replaceManagedTextFile<
  TResult extends ChangedManagedTextFileWriteResult =
    ChangedManagedTextFileWriteResult,
>(
  request: ManagedTextArtifactWriteRequest<TResult>,
  dependencies: InstallDependencies,
): Promise<TResult> {
  const normalizedPath = normalizeInstallPath(
    request.path,
    dependencies.runtime.platform,
  );
  const existedBefore = await dependencies.fs.pathExists(normalizedPath);

  if (existedBefore) {
    let backupPath: string;

    try {
      backupPath = await createTimestampedBackup(
        dependencies,
        normalizedPath,
        request.backupDirectoryPath,
      );
    } catch (cause) {
      throw request.mapBackupError(cause);
    }

    try {
      await writeManagedTextFile(
        dependencies,
        normalizedPath,
        request.contents,
      );
    } catch (cause) {
      throw request.mapWriteError(cause);
    }

    const result: ChangedManagedTextFileWriteResult = {
      backupPath,
      changed: true,
      existedBefore: true,
      path: normalizedPath,
      rollbackAction: {
        backupPath,
        kind: "restore_backup",
        path: normalizedPath,
      },
    };

    return request.toWriteResult === undefined
      ? (result as TResult)
      : request.toWriteResult(result);
  }

  try {
    await writeManagedTextFile(dependencies, normalizedPath, request.contents);
  } catch (cause) {
    throw request.mapWriteError(cause);
  }

  const result: ChangedManagedTextFileWriteResult = {
    backupPath: undefined,
    changed: true,
    existedBefore: false,
    path: normalizedPath,
    rollbackAction: {
      kind: "delete_created_file",
      path: normalizedPath,
    },
  };

  return request.toWriteResult === undefined
    ? (result as TResult)
    : request.toWriteResult(result);
}
