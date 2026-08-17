import { isAuthorizationFailure, requireAuthenticatedUser, type StaffRole } from '@/lib/auth';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

type AccessRow = { role: StaffRole | null; restaurant_id: string | null; is_platform_admin: boolean };

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    if (isAuthorizationFailure(user)) return user;

    const { rows } = await query<AccessRow>(
      `SELECT
         EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = $1) AS is_platform_admin,
         s.role,
         s.restaurant_id
       FROM (SELECT 1) seed
       LEFT JOIN LATERAL (
         SELECT staff.role, staff.restaurant_id
         FROM staff JOIN restaurants r ON r.id = staff.restaurant_id
         WHERE staff.user_id = $1 AND r.status = 'active'
         ORDER BY staff.created_at LIMIT 1
       ) s ON true`,
      [user.id]
    );
    const access = rows[0];
    if (access?.is_platform_admin) return jsonSuccess(request, { destination: '/platform', role: 'platform' });
    if (access?.role && access.restaurant_id) return jsonSuccess(request, { destination: '/admin', role: access.role });
    return jsonError(request, 'AUTHORIZATION_FAILED', 'Esta cuenta no tiene acceso activo a Teburu.', 403);
  } catch (error) {
    logger.error('auth.destination_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo determinar el acceso de esta cuenta. Inténtalo de nuevo.', 500);
  }
}
