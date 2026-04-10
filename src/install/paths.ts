import type { InstallDependencies } from "./deps.js";
import { getInstallPathApi, normalizeInstallPath } from "./platform-path.js";

export interface ManagedPaths {
  installStatePath: string;
  projectConfigPath: string;
  secretPath: string;
  userConfigPath: string;
}

export interface ProjectRootResolution {
  insideGitRepository: boolean;
  projectRoot: string;
  resolvedCwd: string;
}

const SYSTEM_MANAGED_CONFIG_FILE_NAMES = Object.freeze([
  "opencode.json",
  "opencode.jsonc",
] as const);
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/u;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/u;
const WINDOWS_POSIX_DRIVE_PATH_PATTERN = /^\/[A-Za-z](?=\/|$)/u;

function inferPathPlatform(...pathValues: string[]): NodeJS.Platform {
  for (const pathValue of pathValues) {
    if (
      WINDOWS_DRIVE_PATH_PATTERN.test(pathValue) ||
      WINDOWS_UNC_PATH_PATTERN.test(pathValue) ||
      WINDOWS_POSIX_DRIVE_PATH_PATTERN.test(pathValue) ||
      pathValue.includes("\\")
    ) {
      return "win32";
    }
  }

  return "linux";
}

function resolveInstallCwd(
  baseCwd: string,
  platform: NodeJS.Platform,
  cwd?: string,
): string {
  const pathApi = getInstallPathApi(platform);
  const normalizedBaseCwd = normalizeInstallPath(baseCwd, platform);

  if (cwd === undefined) {
    return pathApi.resolve(normalizedBaseCwd);
  }

  const normalizedCwd = normalizeInstallPath(cwd, platform);

  return pathApi.isAbsolute(normalizedCwd)
    ? pathApi.resolve(normalizedCwd)
    : pathApi.resolve(normalizedBaseCwd, normalizedCwd);
}

export async function findNearestGitRoot(
  dependencies: InstallDependencies,
  startDirectory: string,
): Promise<string | undefined> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  let currentDirectory = pathApi.resolve(
    normalizeInstallPath(startDirectory, dependencies.runtime.platform),
  );

  while (true) {
    if (
      await dependencies.fs.pathExists(pathApi.join(currentDirectory, ".git"))
    ) {
      return currentDirectory;
    }

    const parentDirectory = pathApi.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

export async function resolveProjectRoot(
  dependencies: InstallDependencies,
  cwd?: string,
): Promise<ProjectRootResolution> {
  const resolvedCwd = resolveInstallCwd(
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
    cwd,
  );
  const gitRoot = await findNearestGitRoot(dependencies, resolvedCwd);

  return {
    insideGitRepository: gitRoot !== undefined,
    projectRoot: gitRoot ?? resolvedCwd,
    resolvedCwd,
  };
}

export function resolveManagedPaths(
  homeDirectory: string,
  projectRoot: string,
  platform: NodeJS.Platform = inferPathPlatform(homeDirectory, projectRoot),
): ManagedPaths {
  const pathApi = getInstallPathApi(platform);
  const normalizedHomeDirectory = normalizeInstallPath(homeDirectory, platform);
  const normalizedProjectRoot = normalizeInstallPath(projectRoot, platform);

  return {
    installStatePath: pathApi.join(
      normalizedHomeDirectory,
      ".gonkagate",
      "opencode",
      "install-state.json",
    ),
    projectConfigPath: pathApi.join(normalizedProjectRoot, "opencode.json"),
    secretPath: pathApi.join(
      normalizedHomeDirectory,
      ".gonkagate",
      "opencode",
      "api-key",
    ),
    userConfigPath: pathApi.join(
      normalizedHomeDirectory,
      ".config",
      "opencode",
      "opencode.json",
    ),
  };
}

export function resolveProjectConfigBackupDirectory(
  managedPaths: ManagedPaths,
  platform: NodeJS.Platform = inferPathPlatform(managedPaths.installStatePath),
): string {
  const pathApi = getInstallPathApi(platform);
  const normalizedInstallStatePath = normalizeInstallPath(
    managedPaths.installStatePath,
    platform,
  );

  return pathApi.join(
    pathApi.dirname(normalizedInstallStatePath),
    "backups",
    "project-config",
  );
}

export function resolveInspectableSystemManagedConfigPaths(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): readonly string[] {
  const directoryPath = resolveSystemManagedConfigDirectory(env, platform);

  if (directoryPath === undefined) {
    return [];
  }

  const pathApi = getInstallPathApi(platform);

  return SYSTEM_MANAGED_CONFIG_FILE_NAMES.map((fileName) =>
    pathApi.join(directoryPath, fileName),
  );
}

function resolveSystemManagedConfigDirectory(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === "darwin") {
    return "/Library/Application Support/opencode";
  }

  if (platform === "linux") {
    return "/etc/opencode";
  }

  if (platform !== "win32") {
    return undefined;
  }

  const programDataDirectory = getWindowsProgramDataDirectory(env);

  if (programDataDirectory === undefined) {
    return undefined;
  }

  return getInstallPathApi(platform).join(programDataDirectory, "opencode");
}

function getWindowsProgramDataDirectory(
  env: NodeJS.ProcessEnv,
): string | undefined {
  for (const key of [
    "ProgramData",
    "PROGRAMDATA",
    "ALLUSERSPROFILE",
  ] as const) {
    const value = env[key];

    if (value !== undefined && value.length > 0) {
      return normalizeInstallPath(value, "win32");
    }
  }

  return undefined;
}
