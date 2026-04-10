import { applyEdits, modify, type FormattingOptions } from "jsonc-parser";
import type {
  ManagedConfigDocument,
  ManagedConfigMutation,
  ManagedConfigTarget,
} from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  detectConfigDocumentEndOfLine,
  ensureTrailingConfigDocumentNewline,
  formatConfigPath,
  tryParseJsoncObject,
} from "./jsonc.js";

type ManagedConfigMutationDocument<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> = Pick<
  ManagedConfigDocument<TTarget>,
  "contents" | "eol" | "path" | "target"
>;

export async function readManagedConfigDocument<
  TTarget extends ManagedConfigTarget,
>(
  target: TTarget,
  targetPath: string,
  dependencies: InstallDependencies,
): Promise<ManagedConfigDocument<TTarget>> {
  const exists = await dependencies.fs.pathExists(targetPath);

  if (!exists) {
    return {
      contents: "",
      eol: "\n",
      exists: false,
      initialValue: {},
      path: targetPath,
      target,
    };
  }

  const contents = await dependencies.fs.readFile(targetPath, "utf8");

  return {
    contents,
    eol: detectConfigDocumentEndOfLine(contents),
    exists: true,
    initialValue: parseManagedConfigObject(contents, target, targetPath),
    path: targetPath,
    target,
  };
}

export function applyManagedConfigMutations(
  document: ManagedConfigMutationDocument,
  mutations: readonly ManagedConfigMutation[],
): string {
  if (mutations.length === 0) {
    return document.contents.length === 0
      ? document.contents
      : ensureTrailingConfigDocumentNewline(document.contents, document.eol);
  }

  let updatedContents = document.contents;
  const formattingOptions: FormattingOptions = {
    eol: document.eol,
    insertSpaces: true,
    tabSize: 2,
  };

  for (const mutation of mutations) {
    updatedContents = applyMutation(
      updatedContents,
      document,
      mutation,
      formattingOptions,
    );
  }

  return ensureTrailingConfigDocumentNewline(updatedContents, document.eol);
}

function applyMutation(
  currentContents: string,
  document: ManagedConfigMutationDocument,
  mutation: ManagedConfigMutation,
  formattingOptions: FormattingOptions,
): string {
  try {
    const edits = modify(
      currentContents,
      [...mutation.path],
      mutation.kind === "delete" ? undefined : mutation.value,
      { formattingOptions },
    );

    return applyEdits(currentContents, edits);
  } catch (cause) {
    throw createInstallError("managed_config_merge_failed", {
      keyPath: formatConfigPath(mutation.path),
      path: document.path,
      reason: cause instanceof Error ? cause.message : String(cause),
      target: document.target,
    });
  }
}

function parseManagedConfigObject(
  contents: string,
  target: ManagedConfigTarget,
  targetPath: string,
): Record<string, unknown> {
  const result = tryParseJsoncObject(contents);

  if (!result.ok) {
    throw createInstallError("managed_config_parse_failed", {
      path: targetPath,
      reason: result.error.reason,
      target,
    });
  }

  return result.value;
}
