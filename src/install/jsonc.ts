import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { isJsonObjectRecord } from "../json.js";

export type ConfigDocumentEndOfLine = "\n" | "\r\n";

export class JsoncObjectParseError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "JsoncObjectParseError";
    this.reason = reason;
  }
}

export type JsoncObjectParseResult =
  | {
      ok: true;
      value: Record<string, unknown>;
    }
  | {
      error: JsoncObjectParseError;
      ok: false;
    };

export function tryParseJsoncObject(contents: string): JsoncObjectParseResult {
  if (contents.trim().length === 0) {
    return {
      ok: true,
      value: {},
    };
  }

  const parseErrors: ParseError[] = [];
  const parsedValue = parse(contents, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;

  if (parseErrors.length > 0) {
    return {
      error: new JsoncObjectParseError(
        parseErrors.map((error) => printParseErrorCode(error.error)).join(", "),
      ),
      ok: false,
    };
  }

  if (!isJsonObjectRecord(parsedValue)) {
    return {
      error: new JsoncObjectParseError("Config root must be a JSON object."),
      ok: false,
    };
  }

  return {
    ok: true,
    value: parsedValue,
  };
}

export function parseJsoncObject(contents: string): Record<string, unknown> {
  const result = tryParseJsoncObject(contents);

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}

export function detectConfigDocumentEndOfLine(
  contents: string,
): ConfigDocumentEndOfLine {
  return contents.includes("\r\n") ? "\r\n" : "\n";
}

export function ensureTrailingConfigDocumentNewline(
  contents: string,
  eol: ConfigDocumentEndOfLine,
): string {
  return contents.endsWith(eol) ? contents : `${contents}${eol}`;
}

export function formatConfigPath(path: readonly string[]): string {
  return path.join(".");
}
