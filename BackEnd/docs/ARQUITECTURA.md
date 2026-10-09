# Arquitectura del backend

**Verificado contra el filesystem el 2026-10-09** (tanda BE-1b; antes, BE-1a y BE-0b el mismo día y BE-0a el 2026-10-08; `find BackEnd packages -not -path '*/node_modules/*' -not -path '*/dist/*'`). Si leés esto después de esa fecha, reverificalo antes de confiar en él (PROTOCOLO.md regla 2.10).

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
    branches.ts         branchSchema, branchListQuerySchema, branchPageSchema (BE-1a)
    auth.ts             MODULES (10) × ACTIONS (7), permissionSchema, emailSchema, loginRequestSchema, sessionSchema,
                        accessTokenResponseSchema, loginResponseSchema, REQUESTED_WITH_HEADER, authErrorCodes (BE-1a)
    users.ts            userSchema, create/updateUserRequestSchema, passwordSchema, userListQuerySchema, roleSchema,
                        updateRolePermissionsRequestSchema, roleListQuerySchema, páginas, userErrorCodes (BE-1a)
  test/
    contracts.test.ts
    query.test.ts
    auth.test.ts        matriz, login, usuarios, sesión (BE-1a)
```

Tiene el contrato transversal (ADR-BE-004 y ADR-BE-006) y, desde BE-1a, el de autenticación, usuarios, roles y sucursales. Lint y tests usan las herramientas de `BackEnd` con `--config` (ADR-BE-001, sub-decisión 12).

**Cómo lo consume `BackEnd`** (ADR-BE-001, sub-decisión 8): el typecheck y los tests resuelven `@sdgpd/contracts` por la condición `sdgpd-source`, que apunta a las fuentes. Un cambio en `contracts` que rompe al backend falla en el `tsc --noEmit` del backend sin compilar nada antes. El build y el runtime usan `dist/`.

## `BackEnd/`

```
BackEnd/
  package.json            scripts: typecheck, lint, test, build, start, db:setup, db:generate, db:migrate, db:sql, db:seed-dev
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
    0004_identity.sql                generada (BE-1a): roles, role_permissions, users, user_branches, refresh_tokens,
                                     login_attempts; FK de user_id en idempotency_keys y audit_log (NOT VALID)
    0005_rls_identity.sql            custom (BE-1a): RLS de las 6 tablas, política definer_lookup (users,
                                     refresh_tokens) y las funciones SECURITY DEFINER auth_find_user/auth_find_refresh_token
    0006_refresh_tokens_cleanup.sql  custom (BE-1b): política expired_cleanup (DELETE de vencidos sin tenant)
    meta/                 journal y snapshots de drizzle-kit
  scripts/db/             corren con Node 24 sin compilar
    lib.ts                conexión con SSL verificado, roles, schemas, lectura y escritura de .env;
                          APPEND_ONLY_TABLES (revoca UPDATE/DELETE de audit_log a los roles de aplicación);
                          DEFINER_FUNCTIONS + hardenDefinerFunctions (search_path y EXECUTE de las funciones, BE-1a);
                          ensureAppSecrets (JWT_SECRET, BE-1a; IDEMPOTENCY_HMAC_KEY, BE-1b)
    setup.ts              roles, schemas, privilegios, URLs y las claves del servidor en .env (idempotente, como postgres;
                          `-- --secrets-only` solo genera los secretos)
    migrate.ts            runner propio: mismas migraciones en sdgpd y sdgpd_test (como sdgpd_migrator)
    sql.ts                ejecuta SQL como un rol propio, con o sin tenant (reemplaza a psql)
    seed-dev.ts           seed de desarrollo, solo sdgpd (BE-1a): 2 empresas, sucursales del mock, 4 roles, admins
    demo-ids.ts           BE-1b: ids FIJOS de la empresa demo y sus 4 sucursales (los mismos del mock del frontend)
    demo-branches.ts      BE-1b: ensureDemoBranches, crea o migra las sucursales demo a su id fijo sin duplicarlas
  src/
    main.ts               valida la config y levanta Nest; sin config válida (o con una ruta sin política) no arranca
    app.module.ts         AppModule.register(config): DatabaseModule + HttpCoreModule + AuthModule + CommandModule
                          + SettingsModule + HealthController
    context/actor.ts      Actor { empresaId, userId, requestId }; bindActor (ÚNICO punto de entrada, lo llama AuthGuard),
                          requireActor, @CurrentActor()
    config/config.ts      loadConfig(env) con Zod (PORT, DATABASE_URL, DATABASE_CA_CERT, JWT_SECRET, IDEMPOTENCY_HMAC_KEY); APP_CONFIG
    auth/                 autenticación y permisos (BE-1a, ADR-BE-003)
      auth.module.ts      AuthController, AuthService, TokenService, AuthStore, AuthGuard (APP_GUARD por useExisting),
                          RoutePolicyCheck y ROUTE_ALLOWLIST
      auth.controller.ts  POST /auth/login | refresh | logout, GET /auth/session
      auth.service.ts     login (mismo 401 para todo fallo, bloqueo, rama native 501), refresh (rotación), logout, sesión
      auth.guard.ts       guard global: Bearer → claims → usuario con el tenant del token → bindActor → permiso →
                          branchId habilitado; @CurrentPrincipal()
      route-policy.ts     @RequirePermission(módulo, acción), @SessionOnly(), @Public(); PUBLIC_ROUTES, SESSION_ROUTES
      route-policy.check.ts   RoutePolicyCheck (onModuleInit): toda ruta declara política válida o la app no arranca
      tokens.ts           TokenService (JWT HS256 de 15 min: sub, emp, rol, ver, sid), refresh opaco y su SHA-256, Bearer
      refresh-cookie.ts   cookie sdgpd_refresh (HttpOnly, Secure, SameSite=Strict, Path=/auth/refresh), lectura a mano
      passwords.ts        argon2id (m=19456, t=2, p=1, PHC), verificación, hash de relleno para emails inexistentes
      default-roles.ts    los 4 roles iniciales y su matriz (sin Nest: también lo importa scripts/db/seed-dev.ts)
    settings/             gestión de usuarios, roles y sucursales, módulo settings (BE-1a)
      settings.module.ts
      users.controller.ts GET /users, POST /users, PUT /users/:id
      roles.controller.ts GET /roles, PUT /roles/:id/permissions
      branches.controller.ts  GET /branches (todas con settings.ver; si no, las habilitadas)
      identity.queries.ts entidades auditadas (user sin passwordHash, user-branch, role, role-permission) y lecturas
    db/
      database.ts         Database: pool pg con SSL verificado; withTenant (solo src/db/ y tests), read() READ ONLY,
                          command(), idempotentCommand(), cleanupExpiredIdempotencyKeys(), ping();
                          findLoginUser() y findRefreshToken(): las ÚNICAS lecturas sin tenant (funciones SECURITY DEFINER)
      database.module.ts  módulo global que exporta Database e IdempotencyCleanupService
      tenant-tx.ts        tipos Db y TenantTx
      command.ts          CommandTx: select + insert/update/delete siempre auditados (update/delete con versión) + nextNumber;
                          removeChild (borrado auditado de filas hijas sin versión) y revokeRefreshTokens (BE-1a);
                          lockScope (advisory lock de transacción por empresa y scope, BE-1b)
      auth-store.ts       AuthStore: intentos de login, familias y rotación de refresh, carga del usuario del guard, sesión
      refresh-tokens.ts   insertar, revocar familia, revocar los de un usuario (TTL 30 días)
      pg-errors.ts        isUniqueViolation(err, constraint)
      idempotency.ts      canonicalJson, payloadHash (HMAC-SHA256 con IDEMPOTENCY_HMAC_KEY desde BE-1b), claimKey/completeKey, TTL 48 h
      idempotency-cleanup.service.ts  setInterval de 15 min + advisory lock: claves de idempotencia y, desde BE-1b,
                          refresh tokens vencidos (Database.cleanupExpiredRefreshTokens, con su propio lock)
      counters.ts         nextNumber(tx, empresaId, series): SERIE-000001
      pagination.ts       offsetPage, cursorPage, encodeCursor/decodeCursor, keysetAfter/keysetOrder (instante, id), orderByWhitelist
      ids.ts              newId(): UUID v7 (uuid), porque Postgres 17 no tiene uuidv7()
      schema/             tablas Drizzle, sin schema (lo fija el rol por search_path)
        companies.ts
        branches.ts       (BE-0b: version)
        idempotency-keys.ts   (BE-1a: FK de user_id)
        audit-log.ts      (BE-1a: FK de user_id)
        document-counters.ts
        identity.ts       roles, role_permissions, users, user_branches, refresh_tokens, login_attempts (BE-1a)
        index.ts
    http/
      errors.ts           AppError y subclases: ValidationError 400, InvalidQueryError 400, IdempotencyKeyRequiredError 400,
                          UnauthenticatedError 401, InvalidCredentialsError 401, ForbiddenError 403, NotFoundError 404,
                          ConflictError 409, BusinessRuleError 422, IdempotencyKeyReusedError 422, NotImplementedError 501,
                          ServiceUnavailableError 503
      command.interceptor.ts   CommandInterceptor (global): toda mutación fuera de /auth/* es un comando; POST exige
                          Idempotency-Key; PUT/PATCH/DELETE la honran si viene (Paso 0 de BE-1a); @Command() da el CommandTx
      command.module.ts   APP_INTERCEPTOR
      list-query.pipe.ts  ListQueryPipe(spec): 400 invalid-query fuera de la lista blanca
      error.filter.ts     filtro global (@Catch()): toda respuesta de error es { code, message, details? }
      zod-validation.pipe.ts   ZodValidationPipe(schema)
      request-id.middleware.ts X-Request-Id (UUID v7) en toda respuesta
      http.module.ts      HttpCoreModule: APP_FILTER + middleware en '*path'
      api-prefix.ts       BE-1b: API_PREFIX ('api'), apiPath(), configureApp(app) — el prefijo global /api, aplicado
                          en un solo lugar por main.ts y por todas las apps de los tests
    health/
      health.controller.ts     GET /health, público
  test/
    setup/guard.ts        globalSetup: se niega a arrancar si la conexión no es sdgpd_app_test sobre sdgpd_test
    support/db.ts         testConfig() (pool de 2, con JWT_SECRET), rawTestClient() sin tenant, pgCode()
    support/probe-app.ts  app de prueba: reemplaza al AuthGuard por un guard que fija el actor desde headers (SOLO en
                          test/) y rutas /probe/* (settings.editar), /auth/probe (pública solo acá)
    support/tenants.ts    createTestCompany (con un usuario real), createTestUser, removeTestCompany
    support/auth-app.ts   app completa con el AuthGuard real, empresas con roles/usuarios/sucursales, login/refresh,
                          registro de respuestas y búsqueda de secretos (V4)
    auth/auth.test.ts     login (mismo 401, bloqueo, native 501), refresh (rotación, reuso, CSRF), logout, JWT forjados
    auth/permissions.test.ts   403/200, matriz y versión de permisos, branchId, usuarios, aislamiento por endpoint, arranque
    db/definer.test.ts    funciones SECURITY DEFINER: columnas, catálogo, EXECUTE; sin tenant 0 filas
    db/idempotency.test.ts   replay, 422, 400, rollback, concurrencia, /auth/*, limpieza
    db/idempotency-mutations.test.ts   Idempotency-Key en PUT (Paso 0 de BE-1a)
    auth/be1b-backend.test.ts   BE-1b: HMAC, último admin (y concurrencia), login parejo, limpieza de refresh, /api,
                          sucursales demo con id fijo
    db/mutations.test.ts     versión (409/404), auditoría (before/after, rollback, permisos), contadores
    db/pagination.test.ts    offset (total, pageSize máximo) y cursor (recorrido con inserciones), lista blanca
    db/catalog.test.ts    suite de catálogo (cubre cualquier tabla futura)
    db/isolation.test.ts  suite funcional de aislamiento (A contra B, 11 tablas) + semántica de withTenant
    http/error-filter.test.ts   400 / 422 / 500 / 404 / JSON mal formado / X-Request-Id
    http/health.test.ts   /health ok y 503 con la aplicación completa
    config/config.test.ts loadConfig
  docs/
    ARQUITECTURA.md       este archivo
    SETUP_SUPABASE.md     cómo armar el entorno
    verificaciones/VERIFICACION_BE-0a.md, VERIFICACION_BE-1a.md   checklists manuales
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
  - `user_id` tiene FK compuesta `(empresa_id, user_id) → users` desde BE-1a, `NOT VALID` (las filas viejas de los tests no se validan; las nuevas sí). Un usuario auditado no se puede borrar.
- **Tablas de identidad (BE-1a, ADR-BE-003),** todas con RLS forzado, `tenant_isolation`, FK compuestas y su caso en la suite de aislamiento:
  - `roles` (`UNIQUE (empresa_id, name)`, `version`) y `role_permissions` (una fila por permiso módulo × acción, con CHECK de los 10 módulos y las 7 acciones).
  - `users`: email único **global** y normalizado (CHECK), `password_hash` argon2id (CHECK `$argon2id$`), `role_id`, `active`, `permissions_version` y `version`.
  - `user_branches`: sucursales habilitadas por usuario.
  - `refresh_tokens`: solo el SHA-256 del token (CHECK de 64 hex, único), `family_id`, `expires_at`, `used_at`, `revoked_at`.
  - `login_attempts`: PK `(empresa_id, user_id)`, `failed_count`, `window_started_at`, `locked_until`.
  - `users` y `refresh_tokens` tienen además la política `definer_lookup` (`FOR SELECT TO` el migrador): la usan **solo** las funciones `SECURITY DEFINER` `auth_find_user(email)` y `auth_find_refresh_token(hash)`, que devuelven lo mínimo para el login y el refresh sin tenant. `search_path` fijo (`<schema>, pg_temp`) y `EXECUTE` solo para el rol de aplicación de su schema (los fija `scripts/db`).
- **Tenant:** `Database.withTenant(empresaId, fn)` abre una transacción, ejecuta `select set_config('app.empresa_id', $1, true)` y corre `fn(tx)`. El cliente Drizzle es privado, y ESLint prohíbe `pg` y `drizzle-orm/node-postgres` fuera de `src/db/`. Desde BE-0b, fuera de `src/db/` ESLint también prohíbe `withTenant` y la reflexión (`Reflect`, `Object.getOwnProperty*`, `.session`), así que el código de negocio entra solo por `Database.read()` (READ ONLY) o por un comando (`CommandTx`, con escrituras siempre auditadas; ADR-BE-005, sub-decisión 11). Sin tenant, toda tabla con RLS devuelve cero filas.

## Flujo de un request

**Desde BE-1b, toda ruta lleva el prefijo global `/api`** (`/api/health`, `/api/auth/login`, `/api/users`…), fijado por `configureApp`. La cookie de refresh va con `Path=/api/auth/refresh`. Los nombres de ruta de la verificación de arranque y de las listas `PUBLIC_ROUTES`/`SESSION_ROUTES` incluyen el prefijo.

`RequestIdMiddleware` (genera y devuelve `X-Request-Id`) → `AuthGuard` (BE-1a; las rutas públicas pasan sin tocar nada): access token → usuario, rol, permisos y sucursales con el tenant del token → `bindActor` → permiso de la ruta (403) → `branchId` habilitado (403) → `CommandInterceptor`, solo en mutaciones: transacción con el tenant del actor, más `Idempotency-Key` en POST (y en PUT/PATCH/DELETE si viene) → controller (`ZodValidationPipe` o `ListQueryPipe` con un schema de `contracts`) → lectura con `Database.read()` o comando con `@Command() tx: CommandTx` → respuesta (un replay lleva `Idempotent-Replayed: true`). Cualquier excepción pasa por `ErrorFilter`, y lo no previsto sale como `500 internal-error` con el detalle solo en el log.
