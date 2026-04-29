# Graph Report - /Users/daniil/Projects/Opensource/opencode-setup (2026-04-29)

## Corpus Check

- 71 files · ~83,338 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 375 nodes · 952 edges · 16 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 230 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)

1. `createInstallError()` - 19 edges
2. `runInstallFlow()` - 16 edges
3. `normalizeInstallPath()` - 14 edges
4. `pathExists()` - 14 edges
5. `getInstallPathApi()` - 13 edges
6. `verifyCurrentSessionEffectiveConfig()` - 11 edges
7. `verifyEffectiveConfig()` - 10 edges
8. `resolveManagedPaths()` - 10 edges
9. `createTimestampedBackup()` - 10 edges
10. `readFile()` - 10 edges

## Surprising Connections (you probably didn't know these)

- `assertBackupMissing()` --calls--> `pathExists()` [INFERRED]
  /Users/daniil/Projects/Opensource/opencode-setup/test/install/rerun.test.ts → /Users/daniil/Projects/Opensource/opencode-setup/src/install/deps.ts
- `assertPathExists()` --calls--> `pathExists()` [INFERRED]
  /Users/daniil/Projects/Opensource/opencode-setup/test/install/rerun.test.ts → /Users/daniil/Projects/Opensource/opencode-setup/src/install/deps.ts
- `readJsonFile()` --calls--> `readFile()` [INFERRED]
  /Users/daniil/Projects/Opensource/opencode-setup/test/install/state.test.ts → /Users/daniil/Projects/Opensource/opencode-setup/src/install/deps.ts
- `createModelChoice()` --calls--> `formatOpencodeModelRef()` [INFERRED]
  /Users/daniil/Projects/Opensource/opencode-setup/src/install/selection.ts → /Users/daniil/Projects/Opensource/opencode-setup/src/constants/models.ts
- `createCliFixture()` --calls--> `createInstallIntegrationHarness()` [INFERRED]
  /Users/daniil/Projects/Opensource/opencode-setup/test/cli.test.ts → /Users/daniil/Projects/Opensource/opencode-setup/test/install/harness.ts

## Communities

### Community 0 - "Community 0"

Cohesion: 0.07
Nodes (24): createNodeInstallDependencies(), mkdir(), writeFile(), createInstallIntegrationHarness(), readJsonFile(), createNodeBackedTestInstallDependencies(), createStubbedTestClock(), createStubbedTestCommands() (+16 more)

### Community 1 - "Community 1"

Cohesion: 0.12
Nodes (29): getNestedConfigValue(), getStringArrayConfigValue(), hasNestedConfigValue(), verifyPreparedInstall(), isJsonObjectRecord(), createRedactedDiagnosticValue(), redactSecretBearingText(), redactSecretBearingValue() (+21 more)

### Community 2 - "Community 2"

Cohesion: 0.14
Nodes (30): chmod(), pathExists(), readFile(), removeFile(), assertUserProfileScopedManagedPath(), createTimestampedBackup(), ensureManagedDirectory(), ensureManagedFileProtection() (+22 more)

### Community 3 - "Community 3"

Cohesion: 0.1
Nodes (23): createBufferWriter(), createCliFixture(), createResolvedConfigFixture(), assertMirroredSkillDirectory(), listRelativeFiles(), createEffectiveConfigVerificationTarget(), createObjectValueChecks(), createResolvedConfigVerificationPolicy() (+15 more)

### Community 4 - "Community 4"

Cohesion: 0.11
Nodes (26): selectOption(), createInstallError(), isManagedConfigScope(), createCuratedModelIndex(), getCuratedModelByKey(), getRecommendedValidatedModel(), getValidatedModels(), isCuratedModelKey() (+18 more)

### Community 5 - "Community 5"

Cohesion: 0.11
Nodes (26): handleCliError(), main(), run(), isEntrypointInvocation(), tryResolveRealPath(), createBufferedOutput(), executeCli(), run() (+18 more)

### Community 6 - "Community 6"

Cohesion: 0.11
Nodes (22): applyManagedConfigMutations(), applyMutation(), parseManagedConfigObject(), readManagedConfigDocument(), createTargetDependencies(), readTestDocument(), detectConfigDocumentEndOfLine(), ensureTrailingConfigDocumentNewline() (+14 more)

### Community 7 - "Community 7"

Cohesion: 0.17
Nodes (21): classifyInstallPlatform(), isWslEnvironment(), resolveInstallContext(), resolveRuntimeContext(), isInstallError(), isInstallErrorCode(), applyManagedWrites(), buildCurrentSessionResultFromError() (+13 more)

### Community 8 - "Community 8"

Cohesion: 0.18
Nodes (19): createSecretBindingVerificationPolicy(), collectDurableVerificationBlockers(), inspectDurableSecretBindingVerificationBlockers(), collectInspectableLayerConfigs(), compareInspectableBlockers(), getInspectableLayerPrecedence(), inspectLayerBlockers(), inspectLayerForProviderActivation() (+11 more)

### Community 9 - "Community 9"

Cohesion: 0.14
Nodes (7): formatManagedArtifactFailureMessage(), formatManagedTarget(), InstallError, classifyOpenCodeVersionSupport(), detectOpenCode(), parseOpenCodeVersion(), createDetectedOpenCode()

### Community 10 - "Community 10"

Cohesion: 0.21
Nodes (11): createCommandNotFoundError(), createWindowsCommandCandidates(), getEnvironmentValue(), getWindowsPathExtensions(), normalizeEnvironmentForPlatform(), prepareInstallCommand(), resolveWindowsCommandPath(), runCommand() (+3 more)

### Community 11 - "Community 11"

Cohesion: 0.23
Nodes (13): assertActivationLocation(), assertBackupMissing(), assertManagedStateUnchanged(), assertPathExists(), createInstallerFixture(), createInstallRequest(), createResolvedConfigFixture(), createRunDependencies() (+5 more)

### Community 12 - "Community 12"

Cohesion: 0.27
Nodes (10): createScopeWriteContext(), createSeedFiles(), expectCommandEntry(), expectManagedGonkagateProvider(), expectProviderEntry(), readConfigSnapshot(), runScopeWrite(), expectObject() (+2 more)

### Community 13 - "Community 13"

Cohesion: 0.67
Nodes (0):

### Community 14 - "Community 14"

Cohesion: 1.0
Nodes (0):

### Community 15 - "Community 15"

Cohesion: 1.0
Nodes (0):

## Knowledge Gaps

- **Thin community `Community 14`** (2 nodes): `collectTestFiles()`, `run-tests.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `contracts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `createInstallError()` connect `Community 4` to `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `runInstallFlow()` connect `Community 7` to `Community 1`, `Community 11`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `pathExists()` connect `Community 2` to `Community 8`, `Community 10`, `Community 11`, `Community 6`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `createInstallError()` (e.g. with `writeManagedInstallState()` and `requireTargetWriteResult()`) actually correct?**
  _`createInstallError()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `runInstallFlow()` (e.g. with `runScopedInstall()` and `createManagedWriteTransaction()`) actually correct?**
  _`runInstallFlow()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `normalizeInstallPath()` (e.g. with `resolveInstallCwd()` and `findNearestGitRoot()`) actually correct?**
  _`normalizeInstallPath()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `pathExists()` (e.g. with `readOptionalText()` and `assertBackupMissing()`) actually correct?**
  _`pathExists()` has 13 INFERRED edges - model-reasoned connections that need verification._
