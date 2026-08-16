import { ApiClientError } from '@/lib/api-client';

export const IMPORT_UPLOAD_INCOMPLETE = 'IMPORT_UPLOAD_INCOMPLETE';

export function uploadRecoveryMessage(error: unknown) {
  if (error instanceof ApiClientError && error.code === IMPORT_UPLOAD_INCOMPLETE) {
    return 'No se pudo confirmar que el PDF llego al almacenamiento. Vuelve a seleccionarlo y subelo de nuevo antes de iniciar el analisis.';
  }

  return null;
}
