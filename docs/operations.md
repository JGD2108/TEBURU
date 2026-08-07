# Operación de Teburu

## Ambientes

Usar tres proyectos Supabase separados: desarrollo, staging y producción. En Vercel, `Preview` debe apuntar exclusivamente a Supabase staging y `Production` exclusivamente a Supabase producción. Nunca compartir `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ni `CRON_SECRET` entre ambientes.

Variables requeridas: consultar `.env.example`. En Bitbucket, los deployments staging/production requieren sus respectivas `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` y las cinco variables `E2E_*`. Las variables de ejecución se administran en Vercel con alcance Preview/Production.

Para levantar el contenedor local con las variables públicas disponibles durante el build: `docker compose --env-file .env.local up --build`.

## Despliegue y rollback

1. Un push a `staging` ejecuta validaciones, aplica migraciones pendientes, crea un artifact Vercel y corre el smoke E2E.
2. El workflow de producción se ejecuta manualmente con aprobación del ambiente `production`, vuelve a construir con variables exclusivas de producción y verifica el deployment resultante.
3. Si falla una verificación, no promover. Corregir con una migración hacia adelante; no editar una migración ya aplicada.
4. Para rollback de aplicación, usar `vercel rollback` al deployment anterior. Si hubo migración, comprobar primero que la versión anterior siga siendo compatible con el esquema nuevo.

## Salud, logs y alertas

`GET /api/health` devuelve `200` cuando PostgreSQL responde y `503` cuando está degradado. Configurar un monitor externo cada minuto y alertar tras tres fallos consecutivos. Los accesos a base y fallos de salud emiten JSON estructurado, apto para Vercel Logs o un Log Drain.

Vercel ejecuta diariamente `GET /api/internal/maintenance/guest-sessions` según `vercel.json`, autenticado con `CRON_SECRET`, para eliminar tokens vencidos o revocados. También acepta `POST` para una ejecución operativa manual. No registrar el secreto ni el encabezado.

## Backup y restauración

- Habilitar backups diarios y point-in-time recovery en el proyecto Supabase de producción.
- Antes de una migración de riesgo, crear un backup verificable.
- Cada trimestre, restaurar el backup más reciente en un proyecto aislado, ejecutar `npm run test:integration` contra la restauración y documentar duración y resultado.
- Nunca ensayar una restauración sobre producción. La recuperación se valida en staging y luego se conmuta la aplicación mediante variables de entorno.

## Respuesta a fallos

Si Supabase Auth falla, las rutas protegidas responden `401` y no deben degradarse a acceso anónimo. Si PostgreSQL falla, `/api/health` responde `503`; mantener el KDS visible con sus datos actuales y su polling/reconexión, pero bloquear nuevas mutaciones hasta recuperar conectividad.
