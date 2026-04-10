export interface RestoreManagedArtifactFromBackupAction {
  backupPath: string;
  kind: "restore_backup";
  path: string;
}

export interface DeleteCreatedManagedArtifactFileAction {
  kind: "delete_created_file";
  path: string;
}

export type ManagedArtifactRollbackAction =
  | DeleteCreatedManagedArtifactFileAction
  | RestoreManagedArtifactFromBackupAction;

export interface UnchangedManagedArtifactWriteResult {
  backupPath: undefined;
  changed: false;
  existedBefore: boolean;
  path: string;
  rollbackAction: undefined;
}

export interface UpdatedExistingManagedArtifactWriteResult {
  backupPath: string;
  changed: true;
  existedBefore: true;
  path: string;
  rollbackAction: RestoreManagedArtifactFromBackupAction;
}

export interface CreatedManagedArtifactWriteResult {
  backupPath: undefined;
  changed: true;
  existedBefore: false;
  path: string;
  rollbackAction: DeleteCreatedManagedArtifactFileAction;
}

export type ChangedManagedArtifactWriteResult =
  | CreatedManagedArtifactWriteResult
  | UpdatedExistingManagedArtifactWriteResult;

export type ManagedArtifactWriteResult =
  | ChangedManagedArtifactWriteResult
  | UnchangedManagedArtifactWriteResult;
