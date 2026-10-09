# Arquitectura del backend

**Verificado contra el filesystem el 2026-10-09** (tanda BE-0b; antes, BE-0a el 2026-10-08; `find BackEnd packages -not -path '*/node_modules/*' -not -path '*/dist/*'`). Si leés esto después de esa fecha, reverificalo antes de confiar en él (PROTOCOLO.md regla 2.10).

## Monorepo

| Ruta | Qué es |
|---|---|
| `package.json` (raíz) | Workspaces `packages/*` y `BackEnd`, en ese orden (contracts se compila primero). **`FrontEnd` todavía no es workspace** (ADR-BE-001, sub-decisión 14). Scripts `typecheck`, `lint`, `test` y `build`, que corren en todos los workspaces |
| `package-lock.json` (raíz) | El único lockfile de los workspaces. `FrontEnd/package-lock.json` sigue siendo el del frontend |
| `packages/contracts/` | `@sdgpd/contracts`: schemas Zod y tipos inferidos del contrato HTTP |
| `BackEnd/` | `@sdgpd/backend`: NestJS + Drizzle + Postgres con RLS |

## `packages/contracts`

```
packages/contracts/
  package.json          exports: sdgpd-source → src/index.ts | types → dist/*.d.ts | default → dist/*.js
  tsconfig.json         typecheck (src + test), noEmit
  tsconfig.build.json   build a dist/ con .d.ts
  src/
    index.ts            barrel
    id.ts               idSchema (UUID)
    error.ts            errorBodySchema { code, message, details? }, errorCodeSchema, transversalErrorCodes
                        (BE-0b suma idempotency-key-required, invalid-query, idempotency-key-in-progress, idempotency-key-reused)
    pagination.ts       offsetPageSchema(item, aggregates?), cursorPageSchema(item, aggregates?), MAX_PAGE_SIZE = 100
    time.ts             dateSchema (yyyy-MM-dd), instantSchema (ISO 8601 UTC)
    money.ts            moneySchema { amount entero, currency ISO 4217 }, currencySchema
    health.ts           healthResponseSchema (GET /health)
    query.ts            offsetQuerySchema, cursorQuerySchema, ListSpec + offsetListQuerySchema/cursorListQuerySchema (listas blancas, BE-0b)
  test/
    contracts.test.ts
    query.test.ts
```

Solo tiene el contrato transversal (ADR-BE-004 y ADR-BE-006), sin recursos de negocio. Lint y tests usan las herramientas de `BackEnd` con `--config` (ADR-BE-001, sub-decisión 12).

**Cómo lo consume `BackEnd`** (ADR-BE-001, sub-decisión 8): el typecheck y los tests resuelven `@sdgpd/contracts` por la condición `sdgpd-source`, que apunta a las fuentes. Un cambio en `contracts` que rompe al backend falla en el `tsc --noEmit` del backend sin compilar nada antes. El build y el runtime usan `dist/`.

## `BackEnd/`

