export const ALLOWED_SECRET_INPUTS = Object.freeze([
  "hidden_prompt",
  "env",
  "api_key_stdin",
] as const);

export type AllowedSecretInput = (typeof ALLOWED_SECRET_INPUTS)[number];

export interface SecretIntakePlan {
  allowedInputs: readonly AllowedSecretInput[];
  secretStorageOwner: "gonkagate_managed_user_storage";
}

export const SECRET_INTAKE_PLAN: SecretIntakePlan = Object.freeze({
  allowedInputs: ALLOWED_SECRET_INPUTS,
  secretStorageOwner: "gonkagate_managed_user_storage",
});
