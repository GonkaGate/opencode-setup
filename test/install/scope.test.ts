import assert from "node:assert/strict";
import test from "node:test";
import { formatOpencodeModelRef } from "../../src/constants/models.js";
import {
  resolveManagedPaths,
  resolveProjectConfigBackupDirectory,
} from "../../src/install/paths.js";
import { writeScopeManagedConfigs } from "../../src/install/scope.js";
import {
  createTestInstallDependencies,
  type StubInstallFs,
} from "./test-deps.js";
import {
  expectObject,
  parseWrittenConfig,
  readWrittenText,
} from "./test-helpers.js";

const TEST_HOME_DIR = "/home/test-user";
const TEST_WORKSPACE_DIR = "/workspace/repo";
const VALIDATED_MODEL_KEY = "qwen3-235b-a22b-instruct-2507-fp8";
const VALIDATED_MODEL_REF = formatOpencodeModelRef(VALIDATED_MODEL_KEY);
const EXISTING_USER_CONFIG =
  '{\n  // keep this comment\n  "provider": {\n    "anthropic": {\n      "name": "Anthropic"\n    }\n  },\n  "command": {\n    "review": {\n      "template": "Review this"\n    }\n  }\n}\n';
const EXISTING_PROJECT_PROVIDER_CONFIG =
  '{\n  "provider": {\n    "gonkagate": {\n      "name": "Old GonkaGate"\n    },\n    "openai": {\n      "name": "OpenAI"\n    }\n  }\n}\n';
const SECRET_BEARING_PROJECT_CONFIG =
  '{\n  "provider": {\n    "gonkagate": {\n      "options": {\n        "apiKey": "{file:~/.gonkagate/opencode/api-key}"\n      }\n    },\n    "openai": {\n      "name": "OpenAI"\n    }\n  },\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8"\n}\n';

interface ConfigSnapshot {
  config: Record<string, unknown>;
  text: string;
}

interface ScopeWriteOptions {
  projectConfigContents?: string;
  userConfigContents?: string;
}

function createSeedFiles(
  managedPaths: ReturnType<typeof resolveManagedPaths>,
  options: ScopeWriteOptions,
) {
  const seedFiles = [];

  if (options.userConfigContents !== undefined) {
    seedFiles.push({
      contents: options.userConfigContents,
      path: managedPaths.userConfigPath,
    });
  }

  if (options.projectConfigContents !== undefined) {
    seedFiles.push({
      contents: options.projectConfigContents,
      path: managedPaths.projectConfigPath,
    });
  }

  return seedFiles;
}

function readConfigSnapshot(
  fs: StubInstallFs,
  path: string,
  description: string,
): ConfigSnapshot {
  return {
    config: parseWrittenConfig(fs, path, description),
    text: readWrittenText(fs, path, description),
  };
}

function expectProviderEntry(
  config: Record<string, unknown>,
  configName: string,
  providerKey: string,
): Record<string, unknown> {
  const providerConfig = expectObject(
    config.provider,
    `${configName} provider`,
  );

  return expectObject(
    providerConfig[providerKey],
    `${configName} provider.${providerKey}`,
  );
}

function expectManagedGonkagateProvider(
  config: Record<string, unknown>,
  configName: string,
) {
  const gonkagateProvider = expectProviderEntry(
    config,
    configName,
    "gonkagate",
  );

  return {
    models: expectObject(
      gonkagateProvider.models,
      `${configName} provider.gonkagate.models`,
    ),
    options: expectObject(
      gonkagateProvider.options,
      `${configName} provider.gonkagate.options`,
    ),
  };
}

function expectCommandEntry(
  config: Record<string, unknown>,
  configName: string,
  commandKey: string,
): Record<string, unknown> {
  const commandConfig = expectObject(config.command, `${configName} command`);

  return expectObject(
    commandConfig[commandKey],
    `${configName} command.${commandKey}`,
  );
}

function createScopeWriteContext(options: ScopeWriteOptions = {}) {
  const managedPaths = resolveManagedPaths(TEST_HOME_DIR, TEST_WORKSPACE_DIR);
  const dependencies = createTestInstallDependencies({
    seedFiles: createSeedFiles(managedPaths, options),
  });
  const fs = dependencies.fs as StubInstallFs;

  return {
    dependencies,
    managedPaths,
    readProjectConfig() {
      return readConfigSnapshot(
        fs,
        managedPaths.projectConfigPath,
        "project config",
      );
    },
    readUserConfig() {
      return readConfigSnapshot(fs, managedPaths.userConfigPath, "user config");
    },
  };
}

async function runScopeWrite(
  scope: "project" | "user",
  options: ScopeWriteOptions = {},
) {
  const context = createScopeWriteContext(options);
  const result = await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: VALIDATED_MODEL_KEY,
      scope,
    },
    context.dependencies,
  );

  return {
    ...context,
    result,
  };
}

