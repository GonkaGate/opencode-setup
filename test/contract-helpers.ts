import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export function readText(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function assertMatchesAll(
  text: string,
  patterns: readonly RegExp[],
): void {
  for (const pattern of patterns) {
    assert.match(text, pattern);
  }
}

export function listRelativeFiles(rootPath: string): string[] {
  return readdirSync(rootPath, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(rootPath, resolve(entry.parentPath, entry.name)))
    .sort();
}

export function assertMirroredSkillDirectory(skillDirectory: string): void {
  const agentRoot = resolve(repoRoot, ".agents/skills", skillDirectory);
  const claudeRoot = resolve(repoRoot, ".claude/skills", skillDirectory);

  assert.equal(existsSync(agentRoot), true, `Missing ${agentRoot}`);
  assert.equal(existsSync(claudeRoot), true, `Missing ${claudeRoot}`);

  const agentFiles = listRelativeFiles(agentRoot);
  const claudeFiles = listRelativeFiles(claudeRoot);
  assert.deepEqual(claudeFiles, agentFiles);

  for (const relativePath of agentFiles) {
    assert.equal(
      readFileSync(resolve(agentRoot, relativePath), "utf8"),
      readFileSync(resolve(claudeRoot, relativePath), "utf8"),
    );
  }
}
