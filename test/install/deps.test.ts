import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareInstallCommand,
  resolveWindowsCommandPath,
} from "../../src/install/deps.js";

function createWindowsPathExistsChecker(
  existingPaths: readonly string[],
): (path: string) => Promise<boolean> {
  const normalizedPaths = new Set(
    existingPaths.map((path) => path.toLowerCase()),
  );

  return async (path) => normalizedPaths.has(path.toLowerCase());
}

test("resolveWindowsCommandPath finds PATH commands through PATHEXT", async () => {
  const resolvedPath = await resolveWindowsCommandPath(
    "opencode",
    {
      PATHEXT: ".EXE;.CMD",
      Path: "C:\\Program Files\\OpenCode;C:\\Other",
    },
    createWindowsPathExistsChecker([
      "C:\\Program Files\\OpenCode\\opencode.CMD",
    ]),
  );

  assert.equal(resolvedPath, "C:\\Program Files\\OpenCode\\opencode.CMD");
});

test("resolveWindowsCommandPath prefers the lexicographically first PATH variant on Windows", async () => {
  const resolvedPath = await resolveWindowsCommandPath(
    "opencode",
    {
      PATH: "C:\\Harness\\Bin",
      PATHEXT: ".CMD",
      Path: "C:\\Windows\\System32",
    },
    createWindowsPathExistsChecker(["C:\\Harness\\Bin\\opencode.CMD"]),
  );

  assert.equal(resolvedPath, "C:\\Harness\\Bin\\opencode.CMD");
});

test("prepareInstallCommand routes Windows .cmd shims through ComSpec", async () => {
  const preparedCommand = await prepareInstallCommand(
    "opencode",
    ["debug", "config", "--pure"],
    {
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      PATHEXT: ".EXE;.CMD",
      PATH: "C:\\Program Files\\OpenCode",
    },
    "win32",
    createWindowsPathExistsChecker([
      "C:\\Program Files\\OpenCode\\opencode.CMD",
    ]),
  );

  assert.equal(preparedCommand.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(preparedCommand.args, [
    "/d",
    "/s",
    "/c",
    '"C:\\Program Files\\OpenCode\\opencode.CMD" debug config --pure',
  ]);
});

test("prepareInstallCommand keeps direct execution for Windows .exe binaries", async () => {
  const preparedCommand = await prepareInstallCommand(
    "opencode",
    ["--version"],
    {
      PATHEXT: ".EXE;.CMD",
      PATH: "C:\\Tools",
    },
    "win32",
    createWindowsPathExistsChecker(["C:\\Tools\\opencode.EXE"]),
  );

  assert.equal(preparedCommand.command, "C:\\Tools\\opencode.EXE");
  assert.deepEqual(preparedCommand.args, ["--version"]);
});

test("prepareInstallCommand preserves ENOENT when a Windows command is missing", async () => {
  await assert.rejects(
    () =>
      prepareInstallCommand(
        "opencode",
        ["--version"],
        {
          PATH: "C:\\Tools",
        },
        "win32",
        createWindowsPathExistsChecker([]),
      ),
    (error: unknown) => {
      const commandError = error as NodeJS.ErrnoException;

      assert.equal(commandError.code, "ENOENT");
      assert.equal(commandError.path, "opencode");
      return true;
    },
  );
});
