import type {
  ManagedArtifactRollbackAction,
  ManagedArtifactWriteResult,
} from "./contracts/managed-artifact.js";

export type RollbackAwareWriteResult =
  | Pick<ManagedArtifactWriteResult, "rollbackAction">
  | undefined;

export interface ManagedWriteTransaction {
  readonly rollbackActions: readonly ManagedArtifactRollbackAction[];
  run<TResult extends RollbackAwareWriteResult>(
    writeOperation: Promise<TResult>,
  ): Promise<TResult>;
  runAll<TResult extends readonly RollbackAwareWriteResult[]>(
    writeOperation: Promise<TResult>,
  ): Promise<TResult>;
}

export function createManagedWriteTransaction(): ManagedWriteTransaction {
  const rollbackActions: ManagedArtifactRollbackAction[] = [];

  function record(writeResult: RollbackAwareWriteResult): void {
    const rollbackAction = writeResult?.rollbackAction;

    if (rollbackAction !== undefined) {
      rollbackActions.push(rollbackAction);
    }
  }

  return {
    rollbackActions,
    async run(writeOperation) {
      const writeResult = await writeOperation;
      record(writeResult);
      return writeResult;
    },
    async runAll(writeOperation) {
      const writeResults = await writeOperation;

      for (const writeResult of writeResults) {
        record(writeResult);
      }

      return writeResults;
    },
  };
}