test("user scope writes provider and activation settings to the user config while preserving unrelated keys", async () => {
  const { readUserConfig, result } = await runScopeWrite("user", {
    userConfigContents: EXISTING_USER_CONFIG,
  });
  const { config: userConfig, text: userConfigText } = readUserConfig();
  const anthropicProvider = expectProviderEntry(
    userConfig,
    "user config",
    "anthropic",
  );
  const { models: gonkagateModels, options: gonkagateOptions } =
    expectManagedGonkagateProvider(userConfig, "user config");
  const reviewCommand = expectCommandEntry(userConfig, "user config", "review");

  assert.equal(result.userConfig.target, "user_config");
  assert.equal(result.projectConfig?.target, "project_config");
  assert.equal(result.projectConfig?.changed, false);
  assert.equal(userConfig.model, VALIDATED_MODEL_REF);
  assert.equal(userConfig.small_model, VALIDATED_MODEL_REF);
  assert.equal(anthropicProvider.name, "Anthropic");
  assert.equal(gonkagateOptions.apiKey, "{file:~/.gonkagate/opencode/api-key}");
  assert.ok(gonkagateModels[VALIDATED_MODEL_KEY] !== undefined);
  assert.equal(reviewCommand.template, "Review this");
  assert.match(userConfigText, /keep this comment/u);
});

test("user scope removes GonkaGate activation and provider keys from an existing project config", async () => {
  const { readProjectConfig } = await runScopeWrite("user", {
    projectConfigContents:
      '{\n  "provider": {\n    "gonkagate": {\n      "name": "Old GonkaGate"\n    },\n    "openai": {\n      "name": "OpenAI"\n    }\n  },\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",\n  "small_model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8"\n}\n',
  });
  const { config: projectConfig } = readProjectConfig();
  const providerConfig = expectObject(
    projectConfig.provider,
    "project config provider",
  );

  assert.equal(providerConfig.gonkagate, undefined);
  assert.equal(
    expectProviderEntry(projectConfig, "project config", "openai").name,
    "OpenAI",
  );
  assert.equal(projectConfig.model, undefined);
  assert.equal(projectConfig.small_model, undefined);
});

test("user scope preserves non-owned activation values in the old project target while still removing managed provider state", async () => {
  const { readProjectConfig } = await runScopeWrite("user", {
    projectConfigContents:
      '{\n  "provider": {\n    "gonkagate": {\n      "name": "Old GonkaGate"\n    },\n    "openai": {\n      "name": "OpenAI"\n    }\n  },\n  "model": "openai/gpt-4.1",\n  "small_model": "gonkagate/manual-custom"\n}\n',
  });
  const { config: projectConfig } = readProjectConfig();
  const providerConfig = expectObject(
    projectConfig.provider,
    "project config provider",
  );

  assert.equal(providerConfig.gonkagate, undefined);
  assert.equal(
    expectProviderEntry(projectConfig, "project config", "openai").name,
    "OpenAI",
  );
  assert.equal(projectConfig.model, "openai/gpt-4.1");
  assert.equal(projectConfig.small_model, "gonkagate/manual-custom");
});

test("project scope writes provider only to the user config and activation only to the project config", async () => {
  const { readProjectConfig, readUserConfig, result } =
    await runScopeWrite("project");
  const { config: userConfig } = readUserConfig();
  const { config: projectConfig, text: projectConfigText } =
    readProjectConfig();

  assert.equal(result.userConfig.target, "user_config");
  assert.equal(result.projectConfig?.target, "project_config");
  assert.equal(userConfig.model, undefined);
  assert.equal(userConfig.small_model, undefined);
  assert.equal(projectConfig.model, VALIDATED_MODEL_REF);
  assert.equal(projectConfig.small_model, VALIDATED_MODEL_REF);
  assert.equal(projectConfig.provider, undefined);
  assert.doesNotMatch(projectConfigText, /api-key/u);
});

test("project scope removes provider.gonkagate from repo-local config while preserving unrelated providers", async () => {
  const { readProjectConfig } = await runScopeWrite("project", {
    projectConfigContents: EXISTING_PROJECT_PROVIDER_CONFIG,
  });
  const { config: projectConfig, text: projectConfigText } =
    readProjectConfig();
  const providerConfig = expectObject(
    projectConfig.provider,
    "project config provider",
  );
  const openAiProvider = expectProviderEntry(
    projectConfig,
    "project config",
    "openai",
  );

  assert.equal(providerConfig.gonkagate, undefined);
  assert.equal(openAiProvider.name, "OpenAI");
  assert.doesNotMatch(projectConfigText, /api-key/u);
});

test("project scope keeps rollback backups for repo-local config outside the repository", async () => {
  const { managedPaths, readProjectConfig, result, dependencies } =
    await runScopeWrite("project", {
      projectConfigContents: SECRET_BEARING_PROJECT_CONFIG,
    });
  const { config: projectConfig, text: projectConfigText } =
    readProjectConfig();
  const backupPath = result.projectConfig?.backupPath;
  const backupDirectoryPath = resolveProjectConfigBackupDirectory(managedPaths);

  assert.ok(backupPath !== undefined);
  assert.ok(backupPath.startsWith(`${backupDirectoryPath}/opencode.json.`));
  assert.equal(
    backupPath.startsWith(`${managedPaths.projectConfigPath}.bak-`),
    false,
  );
  assert.equal(
    readWrittenText(
      dependencies.fs as StubInstallFs,
      backupPath,
      "project rollback backup",
    ),
    SECRET_BEARING_PROJECT_CONFIG,
  );
  assert.equal(
    expectProviderEntry(projectConfig, "project config", "openai").name,
    "OpenAI",
  );
  assert.doesNotMatch(projectConfigText, /api-key/u);
});
