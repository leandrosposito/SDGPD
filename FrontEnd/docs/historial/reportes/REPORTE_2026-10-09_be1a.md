# REPORTE 2026-10-09 — Sesión `sesion-be1a-2026-10-09` (tanda BE-1a)

> Verificado contra el filesystem el **2026-10-09**, en la rama `sesion-be1a-2026-10-09` (desde `lean` `e36b4c6`). Si leés esto después, reverificá.

Base: `lean` en `e36b4c6`, tag `pre-sesion-be1a-2026-10-09`. Tarea única: BE-1a (autenticación, identidad y permisos en el backend, ADR-BE-003). `FrontEnd/` no se tocó (solo este reporte y `ESTADO.md`, que viven en `FrontEnd/docs/`).

## Preflight y línea base

- `C:\proyectos\SDGPD`, `lean` en `e36b4c6`, árbol limpio, Node `v24.19.0`.
- **`SUPABASE_CA_CERT` no está definida** como variable de entorno (ni de usuario ni de máquina). `SETUP_SUPABASE.md` la marca como **opcional**: lo que importa es `DATABASE_CA_CERT` en `.env`, que apunta a un certificado que existe (`-----BEGIN CERTIFICATE-----`). Seguí con eso (decisión 1).
- `BackEnd/.env` tiene las URLs de los tres roles (`DATABASE_URL`, `DATABASE_URL_TEST`, `DATABASE_URL_MIGRATOR`).
- Línea base de los workspaces: typecheck exit 0, lint exit 0, build exit 0, test exit 0 (`contracts` 18 tests en 2 archivos; backend 86 tests en 8 archivos, 195 s).

## Qué hice, por tanda (hecha / parcial / no hecha + por qué)

| Parte | Estado | Detalle |
|---|---|---|
| Paso 0 (objeción 3 de ADR-BE-005) | **Hecho** | El backend honra `Idempotency-Key` en PUT/PATCH/DELETE si viene (en POST sigue obligatoria), con las mismas reglas: replay de la respuesta original, 422 con otro payload. Sin clave, igual que antes. Resolución escrita debajo de la objeción; corregidas las consecuencias para el frontend. Tests en `test/db/idempotency-mutations.test.ts` (5) |
| BE-1a, modelo | **Hecho** | `roles`, `role_permissions`, `users`, `user_branches`, `refresh_tokens`, `login_attempts` (migraciones 0004 generada y 0005 a mano, en `sdgpd` y `sdgpd_test`), RLS forzado, FK compuestas, 6 casos nuevos en `ISOLATION_CASES`. FK de `user_id` en `idempotency_keys` y `audit_log` (`NOT VALID`) |
| BE-1a, login/refresh sin tenant | **Hecho** | Dos funciones `SECURITY DEFINER` (`auth_find_user`, `auth_find_refresh_token`), dueño `sdgpd_migrator`, `search_path` fijo y `EXECUTE` solo para el rol de aplicación del schema |
| BE-1a, auth | **Hecho** | `POST /auth/login` (web: cookie; native: 501), `/auth/refresh` (con `X-Requested-With`, rotación y reuso), `/auth/logout`, `GET /auth/session`. JWT HS256 de 15 min. Mismo 401 para los tres fallos (y para el bloqueo) |
| BE-1a, guard y permisos | **Hecho** | Guard global con `bindActor`, `@RequirePermission`, 403, `branchId` habilitado. La app no arranca con una ruta sin política (probado en test y a mano, V3) |
| BE-1a, gestión | **Hecho** | `GET/POST /users`, `PUT /users/{id}`, `GET /roles`, `PUT /roles/{id}/permissions`, `GET /branches`; schemas en `packages/contracts` |
| BE-1a, seed | **Hecho** | `db:seed-dev`, idempotente, solo `sdgpd` (se niega con `sdgpd_test`, probado) |
| BE-1a, tests | **Hechos** | 165 tests del backend (eran 86) en 12 archivos, y 27 de `contracts` (eran 18) |
| Documentación | **Hecha** | `BackEnd/docs/ARQUITECTURA.md`, plan del README (BE-1a hecha, BE-1b detallada, alta de empresas pendiente), sub-decisiones 9-23 en ADR-BE-003 y 16-21 en ADR-BE-002, `SETUP_SUPABASE.md`, `BackEnd/CLAUDE.md`, `VERIFICACION_BE-1a.md`, `ESTADO.md` y este reporte |

**Dependencias:** las dos autorizadas, versión estable más reciente, `--save-exact`, solo en `BackEnd`: `jose` 6.2.12 y `@node-rs/argon2` 2.2.2. El binario precompilado de Windows carga bien (bajo Smart App Control). El lockfile suma esas dos y los 13 paquetes de binarios por plataforma de argon2, que son sus `optionalDependencies`, no dependencias que yo haya agregado a mano. Nada más: 0 líneas quitadas.

