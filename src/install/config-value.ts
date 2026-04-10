export function getNestedConfigValue(
  value: unknown,
  path: readonly string[],
): unknown {
  let currentValue = value;

  for (const segment of path) {
    if (
      currentValue === null ||
      typeof currentValue !== "object" ||
      Array.isArray(currentValue) ||
      !Object.hasOwn(currentValue, segment)
    ) {
      return undefined;
    }

    currentValue = (currentValue as Record<string, unknown>)[segment];
  }

  return currentValue;
}

export function hasNestedConfigValue(
  value: unknown,
  path: readonly string[],
): boolean {
  return getNestedConfigValue(value, path) !== undefined;
}

export function getStringArrayConfigValue(
  root: Record<string, unknown>,
  path: readonly string[],
): string[] | undefined {
  const value = getNestedConfigValue(root, path);

  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value;
  }

  return undefined;
}
