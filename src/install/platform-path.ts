import path from "node:path";

export type InstallPathApi = Pick<
  typeof path.posix,
  | "basename"
  | "dirname"
  | "isAbsolute"
  | "join"
  | "normalize"
  | "parse"
  | "relative"
  | "resolve"
>;

const WINDOWS_POSIX_DRIVE_PATH_PATTERN = /^\/([A-Za-z])(?=\/|$)/u;

export function getInstallPathApi(platform: NodeJS.Platform): InstallPathApi {
  return platform === "win32" ? path.win32 : path.posix;
}

export function normalizeInstallPath(
  pathValue: string,
  platform: NodeJS.Platform,
): string {
  const pathApi = getInstallPathApi(platform);

  if (platform !== "win32") {
    return pathApi.normalize(pathValue);
  }

  const gitBashMatch = pathValue.match(WINDOWS_POSIX_DRIVE_PATH_PATTERN);

  if (gitBashMatch === null) {
    return pathApi.normalize(pathValue);
  }

  const rest = pathValue.slice(2).replaceAll("/", "\\");

  return pathApi.normalize(`${gitBashMatch[1]!.toUpperCase()}:${rest || "\\"}`);
}

export function isPathInside(
  parentPath: string,
  targetPath: string,
  platform: NodeJS.Platform,
): boolean {
  const pathApi = getInstallPathApi(platform);
  const normalizedParent = normalizeInstallPath(parentPath, platform);
  const normalizedTarget = normalizeInstallPath(targetPath, platform);
  const relativePath = pathApi.relative(
    platform === "win32" ? normalizedParent.toLowerCase() : normalizedParent,
    platform === "win32" ? normalizedTarget.toLowerCase() : normalizedTarget,
  );

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath))
  );
}