## Commits creados (hash + mensaje) y qué se mergeó a lean

| Hash | Mensaje |
|---|---|
| `ddb2cb3` | feat(backend): Paso 0 de BE-1a — Idempotency-Key también en PUT/PATCH/DELETE (ADR-BE-005, objeción 3) |
| `782a546` | feat(backend): BE-1a — autenticación, identidad y permisos (ADR-BE-003, ADR-BE-002) |
| (docs) | docs: BE-1a — ADRs, plan, arquitectura, checklist, estado y reporte |

Los hashes del commit de documentación y del merge `--no-ff` a `lean` están en el informe del chat (este archivo va dentro de ese commit).

## Decisiones que tomé sin consultar

Las de diseño están escritas como sub-decisiones en sus ADRs: **ADR-BE-003, sub-decisiones 9 a 23**; **ADR-BE-002, 16 a 21**; **ADR-BE-005, la sub-decisión de la resolución de la objeción 3**. Las principales:

1. **Preflight sin `SUPABASE_CA_CERT`:** la doc la declara opcional y el certificado de `DATABASE_CA_CERT` existe. No paré.
2. **JWT HS256** con clave de 32 bytes en `JWT_SECRET`; emisor y audiencia fijos; algoritmo fijado en la verificación.
3. **Claim `sid` y logout por access token.** La consigna pide a la vez `Path=/auth/refresh` y que `/auth/logout` revoque la familia y borre la cookie. Con ese `Path`, el navegador no manda la cookie a `/auth/logout`. Mantuve el `Path` y el logout revoca la familia de la cookie si llega, o la del claim `sid` del access token si no.
4. **Bloqueo:** 5 fallos en 15 minutos bloquean 15 minutos. El bloqueo responde el mismo 401 que cualquier fallo; un email inexistente no deja fila. Así `login_attempts` tiene `empresa_id` como toda tabla.
5. **Política de rutas:** tres decoradores (`@RequirePermission`, `@SessionOnly`, `@Public`) con listas cerradas. `GET /auth/session` y `GET /branches` son de sesión sin permiso de módulo, porque todo usuario los necesita.
6. **`definer_lookup TO CURRENT_USER`**: `FORCE RLS` alcanza al dueño, así que las funciones necesitan una política propia. Es del migrador (no le da nada que no tenga). El `search_path` y el `EXECUTE` los fija `scripts/db`, porque las migraciones no pueden nombrar schemas ni roles.
7. **FK de `user_id` `NOT VALID`** (filas viejas de los tests de BE-0b con usuarios inventados; `audit_log` no se puede corregir). Un usuario auditado ya no se puede borrar.
8. **El hash de idempotencia cubre los parámetros de la ruta** (Paso 0): sin eso, la misma clave sobre otro `:id` haría replay ajeno.
9. **Matrices iniciales** de Vendedor, Chofer y Deposito (Admin: todo).
10. **Contraseña inicial de 12 a 256 caracteres**; el email no se edita; email repetido, 409 `email-in-use`.
11. **`CommandTx.removeChild`** (borrado auditado de filas hijas sin versión) y **`CommandTx.revokeRefreshTokens`**.
12. **`refresh_tokens` y `login_attempts` no se auditan** (infraestructura de sesión, como `idempotency_keys`).
13. **Tests de BE-0b adaptados a la FK nueva** (regla 2.5, cambio justificado, sin aflojar ninguna aserción): `createTestCompany` crea un usuario real; `idempotency.test.ts` usa un segundo usuario real en vez de un id inventado; `isolation.test.ts` crea una fila por tabla nueva y su limpieza ahora exige que quede **exactamente** empresa, rol y usuario (los retiene la FK de `audit_log`) y que borrar al usuario falle con 23503 (antes exigía cero filas, que ya no es posible); `config.test.ts` pasa `JWT_SECRET` en el caso "con todas las variables" (antes de agregarla, la config completa eran tres variables). La app de prueba de BE-0b reemplaza al `AuthGuard` con su guard de headers (`overrideProvider`) y sus rutas declaran política. Los 86 tests originales siguen, con las mismas aserciones.
14. **`ESTADO.md` y este reporte** viven en `FrontEnd/docs/`. Los escribí porque la consigna los pide; es el único cambio bajo `FrontEnd/`.

## Hallazgos de la Fase D y cómo los corregí (con la evidencia antes y después)

**V1. JWT falsificados**, contra el backend levantado con el seed (`GET /auth/session`):

