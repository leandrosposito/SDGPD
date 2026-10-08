# Arquitectura del backend

**Verificado contra el filesystem el 2026-10-08** (tanda BE-0a, `find BackEnd packages -not -path '*/node_modules/*' -not -path '*/dist/*'`). Si leés esto después de esa fecha, reverificalo antes de confiar en él (PROTOCOLO.md regla 2.10).

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
    pagination.ts       offsetPageSchema(item, aggregates?), cursorPageSchema(item, aggregates?), MAX_PAGE_SIZE = 100
    time.ts             dateSchema (yyyy-MM-dd), instantSchema (ISO 8601 UTC)
    money.ts            moneySchema { amount entero, currency ISO 4217 }, currencySchema
    health.ts           healthResponseSchema (GET /health)
  test/
    contracts.test.ts
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
    meta/                 journal y snapshots de drizzle-kit
  scripts/db/             corren con Node 24 sin compilar
    lib.ts                conexión con SSL verificado, roles, schemas, lectura y escritura de .env
    setup.ts              roles, schemas, privilegios y URLs en .env (idempotente, como postgres)
    migrate.ts            runner propio: mismas migraciones en sdgpd y sdgpd_test (como sdgpd_migrator)
    sql.ts                ejecuta SQL como un rol propio, con o sin tenant (reemplaza a psql)
  src/
    main.ts               valida la config y levanta Nest; sin config válida no arranca
    app.module.ts         AppModule.register(config): DatabaseModule + HttpCoreModule + HealthController
    config/config.ts      loadConfig(env) con Zod; APP_CONFIG
    db/
      database.ts         Database: pool pg con SSL verificado; withTenant(empresaId, fn) y ping()
      database.module.ts  módulo global que exporta Database
      ids.ts              newId(): UUID v7 (uuid), porque Postgres 17 no tiene uuidv7()
      schema/             tablas Drizzle, sin schema (lo fija el rol por search_path)
        companies.ts
        branches.ts
        index.ts
    http/
      errors.ts           AppError y subclases: ValidationError 400, NotFoundError 404, ConflictError 409,
                          BusinessRuleError 422, ServiceUnavailableError 503
      error.filter.ts     filtro global (@Catch()): toda respuesta de error es { code, message, details? }
      zod-validation.pipe.ts   ZodValidationPipe(schema)
      request-id.middleware.ts X-Request-Id (UUID v7) en toda respuesta
      http.module.ts      HttpCoreModule: APP_FILTER + middleware en '*path'
    health/
      health.controller.ts     GET /health, el único endpoint de BE-0a
  test/
    setup/guard.ts        globalSetup: se niega a arrancar si la conexión no es sdgpd_app_test sobre sdgpd_test
    support/db.ts         testConfig() (pool de 2), rawTestClient() sin tenant, pgCode()
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
- **Tenant:** `Database.withTenant(empresaId, fn)` abre una transacción, ejecuta `select set_config('app.empresa_id', $1, true)` y corre `fn(tx)`. Es la única forma de tocar tablas de negocio: el cliente Drizzle es privado, y ESLint prohíbe `pg` y `drizzle-orm/node-postgres` fuera de `src/db/`. Sin tenant, toda tabla con RLS devuelve cero filas.

## Flujo de un request

`RequestIdMiddleware` (genera y devuelve `X-Request-Id`) → controller (`ZodValidationPipe` con un schema de `contracts`) → servicio (`Database.withTenant`, desde BE-1 con la empresa de la sesión) → respuesta. Cualquier excepción pasa por `ErrorFilter`, y lo no previsto sale como `500 internal-error` con el detalle solo en el log.