```
BackEnd/
  package.json            scripts: typecheck, lint, test, build, start, db:setup, db:generate, db:migrate, db:sql
  tsconfig.json           typecheck de todo (src, test, scripts, configs); customConditions: sdgpd-source
  tsconfig.build.json     build de src/ a dist/ (contra contracts/dist)
  eslint.config.mjs       único config de lint (también para contracts)
  vitest.config.mts       tests del backend: globalSetup = guard, un archivo a la vez
  vitest.contracts.config.mts   tests de packages/contracts
  drizzle.config.ts       drizzle-kit generate (nunca push)
  .env.example            plantilla; el .env real no se versiona
  drizzle/                migraciones SQL versionadas
    0000_companies_branches.sql      generada (con "public". sacado a mano)
    0001_rls_companies_branches.sql  custom: ENABLE + FORCE RLS y políticas
    0002_mutations_infra.sql         generada: idempotency_keys, audit_log, document_counters, branches.version
    0003_rls_mutations_infra.sql     custom: RLS de las tres tablas nuevas (+ expired_cleanup, audit_log append-only)
    meta/                 journal y snapshots de drizzle-kit
  scripts/db/             corren con Node 24 sin compilar
    lib.ts                conexión con SSL verificado, roles, schemas, lectura y escritura de .env;
                          APPEND_ONLY_TABLES (revoca UPDATE/DELETE de audit_log a los roles de aplicación)
    setup.ts              roles, schemas, privilegios y URLs en .env (idempotente, como postgres)
    migrate.ts            runner propio: mismas migraciones en sdgpd y sdgpd_test (como sdgpd_migrator)
    sql.ts                ejecuta SQL como un rol propio, con o sin tenant (reemplaza a psql)
  src/
    main.ts               valida la config y levanta Nest; sin config válida no arranca
    app.module.ts         AppModule.register(config): DatabaseModule + HttpCoreModule + CommandModule + HealthController
    context/actor.ts      Actor { empresaId, userId, requestId }; bindActor (ÚNICO punto de entrada, lo llama BE-1),
                          requireActor, @CurrentActor()
    config/config.ts      loadConfig(env) con Zod; APP_CONFIG
    db/
      database.ts         Database: pool pg con SSL verificado; withTenant (solo src/db/ y tests), read() READ ONLY,
                          command(), idempotentCommand(), cleanupExpiredIdempotencyKeys(), ping()
      database.module.ts  módulo global que exporta Database e IdempotencyCleanupService
      tenant-tx.ts        tipos Db y TenantTx
      command.ts          CommandTx: select + insert/update/delete siempre auditados (update/delete con versión) + nextNumber
      idempotency.ts      canonicalJson, payloadHash (SHA-256), claimKey/completeKey, TTL 48 h
      idempotency-cleanup.service.ts  setInterval de 15 min + advisory lock
      counters.ts         nextNumber(tx, empresaId, series): SERIE-000001
      pagination.ts       offsetPage, cursorPage, encodeCursor/decodeCursor, keysetAfter/keysetOrder (instante, id), orderByWhitelist
      ids.ts              newId(): UUID v7 (uuid), porque Postgres 17 no tiene uuidv7()
      schema/             tablas Drizzle, sin schema (lo fija el rol por search_path)
        companies.ts
        branches.ts       (BE-0b: version)
        idempotency-keys.ts
        audit-log.ts
        document-counters.ts
        index.ts
    http/
      errors.ts           AppError y subclases: ValidationError 400, InvalidQueryError 400, IdempotencyKeyRequiredError 400,
                          UnauthenticatedError 401, NotFoundError 404, ConflictError 409, BusinessRuleError 422,
                          IdempotencyKeyReusedError 422, ServiceUnavailableError 503
      command.interceptor.ts   CommandInterceptor (global): toda mutación fuera de /auth/* es un comando; POST exige
                          Idempotency-Key; @Command() da el CommandTx al handler
      command.module.ts   APP_INTERCEPTOR
      list-query.pipe.ts  ListQueryPipe(spec): 400 invalid-query fuera de la lista blanca
      error.filter.ts     filtro global (@Catch()): toda respuesta de error es { code, message, details? }
      zod-validation.pipe.ts   ZodValidationPipe(schema)
      request-id.middleware.ts X-Request-Id (UUID v7) en toda respuesta
      http.module.ts      HttpCoreModule: APP_FILTER + middleware en '*path'
    health/
      health.controller.ts     GET /health, el único endpoint de BE-0a
  test/
    setup/guard.ts        globalSetup: se niega a arrancar si la conexión no es sdgpd_app_test sobre sdgpd_test
    support/db.ts         testConfig() (pool de 2), rawTestClient() sin tenant, pgCode()
    support/probe-app.ts  app de prueba: guard que fija el actor desde headers (SOLO en test/) y rutas /probe/*, /auth/probe
    support/tenants.ts    createTestCompany / removeTestCompany
    db/idempotency.test.ts   replay, 422, 400, rollback, concurrencia, /auth/*, limpieza
    db/mutations.test.ts     versión (409/404), auditoría (before/after, rollback, permisos), contadores
    db/pagination.test.ts    offset (total, pageSize máximo) y cursor (recorrido con inserciones), lista blanca
    db/catalog.test.ts    suite de catálogo (cubre cualquier tabla futura)
    db/isolation.test.ts  suite funcional de aislamiento (A contra B) + semántica de withTenant
    http/error-filter.test.ts   400 / 422 / 500 / 404 / JSON mal formado / X-Request-Id
    http/health.test.ts   /health ok y 503 con la aplicación completa
    config/config.test.ts loadConfig
  docs/
    ARQUITECTURA.md       este archivo
    SETUP_SUPABASE.md     cómo armar el entorno
    verificaciones/VERIFICACION_BE-0a.md   checklist manual
    adr/                  ADR-BE-001..011
    README.md             índice, trazabilidad y plan de tandas
```