```
== V1: JWT falsificados (GET /auth/session)
control: token legítimo de A                     -> 200
control: armado a mano con la clave correcta     -> 200
1. firmado con otra clave                        -> 401
2. alg none                                      -> 401
3. emp de B + sub de A, clave correcta           -> 401
4. vencido (clave correcta)                      -> 401
```

Lo mismo está como test (`auth.test.ts`, "V1…"), con el mismo control.

**V2. Reuso de refresh:**

```
== V2: reuso de refresh
rotación (viejo -> nuevo)                        -> 200 cookie distinta
reuso del viejo                                  -> 401
el nuevo, después del reuso                      -> 401
un login nuevo abre otra familia y refresca      -> 200
```

**V3. Guard de arranque:** borré `@RequirePermission('settings', 'ver')` de `UsersController.list`, compilé y levanté:

```
Error: Rutas sin política de acceso válida (ADR-BE-003, sub-decisión 6):
  - GET /users (UsersController.list) no declara permiso
exit=1
```

Restaurado desde la copia (`cmp` sin diferencias) y recompilado. También está como test (un controller sin decorador, y uno con `@Public()` fuera de la lista).

**V4. Secretos:**
- Los 98 cuerpos de respuesta de las suites de endpoints, volcados a un archivo (`V4_DUMP`): `grep -ciE 'password_?hash|\$argon2|token_?hash'` → **0**. `grep -ci refresh` → **1**, que es el mensaje `{"code":"csrf-header-required","message":"POST /auth/refresh exige el header X-Requested-With"}`, sin token.
- Los tests también buscan en cada cuerpo los refresh tokens emitidos (más de 10 por suite): 0.
- `audit_log` de las empresas de las dos suites de endpoints, después de correrlas: ninguna fila con un hash argon2, `password_hash`, `token_hash`, un refresh token ni su hash (test "V4… audit_log", con `total > 0`).
- **Límite:** no se puede recorrer `audit_log` entero. Sin tenant, RLS no deja ver nada (ni al dueño, por `FORCE`), y para enumerar las empresas hace falta `postgres`, cuya contraseña no está en este entorno. El chequeo cubre las empresas de las suites que ejercen los endpoints.

**V5.** Como `sdgpd_app_test`, sin tenant, con una empresa, un usuario y un refresh token recién insertados (y borrados después):

```
> select count(*) as users from users                 → 0
> select count(*) as refresh_tokens from refresh_tokens → 0
> select * from auth_find_user('V5-…@SDGPD.TEST ')    → columnas id | empresa_id | password_hash | active (1 fila)
> select * from auth_find_refresh_token('c1935597…')  → columnas id | empresa_id | user_id | family_id (1 fila, sin el hash)
> select full_name from users where email = 'v5-…'    → SELECT 0
```

Catálogo (`definer.test.ts`): las dos funciones son `SECURITY DEFINER`, con `search_path=sdgpd_test, pg_temp`, dueño `sdgpd_migrator`, ACL `{sdgpd_migrator=X, sdgpd_app_test=X}`. `PUBLIC` y `sdgpd_app` no las pueden ejecutar. `definer_lookup` es solo del migrador.

**V6. Build desde cero y diff:**
- `FrontEnd/` desde `e36b4c6`: 0 archivos en los commits de código (solo `ESTADO.md` y este reporte, en el commit de docs).
- `package.json` y lockfile: `BackEnd/package.json` suma exactamente `@node-rs/argon2: 2.2.2`, `jose: 6.2.12` y el script `db:seed-dev`; `package-lock.json`, +255 líneas (las dos dependencias y los 13 binarios por plataforma de argon2), 0 quitadas.
- `git grep -F` (en `HEAD` y en el árbol, incluidos los no versionados) del ref del proyecto, del host del pooler, de las contraseñas de las tres URLs, de `JWT_SECRET` y de los emails y contraseñas del seed: **0 coincidencias en los 10**. Control: la misma búsqueda de `sdgpd_refresh` da 3 en `HEAD` y 6 en el árbol.

**D8, desde cero**, sobre `782a546` con solo los docs sin commitear (`git status --porcelain`: los 7 archivos de `BackEnd/docs` y `BackEnd/CLAUDE.md`): `rm -rf node_modules BackEnd/node_modules packages/contracts/node_modules BackEnd/dist packages/contracts/dist`, después `npm ci` exit 0 (solo los avisos `allow-scripts` de esbuild, esperados), typecheck exit 0, lint exit 0 (0 warnings), build exit 0, test exit 0: `contracts` **27/27** en 3 archivos y backend **165/165** en 12 archivos (635 s).

