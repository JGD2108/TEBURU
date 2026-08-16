import type { ApiErrorCode } from '@/lib/api-response';

type DatabaseError = { code?: unknown };

/** Maps expected PostgreSQL deployment failures to a safe API response. */
export function menuImportDatabaseFailure(error: unknown): { code: ApiErrorCode; status: number; message: string; databaseCode?: string } | null {
  const rawCode = (error as DatabaseError | null)?.code;
  const databaseCode = typeof rawCode === 'string' ? rawCode : undefined;

  // These failures indicate a missing migration or unavailable database, not
  // private-storage availability. The original detail is retained in logs only.
  if (databaseCode === '42P01' || databaseCode === '42703' || databaseCode === '3F000' ||
      databaseCode?.startsWith('08') || databaseCode === '28P01' || databaseCode === '53300' ||
      databaseCode === 'ECONNREFUSED' || databaseCode === 'ETIMEDOUT' || databaseCode === 'ENOTFOUND') {
    return {
      code: 'IMPORT_DATABASE_UNAVAILABLE',
      status: 503,
      message: 'La configuración de importación está temporalmente no disponible. Inténtalo más tarde.',
      databaseCode,
    };
  }
  return null;
}
