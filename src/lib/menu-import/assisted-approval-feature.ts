import 'server-only';

/** Fail closed until assisted approval is explicitly enabled by server config. */
export function isAssistedApprovalEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.MENU_IMPORT_ASSISTED_APPROVAL_ENABLED === 'true';
}
