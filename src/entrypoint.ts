import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

function tryResolveRealPath(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

export function isEntrypointInvocation(
  importMetaUrl: string,
  argv1 = process.argv[1],
): boolean {
  if (argv1 === undefined) {
    return false;
  }

  const importMetaPath = fileURLToPath(importMetaUrl);
  const argv1RealPath = tryResolveRealPath(argv1);
  const importMetaRealPath = tryResolveRealPath(importMetaPath);

  if (argv1RealPath !== undefined && importMetaRealPath !== undefined) {
    return argv1RealPath === importMetaRealPath;
  }

  return importMetaUrl === pathToFileURL(argv1).href;
}
