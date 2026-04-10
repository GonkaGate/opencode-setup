import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { readText } from "./contract-helpers.js";

interface PackageJson {
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  files?: string[];
  name?: string;
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
}

test("package metadata matches the scaffold contract", () => {
  const packageJson = JSON.parse(readText("package.json")) as PackageJson;

  assert.equal(packageJson.name, CONTRACT_METADATA.packageName);
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.version, CONTRACT_METADATA.cliVersion);
  assert.equal(
    packageJson.bin?.[CONTRACT_METADATA.binName],
    CONTRACT_METADATA.binPath,
  );
  assert.equal(packageJson.engines?.node, ">=22.14.0");
  assert.equal(packageJson.files?.includes("dist"), true);
  assert.equal(packageJson.files?.includes("docs"), true);
  assert.match(packageJson.scripts?.build ?? "", /tsconfig\.build\.json/);
  assert.match(packageJson.scripts?.test ?? "", /npm run build/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run typecheck/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run test/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run format:check/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run package:check/);
});

test("curated model contract can encode compatibility and migration metadata", () => {
  const modelsContract = readText("src/constants/models.ts");

  assert.match(modelsContract, /CuratedModelCompatibility/);
  assert.match(modelsContract, /CuratedModelRecord/);
  assert.match(modelsContract, /providerOptions/);
  assert.match(modelsContract, /modelOptions/);
  assert.match(modelsContract, /modelHeaders/);
  assert.match(modelsContract, /migrationMetadata/);
  assert.match(modelsContract, /recommended/);
  assert.match(modelsContract, /CURATED_MODEL_REGISTRY/);
  assert.match(modelsContract, /getRecommendedValidatedModel/);
});
