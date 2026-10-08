# VERIFICACIÓN BE-0a — checklist manual

**Fecha:** 2026-10-08. Lo corre Leandro. Todo desde la raíz del repo (`C:\proyectos\SDGPD`), con Node 24 y `BackEnd/.env` armado según `BackEnd/docs/SETUP_SUPABASE.md`. BE-0a no conecta ningún módulo del frontend, así que no hay pasos de navegador.

**Gate 5:** el único endpoint, `GET /health`, es operativo. Tiene su schema en `contracts` (`healthResponseSchema`) y su consumidor es este checklist y el monitoreo, no el frontend (ADR-BE-001, sub-decisión 16).

## 1. Instalar, compilar y testear

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | `npm ci` | termina sin errores. Puede avisar `allow-scripts` por `esbuild`: es esperado, funciona sin su postinstall |
| 1.2 | `npm run typecheck` | `contracts` y `backend` sin errores |
| 1.3 | `npm run lint` | sin errores ni warnings |
| 1.4 | `npm test` | `contracts`: 1 archivo, 12 tests. `backend`: 5 archivos, 39 tests, todos en verde. Tarda alrededor de 40 s, porque la base es remota |
| 1.5 | `npm run build` | genera `packages/contracts/dist/` y `BackEnd/dist/` |

## 2. Levantar el backend y pegarle a `/health`

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | `npm run start -w @sdgpd/backend` | en el log: `Mapped {/health, GET} route` y `Nest application successfully started` |
| 2.2 | En otra terminal: `curl -i http://localhost:3000/health` | `HTTP/1.1 200 OK`, header `X-Request-Id` con un UUID (el tercer bloque empieza con `7`), y body `{"status":"ok","database":"ok"}` |
| 2.3 | Repetí el 2.2 | el `X-Request-Id` cambia en cada request |
| 2.4 | `curl -i -H "X-Request-Id: mio" http://localhost:3000/health` | el `X-Request-Id` de la respuesta **no** es `mio`: lo genera el servidor |
| 2.5 | `curl -i http://localhost:3000/no-existe` | `404`, body `{"code":"not-found","message":"Cannot GET /no-existe"}` y `X-Request-Id` |
| 2.6 | `curl -i -X POST -H "Content-Type: application/json" -d "{mal" http://localhost:3000/health` | `400`, body `{"code":"validation-error","message":"Expected property name or '}' in JSON ..."}`: el JSON se parsea antes de rutear, así que el JSON mal formado gana sobre la ruta inexistente |
| 2.6b | `curl -i -X POST http://localhost:3000/health` | `404`, body `{"code":"not-found","message":"Cannot POST /health"}` |
| 2.7 | Cortá el backend (Ctrl+C) | se detiene sin errores |

## 3. El backend no levanta sin configuración

| # | Paso | Resultado esperado |
|---|---|---|
| 3.1 | Renombrá `BackEnd/.env` a `BackEnd/.env.bak` y corré `npm run start -w @sdgpd/backend` | sale con error y lista `PORT`, `DATABASE_URL` y `DATABASE_CA_CERT`, **sin mostrar ningún valor**. Volvé a renombrarlo a `.env` |

## 4. Aislamiento a mano

Cada sentencia se ejecuta por separado y muestra su resultado o su error.

| # | Paso | Resultado esperado |
|---|---|---|
| 4.1 | `npm run db:sql -w @sdgpd/backend -- app_test "select current_user, current_schema()"` | `sdgpd_app_test`, `sdgpd_test` |
| 4.2 | `npm run db:sql -w @sdgpd/backend -- app_test "select count(*) from branches"` | `0`: sin tenant no se ve nada |
| 4.3 | `npm run db:sql -w @sdgpd/backend -- app_test "set row_security = off" "select * from branches"` | el `SET` funciona; el `SELECT` falla con `42501 query would be affected by row-level security policy for table "branches"` |
| 4.4 | `npm run db:sql -w @sdgpd/backend -- app_test "alter table branches add column x int"` | `42501 must be owner of table branches` |
| 4.5 | `npm run db:sql -w @sdgpd/backend -- app_test "select * from sdgpd.branches"` | `42501 permission denied for schema sdgpd` |
| 4.6 | `npm run db:sql -w @sdgpd/backend -- app "select current_user, current_schema()"` | `sdgpd_app`, `sdgpd` |

## 5. El guard de los tests

| # | Paso | Resultado esperado |
|---|---|---|
| 5.1 | En `BackEnd/.env`, cambiá temporalmente el valor de `DATABASE_URL_TEST` por el de `DATABASE_URL` y corré `npm test -w @sdgpd/backend` | no corre ningún test: `Los tests se niegan a arrancar: la conexión es sdgpd_app sobre sdgpd, y tiene que ser sdgpd_app_test sobre sdgpd_test`. **Restaurá el valor** |

## 6. Supabase

| # | Paso | Resultado esperado |
|---|---|---|
| 6.1 | En el dashboard: Project Settings › Data API › Exposed schemas | `sdgpd` y `sdgpd_test` **no** figuran |
| 6.2 | Table Editor, schema `sdgpd` | aparecen `companies`, `branches` y `schema_migrations`, todas con RLS activo, salvo `schema_migrations` |
