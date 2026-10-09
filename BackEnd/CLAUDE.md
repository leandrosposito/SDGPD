# CLAUDE.md (BackEnd)

Guía para Claude Code al trabajar en `BackEnd/`.

## Qué es esto

El backend de SDGPD: Node LTS + TypeScript + NestJS + PostgreSQL, multi-tenant con `empresa_id` y RLS, en el mismo monorepo que `FrontEnd/` (ADR-BE-001).

**BE-0a está hecha** (2026-10-08): esqueleto NestJS, `packages/contracts` base, Postgres en Supabase con RLS forzado (`companies`, `branches`) y suites de aislamiento. **BE-0b está hecha** (2026-10-09): `CommandInterceptor` (toda mutación es una transacción; POST exige `Idempotency-Key`), `CommandTx` (escrituras siempre auditadas, `version`, `nextNumber`), `audit_log` append-only, contadores por serie y helpers de paginación con listas blancas. **BE-1a está hecha** (2026-10-09): usuarios, roles y matriz módulo × acción, sucursales habilitadas, `/auth/*` (JWT de 15 min + refresh rotativo en cookie), guard global que llama a `bindActor`, permiso por endpoint (una ruta sin política hace fallar el arranque), gestión de usuarios y roles, y seed de desarrollo. **BE-1b está hecha** (2026-10-09): prefijo global `/api`, HMAC de idempotencia (`IDEMPOTENCY_HMAC_KEY`), guarda de último admin, limpieza de refresh tokens, ids fijos de la empresa demo; el frontend se conecta a auth, sesión, usuarios, roles y sucursales. Lo que sigue es **BE-2**. Estructura: `docs/ARQUITECTURA.md`. Entorno: `docs/SETUP_SUPABASE.md`.

## Comandos (desde la raíz del repo, con `-w @sdgpd/backend`)

- `npm ci`: instala los workspaces (`BackEnd` y `packages/*`). El lockfile está en la raíz.
- `npm run typecheck | lint | test | build`: en la raíz corren en todos los workspaces; con `-w @sdgpd/backend`, solo en el backend.
- `npm run start -w @sdgpd/backend`: levanta `dist/main.js` con `BackEnd/.env`.
- `npm run db:setup -w @sdgpd/backend`: roles, schemas, privilegios y `JWT_SECRET`. Es idempotente y corre como `postgres`. Con `-- --secrets-only`, solo genera los secretos que faltan en `.env`, sin conectarse.
- `npm run db:seed-dev -w @sdgpd/backend`: seed de desarrollo, solo contra `sdgpd` (2 empresas, sucursales del mock, 4 roles, un admin por empresa). Idempotente. Las credenciales quedan en `BackEnd/.env` (`SEED_*`).
- `npm run db:migrate -w @sdgpd/backend [-- sdgpd|sdgpd_test]`: migraciones, como `sdgpd_migrator`.
- `npm run db:generate -w @sdgpd/backend`: `drizzle-kit generate`. Después hay que revisar el SQL y sacar `"public".`. **`drizzle-kit push` está prohibido.**
- `npm run db:sql -w @sdgpd/backend -- <migrator|app|app_test> [--tenant <uuid> [--commit]] "<sql>" ...`: SQL a mano, sin psql.

Los tests corren contra `sdgpd_test` como `sdgpd_app_test`, y se niegan a arrancar con otra conexión.

## Qué leer antes de tocar algo

1. `BackEnd/docs/README.md`: los 11 ADRs, la trazabilidad de las 26 decisiones, los hallazgos y el plan de tandas BE-0 a BE-10.
2. Los ADRs `BackEnd/docs/adr/ADR-BE-0NN-*.md` que aplica la tanda (el plan dice cuáles). **Leé también sus secciones "Objeciones"**: están todas resueltas (2026-10-08), y cada resolución cambia algo del texto original del ADR. Ninguna bloquea ya el plan.
3. `FrontEnd/docs/PROTOCOLO.md`: el proceso de trabajo (fases, gates, merge) vale también para el backend. Los gates propios de una tanda de backend están en ADR-BE-001.
4. Para la evidencia de cualquier decisión: `FrontEnd/docs/historial/auditorias/backend/` (auditoría del 2026-10-07; empezá por `00_RESUMEN.md`).

## Invariantes (no se reabren sin un ADR nuevo)

- El tenant sale de la sesión: **ningún request lleva `empresaId`** (ADR-BE-002).
- Ids UUID v7 generados por el servidor (ADR-BE-004).
- Dinero en centavos enteros más moneda; no hay floats en el contrato (ADR-BE-006).
- Rechazos en 4xx con `{code, message, details?}` (ADR-BE-004).
- Un comando es una transacción, con sus efectos cruzados (ADR-BE-005).
- El actor sale de la sesión (ADR-BE-003).
- Toda ruta declara su política de acceso (`@RequirePermission`, `@SessionOnly` o `@Public`), o la app no arranca (ADR-BE-003, sub-decisiones 6 y 16).
- Sin tenant, `users` y `refresh_tokens` solo se leen por las dos funciones `SECURITY DEFINER` (ADR-BE-002, sub-decisiones 16 a 18).
- Postgres es la única infraestructura obligatoria **hasta BE-6 inclusive**; desde BE-7 se suma un object storage S3-compatible, solo en producción (ADR-BE-001 §Decisión 2, ADR-BE-011 §Storage).
