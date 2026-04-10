import assert from "node:assert/strict";
import { parse } from "jsonc-parser";
import {
  isInstallErrorCode,
  type InstallErrorCode,
} from "../../src/install/errors.js";

interface TextReadableFs {
  readText(path: string): string | undefined;
}

export function expectInstallErrorCode(
  code: InstallErrorCode,
): (error: unknown) => boolean {
  return (error: unknown) => isInstallErrorCode(error, code);
}

export function readWrittenText(
  fs: TextReadableFs,
  path: string,
  description = path,
): string {
  const contents = fs.readText(path);

  if (contents === undefined) {
    assert.fail(`Expected ${description} to be written.`);
  }

  return contents;
}

export function parseWrittenConfig(
  fs: TextReadableFs,
  path: string,
  description = path,
): Record<string, unknown> {
  return parse(readWrittenText(fs, path, description)) as Record<
    string,
    unknown
  >;
}

export function expectObject(
  value: unknown,
  description: string,
): Record<string, unknown> {
  assert.equal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    true,
    `Expected ${description} to be an object.`,
  );

  return value as Record<string, unknown>;
}