## Base de datos

**Un proyecto de Supabase, usado solo como Postgres** (17.11 al 2026-10-08), por el session pooler y con SSL verificado (ADR-BE-001, sub-decisión 3).

| Rol | Qué puede | Schema por defecto (`search_path` del rol) |
|---|---|---|
| `sdgpd_migrator` | dueño de `sdgpd` y `sdgpd_test` y de sus tablas; aplica las migraciones | `pg_catalog` (sin schema propio, a propósito) |
| `sdgpd_app` | `USAGE` en `sdgpd`; `SELECT/INSERT/UPDATE/DELETE` en sus tablas (default privileges); sin `BYPASSRLS`, no es dueño de nada | `sdgpd` |
| `sdgpd_app_test` | lo mismo, solo sobre `sdgpd_test`; nada sobre `sdgpd` | `sdgpd_test` |

- `PUBLIC`, `anon`, `authenticated` y `service_role` no tienen ningún privilegio sobre los dos schemas.
- Cada schema tiene su tabla de control `schema_migrations`, sin privilegios para los roles de aplicación.
- **Tablas de negocio** (las mismas en los dos schemas):
  - `companies`: el `id` es el tenant (no tiene `empresa_id`), lleva `timezone` IANA.
  - `branches`: `empresa_id NOT NULL` con FK a `companies`, `UNIQUE (empresa_id, id)` y `UNIQUE (empresa_id, code)`.
  - Las dos con RLS habilitado y forzado, y la política `tenant_isolation`.
- **Tablas de infraestructura de mutaciones (BE-0b),** todas con RLS forzado y su caso en la suite de aislamiento:
  - `idempotency_keys`: única por `(empresa_id, user_id, operation, key)`, con `payload_hash`, `response_status`, `response_body` y `expires_at` (48 h). Además de `tenant_isolation`, tiene la política `expired_cleanup` (DELETE de vencidas sin tenant).
  - `audit_log`: append-only. Solo hay políticas de SELECT e INSERT, y los roles de aplicación no tienen UPDATE ni DELETE (se revocan explícitamente).
  - `document_counters`: PK `(empresa_id, series)`, series `PED`, `REM`, `OC`, `REC`, `VIA` y `RCB`.
  - `branches.version integer NOT NULL DEFAULT 1`.
  - `user_id` todavía no tiene FK: la agrega BE-1.
- **Tenant:** `Database.withTenant(empresaId, fn)` abre una transacción, ejecuta `select set_config('app.empresa_id', $1, true)` y corre `fn(tx)`. El cliente Drizzle es privado, y ESLint prohíbe `pg` y `drizzle-orm/node-postgres` fuera de `src/db/`. Desde BE-0b, fuera de `src/db/` ESLint también prohíbe `withTenant` y la reflexión (`Reflect`, `Object.getOwnProperty*`, `.session`), así que el código de negocio entra solo por `Database.read()` (READ ONLY) o por un comando (`CommandTx`, con escrituras siempre auditadas; ADR-BE-005, sub-decisión 11). Sin tenant, toda tabla con RLS devuelve cero filas.

## Flujo de un request

`RequestIdMiddleware` (genera y devuelve `X-Request-Id`) → autenticación (BE-1: `bindActor`) → `CommandInterceptor`, solo en mutaciones: transacción con el tenant del actor, más `Idempotency-Key` en POST → controller (`ZodValidationPipe` o `ListQueryPipe` con un schema de `contracts`) → lectura con `Database.read()` o comando con `@Command() tx: CommandTx` → respuesta (un replay lleva `Idempotent-Replayed: true`). Cualquier excepción pasa por `ErrorFilter`, y lo no previsto sale como `500 internal-error` con el detalle solo en el log.
