import {
  applyManagedConfigMutations,
  readManagedConfigDocument,
} from "./config.js";
import type {
  ManagedConfigTarget,
  ManagedConfigTargetPlan,
  ManagedConfigWriteContext,
  ManagedConfigWriteResult,
} from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createManagedConfigMutations } from "./managed-config-mutations.js";
import type { ManagedPaths } from "./paths.js";
import { resolveProjectConfigBackupDirectory } from "./paths.js";
import { writeManagedConfig } from "./write.js";

export interface ManagedConfigTargetWriteRequest<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> {
  targetPlan: ManagedConfigTargetPlan<TTarget>;
  writeContext: ManagedConfigWriteContext;
}

export async function writeManagedConfigTarget<
  TTarget extends ManagedConfigTarget,
>(
  request: ManagedConfigTargetWriteRequest<TTarget>,
  dependencies: InstallDependencies,
): Promise<ManagedConfigWriteResult<TTarget>> {
  const targetPath = resolveManagedConfigTargetPath(
    request.targetPlan.target,
    request.writeContext.managedPaths,
  );
  const document = await readManagedConfigDocument(
    request.targetPlan.target,
    targetPath,
    dependencies,
  );
  const mutations = createManagedConfigMutations({
    currentConfig: document.initialValue,
    mutationInputs: request.writeContext,
    targetPlan: request.targetPlan,
  });
  const nextContents = applyManagedConfigMutations(document, mutations);

  return await writeManagedConfig(document, nextContents, dependencies, {
    backupDirectoryPath: resolveManagedConfigBackupDirectoryPath(
      request.targetPlan.target,
      request.writeContext.managedPaths,
      dependencies.runtime.platform,
    ),
  });
}

function resolveManagedConfigTargetPath(
  target: ManagedConfigTarget,
  managedPaths: ManagedPaths,
): string {
  return target === "user_config"
    ? managedPaths.userConfigPath
    : managedPaths.projectConfigPath;
}

function resolveManagedConfigBackupDirectoryPath(
  target: ManagedConfigTarget,
  managedPaths: ManagedPaths,
  platform: NodeJS.Platform,
): string | undefined {
  if (target !== "project_config") {
    return undefined;
  }

  return resolveProjectConfigBackupDirectory(managedPaths, platform);
}
