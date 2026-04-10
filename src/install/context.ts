import type { InstallDependencies, InstallRuntimeEnvironment } from "./deps.js";
import { detectOpenCode, type DetectedOpenCode } from "./opencode.js";
import {
  resolveManagedPaths,
  resolveProjectRoot,
  type ManagedPaths,
  type ProjectRootResolution,
} from "./paths.js";

export type InstallPlatformId =
  | "darwin"
  | "linux"
  | "other"
  | "windows"
  | "wsl";
export type InstallPlatformSupport = "v1_supported" | "unverified";

export interface InstallPlatformInfo {
  id: InstallPlatformId;
  nodePlatform: NodeJS.Platform;
  support: InstallPlatformSupport;
}

export interface InstallRuntimeContext {
  homeDir: string;
  platform: InstallPlatformInfo;
}

export interface InstallWorkspaceContext extends ProjectRootResolution {
  managedPaths: ManagedPaths;
}

export interface ResolvedInstallContext {
  opencode: DetectedOpenCode;
  runtime: InstallRuntimeContext;
  workspace: InstallWorkspaceContext;
}

type InstallPlatformRuntime = Pick<
  InstallRuntimeEnvironment,
  "env" | "osRelease" | "platform"
>;

export async function resolveInstallContext(
  dependencies: InstallDependencies,
  options?: {
    cwd?: string;
  },
): Promise<ResolvedInstallContext> {
  const [workspaceLocation, opencode] = await Promise.all([
    resolveProjectRoot(dependencies, options?.cwd),
    detectOpenCode(dependencies),
  ]);

  return {
    opencode,
    runtime: resolveRuntimeContext(dependencies.runtime),
    workspace: {
      ...workspaceLocation,
      managedPaths: resolveManagedPaths(
        dependencies.runtime.homeDir,
        workspaceLocation.projectRoot,
        dependencies.runtime.platform,
      ),
    },
  };
}

export function isWslEnvironment(runtime: InstallPlatformRuntime): boolean {
  if (runtime.platform !== "linux") {
    return false;
  }

  const release = runtime.osRelease.toLowerCase();

  return (
    runtime.env.WSL_DISTRO_NAME !== undefined ||
    runtime.env.WSL_INTEROP !== undefined ||
    release.includes("microsoft")
  );
}

export function classifyInstallPlatform(
  runtime: InstallPlatformRuntime,
): InstallPlatformInfo {
  const isWsl = isWslEnvironment(runtime);

  if (runtime.platform === "darwin") {
    return {
      id: "darwin",
      nodePlatform: runtime.platform,
      support: "v1_supported",
    };
  }

  if (runtime.platform === "linux" && isWsl) {
    return {
      id: "wsl",
      nodePlatform: runtime.platform,
      support: "v1_supported",
    };
  }

  if (runtime.platform === "linux") {
    return {
      id: "linux",
      nodePlatform: runtime.platform,
      support: "v1_supported",
    };
  }

  if (runtime.platform === "win32") {
    return {
      id: "windows",
      nodePlatform: runtime.platform,
      support: "v1_supported",
    };
  }

  return {
    id: "other",
    nodePlatform: runtime.platform,
    support: "unverified",
  };
}

function resolveRuntimeContext(
  runtime: InstallRuntimeEnvironment,
): InstallRuntimeContext {
  return {
    homeDir: runtime.homeDir,
    platform: classifyInstallPlatform(runtime),
  };
}