**D6 (tipos), corregido antes del commit de la tanda:** en los tests nuevos había 4 casts sobre cuerpos de respuesta y matchers (`body as {…}`, `expect.any(String) as unknown`). Los reemplacé por `schema.parse(body)` y `toMatchObject`. En `src/` no hay ningún `any`, `@ts-ignore` ni `as` sobre tipos de dominio (solo `as const`).

**D7 (restos):** el tipo `BranchRow` (`settings/identity.queries.ts`) no lo usa nadie. Queda como BAJO.

**Paso 0 aislado:** no pude correr los tests del commit `ddb2cb3` solo. La base ya tiene las migraciones 0004/0005, cuya FK nueva rechaza los usuarios inventados de los tests de BE-0b de ese commit. Los 5 tests del Paso 0 pasan en el estado final (165/165).

## Hallazgos MEDIO/BAJO documentados y no tocados

- **MEDIO, idempotencia y contraseñas:** el `payload_hash` de `POST /users` es SHA-256 del body canonicalizado, que incluye la contraseña inicial en claro. Durante 48 h, quien pueda leer `idempotency_keys` de esa empresa puede probar contraseñas contra un hash rápido. Arreglo propuesto: HMAC del payload con una clave del servidor (cambia la sub-decisión 2 de ADR-BE-005). La respuesta guardada no tiene secretos.
- **BAJO, tiempo del login:** con un email existente hay una o dos consultas más (estado del bloqueo, registrar el fallo) que con uno inexistente. Con la base remota puede medirse.
- **BAJO:** no hay limpieza de `refresh_tokens` vencidos ni revocados (crecen); no hay re-hasheo de argon2 al login si se suben los parámetros; `BranchRow` sin uso.
- **BAJO, regex del runner de migraciones:** el patrón `\bsdgpd(_test)?\b` de `migrate.ts` no detecta `sdgpd_migrator` ni `sdgpd_app` (el `_` es parte de la palabra). Ninguna migración los nombra; el comentario promete más de lo que el patrón hace.
- **Proceso:** en `sdgpd_test` quedan, por diseño, las empresas de prueba cuyos usuarios quedaron auditados.

## Riesgos introducidos

- **`Path` de la cookie y el proxy de Vite (BE-1b):** la cookie va con `Path=/auth/refresh`. Si el frontend llama por `/api/auth/refresh` (proxy de Vite) y el proxy reescribe el path, el navegador no la manda (compara contra la URL que ve). BE-1b tiene que elegir: proxy sin prefijo o `Path` configurable.
- **Dos refresh en paralelo con la misma cookie revocan la familia** (el segundo es un reuso). BE-1b tiene que hacer un solo refresh en vuelo.
- **Un admin se puede dejar sin acceso:** puede sacarle `settings.editar` a su propio rol o desactivarse. No hay guarda.
- **El guard consulta la base en cada request con sesión** (una transacción de solo lectura). Con la base remota suma latencia a cada request.
- **Cambiar la matriz de un rol sube también la `version` de sus usuarios:** un formulario de usuario abierto en ese momento da 409.
- **`Secure` en desarrollo:** los navegadores aceptan cookies `Secure` en `http://localhost`, pero no en otro host por HTTP.

## Qué NO verifiqué (esta verificación es estática, no abre un navegador)

- Nada en navegador (BE-1a no tiene frontend).
- El commit del Paso 0 aislado (ver arriba).
- `audit_log` entero (sin `postgres`).
- `db:setup` completo: no tengo `SUPABASE_DB_PASSWORD`. Corrí solo `-- --secrets-only` (generó `JWT_SECRET`). El endurecimiento de las funciones lo aplicó `db:migrate`; el mismo paso en `setup.ts` no se ejecutó.
- La rama de fallo del script v13 (queda para BE-1b, como pide la consigna).

## Qué tiene que probar Leandro a mano, en orden de riesgo

El detalle, con los comandos, está en `BackEnd/docs/verificaciones/VERIFICACION_BE-1a.md`:

1. Refresh, reuso y logout (sección 3).
2. Permisos y cambio de matriz invalidando el token (2.8 a 2.12).
3. Aislamiento entre las dos empresas del seed (sección 4).
4. Login con los tres fallos idénticos y el bloqueo (sección 1).
5. La app no arranca con una ruta sin política (sección 5).
6. `npm run db:setup -w @sdgpd/backend` completo (con `SUPABASE_DB_PASSWORD`), y que después `db:migrate` siga diciendo "sin migraciones pendientes".

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-be1a-2026-10-09 en lean>
```

El revert no deshace las migraciones aplicadas en Supabase (0004 y 0005 en los dos schemas) ni el seed de `sdgpd`.
