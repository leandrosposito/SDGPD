# Estado — SDGPD Frontend

**Corresponde a: 2026-10-09, rama `lean` (hasta `sesion-be1c-2026-10-09` incluida — BE-1c, los dos MEDIO de BE-1b, ver `docs/historial/reportes/REPORTE_2026-10-10_be1c.md`; BE-1b, conexión del frontend a la autenticación, ver `REPORTE_2026-10-09_be1b.md`; backend BE-1a, ver `REPORTE_2026-10-09_be1a.md`; frontend Tanda 25, ver `docs/historial/reportes/REPORTE_2026-10-09_tanda25.md`; Tandas 23/24, ver `REPORTE_2026-10-09_tandas23-24.md`, y Tanda 22, ver `REPORTE_2026-10-09_tanda22.md`; backend BE-0b, ver `docs/historial/reportes/REPORTE_2026-10-09.md`, y BE-0a, ver `REPORTE_2026-10-08.md`; Tandas 17-21 en `REPORTE_2026-10-07.md` y `REPORTE_2026-10-07b.md`).** Este es el único snapshot vigente del proyecto — reemplaza a `docs/historial/auditorias/AUDIT_00_RESUMEN.md` (que quedó fijado al 2026-09-06 y ya no describe el estado real) como lectura de entrada. **Reescribilo al cerrar cada sesión** — no alcanza con dejar el `REPORTE_<fecha>.md`, ese documenta lo que se hizo, este documenta dónde está el proyecto AHORA.

## Tandas — todas cerradas hasta acá (verificado contra `git log --oneline lean` + la sesión en curso)

Tanda 0 (contención de errores) → Tanda 1 (capa `api/`, piloto `suppliers`) → Tanda 2 (cache TanStack Query) → Tanda 2.5 (`useCachedQuery`, `httpClient` unificado) → Tandas 3a-3g (migración de `orders`, `cash`, `settings`, `clients`, `inventory` completo incluida Reposición) → Tanda 4 (contexto de sucursal + estado en URL) → Tanda 5 (IDs tipados) → Tanda 6 (exportación server-side) → Tanda 7 (tablero/analítica) → Tanda 8 (entregas) → Tanda B/C1/C2 (funciones huérfanas + export en el resto de los listados) → ADR-009 (alcance del dashboard) → barrido de `empresaId` en los 17 services → reorganización física de la documentación (`historial/`, `negocio/`, `_archivo/`) → ADR-010/ADR-011 Aceptados (con correcciones 2026-09-09) + Tanda 9, modelo logístico base (ver `docs/historial/verificaciones/VERIFICACION_TANDA_9.md`) → ADR-012 Aceptado + Tanda 10A, code-splitting por ruta (ver `docs/historial/verificaciones/VERIFICACION_TANDA_10A.md`) → Tanda 10B, operación logística (vehículos, choferes, viajes, POD) sobre ADR-011 (ver `docs/historial/verificaciones/VERIFICACION_TANDA_10B.md`) → ADR-013/ADR-014 Aceptados + Tanda 11, ajustes de logística y pedidos (ver `docs/historial/verificaciones/VERIFICACION_TANDA_11.md`) → Tanda 12, ajustes de pedidos/inventario/clientes/proveedores (ver `docs/historial/verificaciones/VERIFICACION_TANDA_12.md`) → Tanda 13, hallazgo ALTO en `markStopNoVisitada` + trazabilidad de `ReprogramacionEvent` (enmienda ADR-013) (ver `docs/historial/verificaciones/VERIFICACION_TANDA_13.md`) → **Tandas 14/15/16: productos `inactive` excluidos de pedidos/OC/reposición, precondiciones de idempotencia movidas adentro de `withIdempotency` (hallazgo MEDIO), y los 10 campos fantasma restantes de `CreateClientModal` conectados (`PENDIENTES.md` ítem 15, cerrado)** (ver `docs/historial/reportes/REPORTE_2026-09-11_tanda14-16.md` y `docs/historial/verificaciones/VERIFICACION_TANDA_{14,15,16}.md`) → **sesión avance-2026-09-30: checklist unificado, lotes conservados al editar un producto, join por `Map` en Reposición, auditoría IAM/notificaciones** (ver `docs/historial/reportes/REPORTE_2026-09-30.md`) → **Tandas 17/18/19 (2026-10-07): clientes dados de baja fuera del alta de pedidos (ADR-015), estado Activo/Inactivo en el Directorio, ADR-016 sobre la deuda de `fetchProducts`** (ver `docs/historial/reportes/REPORTE_2026-10-07.md`) → **Tandas 20/21 (2026-10-07b): SKUs huérfanos del seed de pedidos corregidos, `createOrder` rechaza SKUs inexistentes (`product-not-found`, enmienda ADR-015)** (ver `docs/historial/reportes/REPORTE_2026-10-07b.md`) → **Tanda 22 (2026-10-09): regla de ESLint contra `as <Tipo>Id`, 3 exports huérfanos conectados, `SkeletonCard` borrado, definición de call-site real en el Gate 5** (ver `docs/historial/reportes/REPORTE_2026-10-09_tanda22.md`) → **Tandas 23/24 (2026-10-09): dinero con signo y redondeo simétrico (ADR-008); rango de fechas en la URL con lectura/escritura única en los 5 listados (PROTOCOLO 3.8). El punto 23.2 (cast `'' as Trip['id']`) quedó NO HECHO por condición de parada** (ver `docs/historial/reportes/REPORTE_2026-10-09_tandas23-24.md`) → **Tanda 25 (2026-10-09): cierre de PENDIENTES #23 (subcomponente `TripLivePosition`, sin centinela) con la regla de ESLint extendida al cast indexado, y `v13` sin el crash de libuv al salir** (ver `docs/historial/reportes/REPORTE_2026-10-09_tanda25.md`).

**No hay ninguna tanda "a medias"**: todo lo de arriba tiene commit real, mergeado a `lean`. Lo que sigue abajo no son tandas sin cerrar, son hallazgos que esas tandas no atacaron (fuera de su alcance declarado) o verificación en navegador que nunca se corrió.

## BE-1c hecha — refresh entre pestañas y una sola zod (2026-10-10, `sesion-be1c-2026-10-09`)

Cierra los dos MEDIO de BE-1b. Detalle en `docs/historial/reportes/REPORTE_2026-10-10_be1c.md`. Checklist sin ejecutar: `docs/historial/verificaciones/VERIFICACION_BE-1c.md`. Sub-decisiones: ADR-BE-003 (29) y ADR-BE-001 (17).

- **Refresh entre pestañas:** el refresh corre dentro de `navigator.locks.request('sdgpd-auth-refresh')`, así que hay uno solo a la vez en todo el navegador. El single-flight por pestaña sigue adentro. Sin Web Locks se sigue sin lock, con un aviso en modo debug. El servidor no cambia. Smoke `be-1c` (15): sin el lock en el core, 9 FAIL; con el lock, todo en verde.
- **Una sola zod (4.4.3):**
  - `contracts` la tiene como peer y el backend baja de 4.6.5 a 4.4.3; typecheck y los 177 + 27 tests en verde;
  - `npm ls zod` muestra una sola versión, deduplicada, y Vite suma `dedupe`;
  - el chunk `vendor-zod` bajó de 154.6 a 69.1 kB;
  - el lockfile cambió solo en zod.
- **Sigue abierto de BE-1b:** el chunk de entrada (`index-`) sigue en ~169 kB (era 117.5 antes de BE-1b) por los schemas de `contracts` y el código de auth que carga el store al arrancar. No es la zod duplicada.
- **Scripts del frontend:** 32, con el nuevo `be-1c`.

## BE-1b hecha — el frontend conectado a la autenticación (2026-10-09, `sesion-be1b-2026-10-09`)

Detalle en `docs/historial/reportes/REPORTE_2026-10-09_be1b.md`. Checklist de navegador sin ejecutar: `docs/historial/verificaciones/VERIFICACION_BE-1b.md`. Sub-decisiones nuevas: ADR-BE-003 (24-28), ADR-BE-005 (enmienda de la sub-decisión 2), ADR-BE-001 (15-16), ADR-BE-002 (22) y la enmienda de ADR-006.

- **Parte 0, backend:**
  - HMAC-SHA256 de idempotencia con `IDEMPOTENCY_HMAC_KEY` (cierra el MEDIO de BE-1a);
  - guarda de último admin (422 `last-admin`, con lock por empresa);
  - login con tiempo parejo;
  - limpieza de refresh tokens vencidos;
  - **prefijo global `/api`** (cookie `Path=/api/auth/refresh`);
  - ids fijos de la empresa demo y sus 4 sucursales en el seed.
- **Parte 1, workspaces:** `FrontEnd` es el tercer workspace y hay **un único lockfile, el de la raíz** (se borró `FrontEnd/package-lock.json`). Ninguna versión del frontend cambió (`npm ls --all` comparado; `xlsx` 0.20.3 con el mismo integrity); el build salió idéntico. El frontend consume `@sdgpd/contracts` desde sus fuentes (`sdgpd-source`).
- **Parte 2, modo mixto:**
  - `VITE_HTTP_SERVICES` es el único lugar que dice qué va por http; hoy `auth`, `session`, `users`, `roles` y `branches`. **Todo lo demás sigue en mock**, y sin la variable todo es mock como antes (sin login).
  - Access token en memoria; ante un 401, un solo refresh (single-flight) y un reintento.
  - Proxy de Vite `/api` sin reescribir.
  - Login, logout y guard de rutas.
  - `useSessionStore` contra `/api/auth/session`.
  - El mock usa los UUID fijos del seed para la empresa demo y sus sucursales.
- **Parte 3, UI:**
  - `usePermission` es el único lugar donde la UI pregunta por permisos, y solo oculta;
  - `USER_ROLE` ya no existe;
  - `TabUsersRoles` conectado: alta, edición, matriz 10 × 7, 409 y 422 con mensaje;
  - rama de fallo de v13 probada.
- **Tests y scripts:** 177 del backend y 27 de `contracts`. Hay 31 scripts del frontend, con los nuevos `be-1b`, `be-1b-ui` y `v18-ids-demo`; `v-adr009` se actualizó por los ids.
- **Sigue: BE-2** (proveedores, motivos, vehículos y choferes). Pendiente sin tanda: el alta de empresas en producción.

## Backend — BE-1a hecha (2026-10-09, `sesion-be1a-2026-10-09`)

Autenticación, identidad y permisos en el backend (ADR-BE-003). **`FrontEnd/` no cambió**: la conexión es **BE-1b**. Detalle en `docs/historial/reportes/REPORTE_2026-10-09_be1a.md`, estructura en `BackEnd/docs/ARQUITECTURA.md`, sub-decisiones nuevas en ADR-BE-003 (9-23) y ADR-BE-002 (16-21).

- **Paso 0:** ADR-BE-005, objeción 3, **resuelta**. El backend honra `Idempotency-Key` también en PUT/PATCH/DELETE cuando viene (en POST sigue obligatoria); el hash cubre body y parámetros de la ruta. El frontend no cambia.
- **Modelo:** `users` (email único global, argon2id), `roles` + `role_permissions` (10 módulos × 7 acciones; 4 roles iniciales), `user_branches`, `refresh_tokens` (solo el hash, por familia) y `login_attempts`. RLS forzado y FK compuestas. La FK de `user_id` en `idempotency_keys` y `audit_log` es `NOT VALID`, y un usuario auditado no se borra. Sin tenant, `users` y `refresh_tokens` solo se leen por dos funciones `SECURITY DEFINER`.
- **Auth:** `POST /auth/login` (web: cookie HttpOnly/Secure/Strict, `Path=/auth/refresh`; native: 501), `/auth/refresh` (`X-Requested-With`, rotación, reuso que revoca la familia), `/auth/logout` y `GET /auth/session`. El JWT es HS256 de 15 min, y `JWT_SECRET` vive solo en `BackEnd/.env`. El mismo 401 vale para los tres fallos y para el bloqueo (5 fallos → 15 min).
- **Guard:** global, llama a `bindActor` y valida el permiso por endpoint (403) y el `branchId` habilitado (403). **La app no arranca con una ruta sin política.**
- **Gestión:** `/users`, `/roles`, `/roles/{id}/permissions` y `/branches`, con schemas en `packages/contracts`.
- **Seed:** `db:seed-dev`, solo contra `sdgpd`. Crea 2 empresas (A con las 4 sucursales del mock) y un admin por empresa. Las credenciales quedan solo en `BackEnd/.env` (`SEED_*`).
- **Tests:** 165 del backend en 12 archivos (eran 86) y 27 de `contracts` (eran 18).
- **Checklist sin ejecutar:** `BackEnd/docs/verificaciones/VERIFICACION_BE-1a.md` (curl contra el backend con el seed).
- ~~**Abierto (MEDIO):** el `payload_hash` de idempotencia de `POST /users` incluye la contraseña inicial.~~ **Cerrado en BE-1b** (HMAC con `IDEMPOTENCY_HMAC_KEY`).
- **Pendiente sin tanda:** alta de empresas nuevas en producción (necesita su propio ADR).
- **Siguió: BE-1b (hecha, ver arriba).** Login, logout, guard de rutas, `useSessionStore` contra `/auth/session`, `TabUsersRoles`, eliminar `USER_ROLE`, sumar `FrontEnd` a los workspaces y probar la rama de fallo de v13. Riesgos a resolver ahí: el `Path` de la cookie frente al proxy `/api`, y un solo refresh en vuelo.

## Tanda 25 — centinela de viajes y gate intermitente (2026-10-09, `sesion-centinela-trip-2026-10-09`)

Detalle en `docs/historial/reportes/REPORTE_2026-10-09_tanda25.md`. Checklist sin ejecutar: `VERIFICACION_TANDA_25.md`.

- **PENDIENTES #23, cerrado (opción b, sin cambiar firmas):** la consulta de posición vive en `TripLivePosition` (`TripDetailPanel.tsx`), con `tripId: TripId` obligatorio, montado con la misma condición que el `enabled` anterior. El centinela `'' as Trip['id']` no existe más. La query key y el intervalo (12 s) son idénticos, verificado con la `pagedQueryKey` real.
- **ESLint:** `no-restricted-syntax` marca también `x as <Entidad>['id']` (clave `id` o `*Id`, directo y en unión). La prueba con un cast temporal da exit 1. ADR-006 lo nombra.
- **`v13-tanda11-integrity.mjs`:** `process.exit(n)` final → `process.exitCode = n` (excepción autorizada a la regla 2.5). Dio 20/20 exit 0, sin el assert `UV_HANDLE_CLOSING` (antes 4/12). **Otros 11 scripts** tienen el mismo patrón (loader + `process.exit` al final) y no se tocaron: los 3 smoke con loader (`avance-2026-09-30-lotes`, `tanda-15`, `tanda-24`) y los 8 `v*` restantes.
- **PENDIENTES #24 nuevo (Baja):** el rango de un preset fijo queda memoizado entre días.
- **Scripts del frontend:** 28, todos en exit 0.

## Tandas 23/24 — dinero y rango de fechas (2026-10-09, `sesion-dinero-fechas-2026-10-09`)

Detalle en `docs/historial/reportes/REPORTE_2026-10-09_tandas23-24.md`. Checklists sin ejecutar: `VERIFICACION_TANDA_23.md` y `VERIFICACION_TANDA_24.md`.

- **Tanda 23, dinero** (`shared/utils/money.ts`, ADR-008 enmienda 2026-10-09):
  - `Money` admite negativos.
  - `money()` redondea simétrico: la mitad se aleja del cero.
  - `moneyFromNumber` desplaza la coma en base 10 y lanza si el valor no es finito.
  - `parseMoneyInput` valida el string y delega.
  - Los totales del tablero quedaron idénticos antes y después (verificado con la función real contra el mock).
  - También se borró el re-export sin uso `toISODateString`.
- **Tanda 23, punto 23.2: NO HECHO (parada).** Para sacar el centinela `'' as Trip['id']` (`TripDetailPanel.tsx:119`) hay que cambiar la firma de `getTripPosition`. La extensión de la regla de ESLint a casts por tipo indexado se probó (marca exactamente esa línea) y se revirtió. Ver PENDIENTES #23. **Cerrado en la Tanda 25** (opción b: subcomponente `TripLivePosition`). La regla ya ve `as X['id']`.
- **Tanda 24, rango de fechas** (PROTOCOLO 3.8, enmienda 2026-10-09):
  - `readDateRangeFromUrl`/`dateRangeToUrlParams` (`dateRangePresets.ts`) son el único lugar que lee y escribe `preset`/`from`/`to`, y los usan los 5 listados con `DateRangeFilter`.
  - Con un preset fijo, el rango se calcula al renderizar y `from`/`to` van solo con `custom`.
  - Corrige 5 celdas de la auditoría: "Este mes" sin fechas no filtraba en Compras/Clientes, un link viejo filtraba por otro mes con la etiqueta del actual, y `from`/`to` sin preset mostraban "Hoy"/"Todos".
  - `OrdersPage` queda afuera: no tiene presets.
- **PENDIENTES:**
  - #22: respuestas de `httpClient` de logística, vehículos y choferes sin validar.
  - #23: el centinela de `TripDetailPanel`.
- **Scripts del frontend:** 28 (19 smoke + 9 verificación), todos en exit 0.
- **Corrección de la Tanda 22:** el exit 127 intermitente de `v13-tanda11-integrity.mjs` **no** es un fallo del shell. Es un crash de Node/libuv en Windows al salir (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c:94`), después de que los 24 checks pasan. Apareció en 4 de 12 corridas aisladas. No se tocó el script (regla 2.5).

## Tanda 22 — Gate 5 y huérfanos (2026-10-09, `sesion-gate5-huerfanos-2026-10-09`)

Cierra la reverificación de los 23 exports huérfanos del piloto de Graphify con las decisiones de Leandro. Detalle en `docs/historial/reportes/REPORTE_2026-10-09_tanda22.md`; checklist en `docs/historial/verificaciones/VERIFICACION_TANDA_22.md` (sin ejecutar).

- **ESLint:** `no-restricted-syntax` prohíbe `as <Tipo>Id` fuera de `ids.types.ts` (ADR-006, enmienda 2026-10-09). La regla quedó en `error` para las dos familias (zustand e IDs).
- **Conectados:**
  - `isVehicleId`/`isDriverId` en `TripsPage` (los filtros de la URL ya no se castean).
  - `defaultDateRangeValue` en `LogisticsPage`.
- **Borrado:** `SkeletonCard` y `.skeleton-card`.
- **Corregido:** `parseMoneyInput` redondeaba mal la mitad exacta (`"1.005"` → 100 centavos) y aceptaba `"Infinity"`.
- **Regla nueva del Gate 5** (PROTOCOLO §5): cuenta como call-site real un uso externo que llega a la UI, o un uso interno desde una función que lo cumple. Con esa regla, los únicos huérfanos de `shared/` y `modules/*/api` son `sumMoney`/`multiplyMoney`/`parseMoneyInput`, registrados en PENDIENTES #21.
- **Puntos ciegos de la regla, documentados y no corregidos:**
  - `'' as Trip['id']` en `TripDetailPanel.tsx:119`: un tipo indexado que el selector no ve.
  - Las respuestas de `httpClient.request<T>` de logística, vehículos y choferes, tipadas como dominio con ids branded sin validar.
- **Scripts del frontend:** son 27 (18 smoke + 9 verificación), no 32 como decía la sección de BE-0b. Los 27 dan exit 0.
- **Piloto de Graphify (misma fecha):** veredicto USO LIMITADO (solo mapa visual), no forma parte del flujo de trabajo. Ver `docs/historial/reportes/REPORTE_2026-10-09_piloto-graphify.md`.

## Backend — BE-0b hecha (2026-10-09, `sesion-be0b-2026-10-08`)

La infraestructura de mutaciones que usan todos los módulos, más su arrastre en el frontend. Sigue sin endpoints de negocio y sin autenticación (BE-1). El detalle está en `docs/historial/reportes/REPORTE_2026-10-09.md`, la estructura en `BackEnd/docs/ARQUITECTURA.md` y las sub-decisiones nuevas en ADR-BE-004 (9-12), ADR-BE-005 (9-13) y ADR-BE-006 (8).

- **Backend:**
  - `CommandInterceptor` global: toda mutación fuera de `/auth/*` es una transacción con el tenant del actor, y todo POST exige `Idempotency-Key` (UUID), registrada en la misma transacción: replay, 422 con otro payload, una sola ejecución con requests concurrentes y TTL de 48 h con limpieza por `setInterval` y advisory lock.
  - `CommandTx`: escrituras siempre auditadas en `audit_log` (append-only, sin UPDATE ni DELETE para la aplicación), `version` con 409 `version-conflict` y `details.currentVersion`, y `nextNumber` (`PED-000001`…).
  - Paginación offset y cursor, con listas blancas en `contracts` (400 `invalid-query`).
  - El actor se fija solo con `bindActor`, que en BE-0b no llama nada de `src/`.
- **Frontend:**
  - `httpClient` lee el cuerpo de error (`ApiError.serverCode`/`details`) y manda `Idempotency-Key`.
  - Las mutaciones se reintentan **solo si llevan clave**: logística, vehículos y choferes sí; pedidos, clientes, proveedores, productos, caja, compras, alertas, usuarios y `updateStopOrder` ya no se reintentan ante un 5xx o un timeout.
  - Los ids aceptan UUID o el prefijo legado.
  - La lógica de `httpClient` vive en `httpClientCore.ts`.
- **Tests:** 86 del backend y 18 de `contracts` (eran 39 y 12). Hay 32 scripts del frontend en verde, incluido el smoke nuevo `be-0b.smoke.mjs`.
- **Checklist sin ejecutar:** `FrontEnd/docs/historial/verificaciones/VERIFICACION_BE-0b.md` (modo mock, sin cambios visibles esperados).
- ~~**Abierto, a resolver antes de BE-2:** ADR-BE-005, objeción 3.~~ **Resuelta en el Paso 0 de BE-1a** (el backend honra la clave en PUT/PATCH/DELETE).
- **Riesgo residual documentado:** la auditoría obligatoria se garantiza por la API tipada y por lint (V2). SQL crudo dentro de `src/db/`, o una reflexión ofuscada que el lint no ve, quedan a la revisión de código.
- **Siguió:** BE-1a (hecha), que agregó la FK de `user_id` y llama a `bindActor` desde la autenticación.

## Backend — BE-0a hecha (2026-10-08, `sesion-be0a-2026-10-08`)

La base del backend, sin endpoints de negocio y sin autenticación. Detalle en `docs/historial/reportes/REPORTE_2026-10-08.md`, estructura en `BackEnd/docs/ARQUITECTURA.md` y entorno en `BackEnd/docs/SETUP_SUPABASE.md`.

- **Monorepo:** `package.json` raíz con los workspaces `packages/*` y `BackEnd`, y el lockfile en la raíz. **`FrontEnd` todavía no es un workspace**: `FrontEnd/package.json` y `FrontEnd/package-lock.json` no cambiaron, y su `npm ci` se sigue corriendo en `FrontEnd/`.
- **`packages/contracts`:** id, cuerpo de error, envoltorios offset y cursor, fecha, instante, dinero y `/health`. Un cambio que rompe al backend falla en su typecheck sin compilar nada (verificado).
- **Backend:** NestJS 12 con config validada con Zod, filtro global de errores, `ZodValidationPipe`, `X-Request-Id` y `GET /health` (el único endpoint).
- **Base:** Supabase como Postgres 17.11, por el session pooler (el host directo es solo IPv6), con SSL verificado. Roles `sdgpd_migrator`, `sdgpd_app` y `sdgpd_app_test`; schemas `sdgpd` y `sdgpd_test`, con las mismas migraciones. `companies` y `branches` con RLS forzado, y `withTenant` con `set_config(..., true)`. UUID v7 generados por la aplicación.
- **Tests:** 39 del backend y 12 de `contracts`, incluidas la suite de catálogo (cubre sola cualquier tabla futura) y la funcional de aislamiento, que falla si una tabla con RLS no tiene caso.
- **Checklist sin ejecutar:** `BackEnd/docs/verificaciones/VERIFICACION_BE-0a.md` (lo corre Leandro).
- **Sigue:** BE-0b, hecha el 2026-10-09 (sección anterior).
- **Deuda abierta de BE-0a:** las FK que genera `drizzle-kit` traen `"public".` y hay que sacarlo a mano (si se olvida, el runner rechaza la migración). Express manda `X-Powered-By`. `companies.timezone` no se valida contra IANA hasta BE-1. Smart App Control impide usar `@swc/core` en la máquina de desarrollo.

## ADRs de backend (cerrados el 2026-10-08) — las 26 decisiones de la auditoría, tomadas y documentadas

**Punto de entrada para empezar el backend: `BackEnd/docs/README.md`.** Ahí están los 11 ADRs (`BackEnd/docs/adr/ADR-BE-001..011`), la trazabilidad de las 26 decisiones de `08_DECISIONES_ABIERTAS.md` (cada una en un solo ADR), la tabla de los 8 BLOQUEANTE y 21 ALTO (cada uno con su ADR o tanda), y el plan de tandas BE-0 a BE-10 con el trabajo de frontend que arrastra cada una. **`BackEnd/` ya tiene código desde BE-0a** (sección siguiente).

- **`.gitignore`:** sin la regla `BackEnd/`, que ignoraba toda carpeta `backend/` (A18, cerrado). Reglas de monorepo para `node_modules`/`dist` y `.env` (salvo `.env.example`).
- **Protocolo:** cambiaron §1 (el backend existe en `BackEnd/`, nuevos alcances), 2.3 (tests prohibidos solo en `FrontEnd/`), 3.1 (offset con tope 100 para maestros, cursor para append-only) y 3.5 (ningún request lleva `empresaId`).
- **Enmiendas:**
  - 11 ADRs del frontend tienen una sección "Enmienda 2026-10-07": 004, 006, 007, 008, 009, 010, 011, 013, 014, 015 y 016.
  - En el Documento 04 hay 7 RF con la línea "Enmendado por": RF-PED-002, RF-PRE-001..004, RF-CMP-002 y RF-ENT-002.
### Cierre del 2026-10-08 — ya no hay nada pendiente de revisión

**Las 74 sub-decisiones quedaron aprobadas** (una corrección: **Node 24 LTS** en lugar de Node 22) y **las 23 objeciones quedaron resueltas**, cada una con su "Resolución (2026-10-08)" debajo del texto original, que se conserva como historia. La tabla "Objeciones: las 23 y dónde quedó cada resolución" de `BackEnd/docs/README.md` es el índice. **Ninguna objeción bloquea ya el plan.**

Lo que las resoluciones cambiaron, y que hay que tener presente al implementar:

- **Dependencias:** la regla 2.2 del protocolo quedó acotada a `FrontEnd/`. En `BackEnd/` y `packages/` se instalan solo las que liste la consigna de la tanda; cualquier otra es condición de parada. D8 se reescribió en consecuencia (el lockfile solo cambia en una tanda que las autorice).
- **`Delivery` pasa a tener líneas** (`orderLineId` + cantidad despachada, fijadas al crear la entrega, validadas con `SELECT … FOR UPDATE` sobre las líneas del pedido). De ahí salen la baja física al despachar y los **dos pendientes** del pedido: de despachar y de entregar.
- **La reserva de stock vive siempre en la sucursal desde la que sale la mercadería**, y se traslada en la misma transacción si la entrega sale de otra.
- **Listas de precios:** entidad de alcance EMPRESA, un porcentaje sobre el precio base en BE-0..10. El pedido manda `priceListId` y el servidor resuelve el precio.
- **Facturación** dejó de estar fuera del plan: necesita su propio ADR y es **prerrequisito de BE-9**. Hasta entonces, los pedidos en cuenta corriente no generan deuda, y eso quedó aceptado porque no hay nada en producción.
- **Storage:** interfaz única de archivos, disco local en desarrollo y object storage S3-compatible en producción **desde BE-7**. Los archivos no se guardan en Postgres. El principio "Postgres es la única infraestructura obligatoria" ahora dice hasta cuándo vale: hasta BE-6 inclusive.
- **Tablero:** ADR-009 se extiende a 4 endpoints nuevos (`/dashboard/kpis`, `/sales-series`, `/top-products`, `/recent-orders`) y ahí recién se retira `fetchDashboardData`.
- **Otros cierres:** `/auth/*` exento de idempotencia; el login declara el tipo de cliente (web → cookie, nativa → refresh en el body); ningún valor de enum es texto de display (`ClientAccount.status` → `al-dia`/`con-deuda`, `allowedTransitions[].motivo` → `motivoCode`); "en preparación" es derivado y no hay acción manual para ponerlo; el límite de crédito se controla al confirmar el pedido contra saldo + pedidos sin facturar.

**Dos objeciones nuevas**, aparecidas al aplicar las resoluciones, **resueltas en el Paso 0 de la sesión BE-0a (2026-10-08)**: §1 del protocolo ya incluye "listas de precios", y la referencia al §3 de ADR-010 quedó verificada. Texto original:

- **ADR-BE-002, objeción 3:** el alcance EMPRESA ganó "listas de precios", pero la enumeración de `PROTOCOLO.md` §1 no la incluye, porque §1 estaba fuera del alcance de la sesión de cierre. La tabla de ADR-BE-002 es la fuente de verdad hasta que una sesión con §1 en alcance lo sincronice.
- **ADR-BE-004, objeción 3:** la consigna ubicaba `allowedTransitions` en el §1 de ADR-010 y está en el §3. La enmienda se escribió contra §3. Diferencia de referencia, no de contenido.

**Dos archivos habían quedado desactualizados a propósito** (fuera del alcance de la sesión de cierre): `BackEnd/CLAUDE.md`, sincronizado en el Paso 0 de BE-0a (el límite de BE-6 y las objeciones ya resueltas), y `FrontEnd/CLAUDE.md` (lockfile y comandos), que se actualiza en la tanda que sume `FrontEnd` a los workspaces.

## Auditoría de backend (2026-10-07, solo lectura) — punto de entrada para la fase de ADRs de backend

**`docs/historial/auditorias/backend/00_RESUMEN.md` alcanza solo para arrancar.** El detalle con evidencia está en los archivos `01` a `08` de la misma carpeta. No se tocó código, y no se tomó ninguna decisión: la regla 2.9 no aplicó en esta sesión.

- **Qué hay:** 91 llamadas a `httpClient` (no 88: 3 están partidas en dos líneas), 25 entidades, 72 reglas de negocio del mock, 26 decisiones abiertas (9 bloqueantes).
- **Cobertura del Doc 04:** de los 83 RF, 2 tienen contrato completo, 37 parcial y **44 ninguno** (29 de ellos son MVP).
- **Hallazgos:** **8 BLOQUEANTE, 21 ALTO**, 20 MEDIO, 5 BAJO.
- **Bloqueantes:**
  - Tenancy: D1 prohíbe mandar `empresaId` y 87 llamadas lo mandan.
  - No hay autenticación.
  - La exportación de ADR-004 no tiene contrato HTTP.
  - El wire no está definido: 59 de 91 respuestas devuelven el tipo de dominio del frontend.
  - Cumplimiento parcial: ADR-001/Doc 03 contra el sub-pedido de Doc 04.
  - Dos mecanismos de rechazo, y el body de error se descarta en modo `http`.
  - Nada mueve stock.
  - Formato de ids.
- **Hallazgo de proceso:** `.gitignore:10` (`BackEnd/`) ignora **toda** carpeta `backend/` en cualquier nivel por `core.ignorecase=true`, incluida la de esta auditoría (se agregó con `git add -f`). No se corrigió (consigna); es la decisión #26.
- **Siguiente paso:** resolver las 9 decisiones bloqueantes de `08_DECISIONES_ABIERTAS.md` como ADRs, en el orden de tandas BE-0 a BE-10 que propone el resumen.

## Tandas 20/21 — qué resolvieron y qué no (2026-10-07b)

Cierran `PENDIENTES.md` ítem 19. **(1)** Tanda 20: las 5 líneas de `orders.data.ts` con SKU inexistente apuntan ahora a `YER-MAT-1K`/`GAL-AGU-200`. Cambian solo `sku`/`name`; precio y totales intactos. **(2)** Tanda 21: `createOrder` rechaza un SKU que no está en el catálogo con `reason: 'product-not-found'` (antes lo persistía en silencio, demostrado corriendo el V17 nuevo contra el código previo). **Todos los scripts de `scripts/smoke/` y `scripts/verificacion/` (26) dan exit 0.** Es la primera vez desde que existe V17 que ninguno está en rojo, así que un rojo vuelve a significar algo. Quedó afuera, documentado en `PENDIENTES.md` ítem 20: el mismo dato huérfano en `analytics.data.ts`, `alerts.data.ts` y `suppliers.data.ts`.

## Tandas 17/18/19 — qué resolvieron y qué no (2026-10-07)

Dos tareas de Leandro. **(1)** Cierra la migración a medias de la Tanda 16: `ClientAccount.isActive` se guardaba pero nadie lo leía. Ahora el selector de `CreateOrderModal` filtra a clientes activos con un predicado único (`shared/utils/orderEligibility.ts`). `createOrder` valida el cliente server-side (`getClientById`, 1 registro) y devuelve `CreateOrderResult` con `reason` (`inactive-client`/`client-not-found`; los 2 `throw` de la Tanda 14 pasaron al mismo mecanismo y el toast ahora muestra el motivo real). Guardar un cliente invalida `'clients-catalog'`: antes la baja tardaba hasta 5 minutos en llegar al selector. El Directorio y su export muestran "Activo"/"Inactivo". Ver **ADR-015**. **(2)** La deuda de la Tanda 14 (`fetchProducts` completo dentro de 4 operaciones server-side) se documentó en **ADR-016** con el contrato objetivo. El mock no se reescribió.

**Booleanos de las Tandas 14-16 sin consumidor:** `deliveryAddressSameAsFiscal` (+ `deliveryAddress`/`deliveryReferences`) **sigue sin consumidor**: el pedido sale con la dirección fiscal. Es una decisión de producto, ver `PENDIENTES.md` 16/17. **Fase D:** `v17-clientes-inactivos.mjs` corre `createOrder` real contra el mock (10/10 OK). En su momento, su check D2.3 fallaba por 5 líneas del seed con SKU inexistente; se corrigió en la Tanda 20. Bundle: carga inicial +4 B.

## Sesión avance-2026-09-30 — qué resolvió y qué no

Seis tareas pedidas. **3 ya estaban resueltas en `lean`** y no se reimplementaron, solo se re-verificaron con evidencia: Editar proveedor (Tanda 12), Reposición a `api/` con paginación y `empresaId`+`branchId` (Tanda 3f; el filtro client-side de `InventoryPage` de AUDITORIA_ESCALABILIDAD B3 ya no existe) y code-splitting + boundary por ruta (Tanda 10A). Lo que sí se hizo:

- **`docs/VERIFICACION_PENDIENTE_UNIFICADA.md`**: 42 puntos de verificación en navegador, deduplicados de 13 checklists y ordenados por riesgo. **Es el punto de entrada para verificar en el navegador**; los originales siguen en `historial/verificaciones/`.
- **PENDIENTES #13 cerrado por código:** `updateProduct` conserva los lotes al editar (`mergeProductUpdate`, `shared/api/products/productUpdate.ts`). Sin verificar en navegador (`VERIFICACION_2026-09-30_T2_lotes.md`).
- **Residual de 3f:** "Generar OC" en Reposición resuelve producto y proveedor por `Map` en vez de `.find()` doble (`TabPurchases.tsx`).
- **Auditoría (sin implementar)** `docs/historial/auditorias/AUDIT_2026-09-30_iam.md`: no hay login/logout/guard; `SessionUser` no tiene rol; la matriz de permisos de Settings se edita pero **nadie la lee** (sin enforcement); hay un rol fijo `USER_ROLE='ADMIN'` en `InventoryPage.tsx:69`; la campanita funciona sobre un seed estático, sin generación de alertas ni leído por usuario. Deja 5 preguntas de producto abiertas.
- **Bundle:** carga inicial 347.246 B (6 archivos), sin cambios en la sesión; JS total +175 B.

## Tandas 14/15/16 — qué resolvieron y qué no (2026-09-11)

Tres tareas independientes, reportadas directamente por Leandro. **(1)** Tanda 14 cierra una migración a medias de Tanda 12: `deleteProduct` daba de baja lógica un producto (`status: 'inactive'`) pero nada más en el proyecto lo excluía — ahora los selectores de `CreateOrderModal`/`PurchaseOrderFormModal` filtran a activos, `createOrder`/`createPurchaseOrder`/`generatePurchaseOrderFromSuggestion` rechazan server-side, y Bajo Stock Mínimo/Sugerencias de Reposición (listado + KPI) excluyen inactivos — Stock Actual queda sin cambios a propósito (sigue siendo una foto literal del inventario). **(2)** Tanda 15 corrige un hallazgo MEDIO: 4 funciones (`markStopNoVisitada`, `reprogramDelivery`, `registrarEntrega`, `createDelivery`) evaluaban sus precondiciones ANTES de `withIdempotency`, así que un reintento con la misma clave después de un éxito podía devolver un rechazo nuevo en vez del resultado original cacheado (viola ADR-010 sección 4) — movidas adentro, revisados los 15 usos de `withIdempotency` del proyecto, los otros 11 ya estaban bien. **(3)** Tanda 16 cierra `PENDIENTES.md` ítem 15: los otros 10 campos fantasma de `CreateClientModal` (no 9, corrección de conteo) se conectaron de punta a punta, mismo criterio que `priceList`/`saleCondition` en Tanda 12.

Quedó explícitamente fuera de alcance (documentado en cada `VERIFICACION_TANDA_{14,15,16}.md`): ningún indicador visual de `isActive` en los listados de clientes (Tanda 16); el escenario real de reintento de red que motivó Tanda 15 no es reproducible en este mock (mock y cliente son el mismo proceso); verificación en navegador de las 3 tandas (nunca se abrió un navegador esta sesión).

## Tanda 13 — qué resolvió y qué no (enmienda ADR-013)

Dos tareas nuevas, reportadas directamente por Leandro (no por auditoría propia): **(1)** HALLAZGO ALTO en `markStopNoVisitada` (`trips.service.ts`) — la función no validaba nada antes de reprogramar: se podía ejecutar sobre una Parada ya `'Visitada'` (con POD registrado) o sobre un viaje `'Planificado'`/`'Rendido'`/`'Cancelado'`, y devolvía `success: true` marcando `Stop.estado = 'NoVisitada'` aunque **todas** las reprogramaciones de sus entregas hubieran fallado. Corregido con 4 precondiciones server-side compartidas con el chequeo client-side de `TripDetailPanel.tsx` (predicado único `getStopNoVisitadaBlockReason`, `shared/utils/stopVisitEligibility.ts`: viaje `'Despachado'`/`'EnTransito'`, Parada `'Pendiente'`, con entregas, ninguna en estado terminal) + un chequeo todo-o-nada después del loop de reprogramación (`'reprogram-failed'`: si cualquier entrega falla, la Parada NO se marca `NoVisitada`, pero las entregas que sí tuvieron éxito no se revierten — no hay transacción real en este mock). **(2)** `ReprogramacionEvent` gana `tripId?`/`stopId?` opcionales, poblados solo cuando la reprogramación nace de `markStopNoVisitada` — permite reconstruir desde el historial de una `Delivery` que un intento de reprogramación vino de tratar de marcar una Parada como no visitada, incluso si ese intento terminó fallando para el conjunto.

**Nota de proceso:** las otras 5 tareas del pedido original de esta sesión (`cancelOrder` server-side, `deleteProduct` baja lógica, `CreateClientModal` persiste campos, CUIT único + botón Editar en proveedores, `isExpiringSoon` sin `Math.abs`) ya estaban resueltas de la sesión anterior (Tanda 12) — verificado contra el código real antes de arrancar, no se tocaron de nuevo.

Ver `docs/adr/ADR-013-reprogramar-no-entrega.md` (sección "Enmienda 2026-09-11") para el detalle de diseño completo, y `docs/historial/verificaciones/VERIFICACION_TANDA_13.md` para el checklist de navegador.

## Tanda 12 — qué resolvió y qué no

Seis tareas: **(1)** `cancelOrder` rechaza `delivered`/`invoiced`/`cancelled` server-side (`orders.service.ts`, reason `invalid-status-for-cancel`) — antes esa regla vivía SOLO en `OrderDetailPanel.tsx#canCancel` (cliente), el service la ignoraba; **(2)** `deleteProduct` pasa a baja lógica (`estado: 'inactive'`, sin borrar del store) — `TabStockCurrent.tsx` ya pintaba un badge ACTIVO/INACTIVO por fila desde antes, no hizo falta agregar nada ahí; **(3)** `CreateClientModal` persiste `priceList`/`saleCondition` (decisión: persistir, no quitar — ya tenían UI real en `ClientCommercialTab`); **(4)** CUIT único server-side en `createSupplier`/`updateSupplier` (normaliza solo para comparar, no lo guardado); **(5)** botón Editar en el panel de detalle de proveedores (`docs/PENDIENTES.md` ítem 1, cerrado); **(6)** `isExpiringSoon` corregido — usaba `Math.abs()`, así que un lote vencido hacía 1-29 días también contaba como "próximo a vencer" (quedaba enmascarado por el orden de los `if` en el único call-site, pero la función en sí estaba mal); extraída a `shared/utils/lotExpiration.ts` para poder testearse con un smoke script puro.

**Nota de proceso:** las 3 primeras tareas del pedido original de esta sesión (`reprogramDelivery` libera la Parada, número de pedido correlativo, patente única) ya estaban resueltas de la sesión anterior (Tanda 11) — verificado contra el código real antes de arrancar, no se tocaron de nuevo.

**Hallazgo nuevo, documentado no resuelto:** `docs/PENDIENTES.md` ítem 15 — `CreateClientModal` tiene otros 9 campos "fantasma" (capturados en la UI, descartados en silencio al guardar) además de los 2 que se conectaron esta tanda — fuera de alcance de lo pedido explícitamente.

## Tanda 11 — qué resolvió y qué no (ADR-013/ADR-014)

Cinco tareas independientes: **(1)** `reprogramDelivery` ahora libera la entrega de cualquier `Stop.deliveryIds` que la tuviera asignada (`releaseDeliveryFromTrip`, `trips.service.ts` — nueva dependencia de import `deliveries.service.ts → trips.service.ts`, sumada a la que ya existía en sentido contrario desde Tanda 10B, mismo patrón ya aceptado en Tanda 9 para `orders↔deliveries`) — antes quedaba "fantasma" en el viaje pese a tener fecha/estado nuevos; **(2)** número de pedido correlativo por empresa, formato `PED-XXXXXX` (6 dígitos, antes 5 dígitos de `Date.now()` sin correlativo ni garantía de unicidad real — ver ADR-014); **(3)** patente única por empresa normalizada (mayúsculas + sin espacios) en `createVehicle`/`updateVehicle`; **(4)** botón de override de capacidad en `CreateTripModal` (el servicio ya lo soportaba desde Tanda 10B — deuda explícita de esa tanda, ahora cerrada); **(5)** catálogos `reprogramacion`/`no-entrega` sembrados y conectados — `ReprogramarModal` pasa de texto libre a dropdown contra el catálogo real, y nuevo `NoEntregaModal.tsx` (por Parada, no por entrega aislada — ADR-010 modela la Parada como "una visita física") conecta `'no-entrega'`.

**Hallazgo de Fase D corregido antes del merge:** `CreateTripModal.tsx` casteaba `e.target.value as VehicleId`/`as DriverId` sin pasar por los constructores validados (preexistía desde Tanda 10B, encontrado al re-tocar el archivo) — reemplazado por `asVehicleId`/`asDriverId` (ADR-006).

Quedó explícitamente fuera de alcance (documentado en `VERIFICACION_TANDA_11.md`): multi-empresa real del correlativo de pedidos (el mock sigue siendo de una sola empresa), campo de motivo propio en `Stop` para "no visitada" (decisión explícita de ADR-013: el motivo real vive en `Delivery.reprogramaciones`, no se duplica).

## Tanda 10B — qué resolvió y qué no (ADR-011)

Resolvió: ABM de vehículos/choferes (alcance EMPRESA, decisión sin ADR propio — ver `vehicle.types.ts`), viajes con paradas multi-pedido (alcance SUCURSAL), `createTrip` + `assignDeliveriesToStop` separados a propósito (la asignación real, con techo/capacidad/concurrencia, pasa SIEMPRE por `assignDeliveriesToStop`, nunca precargada en el alta), techo `MAX_TRIP_ASSIGNMENT = 100` (servicio y UI), capacidad server-side con override auditado (`Trip.overrides` — botón de override conectado en Tanda 11), concurrencia con 409 granular por `version` + por entrega individual, máquina de estados del viaje (`tripStatus.types.ts`, mismo patrón que `deliveryStatus.types.ts`), reordenar paradas sin optimizador (botones ↑/↓, sin drag-and-drop — hubiera exigido una dependencia nueva, prohibida), posición del viaje como "página de 1 elemento" reusando `useLiveQuery` con intervalo configurable (enmienda 2026-09-09 de ADR-003, 12s en vez de los 30s por defecto), recorrido histórico bajo demanda (`getTripRoute`, sintético — no hay traza GPS real que decimar en este mock), POD con firma por canvas (props sintéticos de React, sin `addEventListener` manual) + alternativa de imagen, `withIdempotency` extraído a `shared/utils/idempotency.ts` (compartido por `deliveries`/`vehicles`/`drivers`/`trips`), y conecta `requiereEvidencia`/`disparaLogisticaInversa` (declarados en Tanda 9 sin consumidor de comportamiento — `cantidadEnTransitoDeRetorno` se agregó a `DeliveryNoteLine`, faltaba pese a que el ADR la daba por existente).

**Hallazgos de Fase C corregidos antes del merge (ver `VERIFICACION_TANDA_10B.md` para el detalle):** `branchId`/`empresaId` fuera de `filters` en `getTripsPage`/`getVehiclesPage`/`getDriversPage` (rompía la query key de TanStack Query — cambiar de sucursal servía datos viejos del caché); `registerPod` reportaba éxito sin aclarar si la Delivery se pudo finalizar (ahora `deliveryFinalized: boolean` en el resultado); `getTripById`/`getTripRoute`/`getPodForDelivery` quedaban exportados sin call-site real (conectados a `TripDetailPanel.tsx`).

Quedó explícitamente fuera de alcance (documentado en `VERIFICACION_TANDA_10B.md`): modo `filtro` de `assignDeliveriesToStop` sin UI (solo `modo:'lista'` conectado), `confirmarRecepcionDevolucion` (ADR-010 sección 6), documentos impresos (ADR-011 sección 7).

## Tanda 9 — qué resolvió y qué no (AUDIT_15_LOGISTICA.md)

Resolvió, del modelo y circuito de datos solamente (vehículos/choferes/viajes/asignación/mapas/POD son la tanda siguiente, ADR-011): alta de `Delivery` desde un pedido (A15#1, antes inexistente), los 3 ejes comercial/logístico/financiero con migración incremental sin romper `status` legado (A15#2), idempotencia en `transitionDelivery`/`reprogramDelivery`/`registrarEntrega`/`createDelivery` (A15#5, con 2 bugs propios corregidos en una sesión de recuperación), `DeliveryNoteId`/`DeliveryHistoryEventId` tipados (A15#13), catálogo de motivos con `requiereEvidencia`/`disparaLogisticaInversa` (declarados en el tipo y en el mock, sin consumidor de comportamiento todavía — hallazgo de Fase 3, no bloqueante), `allowedTransitions` server-side en el contrato de lectura.

**A15#3 (sincronización pedido↔entrega) — CERRADO.** El diseño (derivar siempre, nunca copiar el estado) cierra la clase de bug que la migración a medias temía. La Fase 3 encontró y corrigió DOS caminos reales donde igual divergían pese al diseño: `registrarEntrega` reportaba éxito sin esperar la propagación al pedido (sesión de recuperación), y `cancelOrder` no chequeaba si el pedido tenía una `Delivery` activa antes de cancelar (fix en una sesión posterior — ahora `cancelOrder` devuelve `reason:'has-active-deliveries'` y no cancela; `OrderDetailPanel.tsx#canCancel` oculta el botón para el mismo caso, con guard fail-closed también si el fetch de entregas está cargando o falló). Alcance del segundo fix, deliberadamente chico: bloquea cancelar, no cancela las entregas en cascada — esa decisión de producto sigue sin ADR y sin tomar.

Quedó explícitamente fuera de alcance (documentado en ADR-010/011 y en `VERIFICACION_TANDA_9.md`): reverse logística completa (movimiento de stock), POD, vocabulario real de 11 estados de Parada, migración de `OrdersPage`/exports al eje `comercial`, cascada automática de cancelación pedido→entregas.

## Hallazgos ALTO de `docs/historial/auditorias/` — reverificados hoy contra el código, siguen abiertos

- **`analytics` sigue sin ninguna capa de service ni paginación** (AUDIT_2 #4, AUDIT_3 #2) — `AnalyticsPage.tsx` sigue leyendo `ANALYTICS_DATA[period]` síncrono. Verificado: `find src/modules/analytics -maxdepth 1 -type d` → solo `components/`, sin `api/`.
- **Dinero sigue en `number` flotante fuera del dashboard** (AUDIT_10 #1) — el módulo `Money`/centavos (ADR-008) tiene 3 consumidores, los 3 en `modules/dashboard/`. Verificado: `grep -rl "from '@/shared/utils/money'" src` → 3 resultados, todos `dashboard`.
- **Impuesto sin redondeo de negocio** (AUDIT_10 #2) — `OrderTotalsSection.tsx:18`, `tax = (subtotal - discount) * taxRate` sigue igual, sin `Math.round`.
- **Solo 4 formularios usan Zod** (AUDIT_9 #1, mejoró de 2 a 4 en Tanda 10B) — `grep -rl "zodResolver(" src` → `ProductFormModal.tsx`, `PurchaseOrderFormModal.tsx`, `VehicleFormModal.tsx`, `DriverFormModal.tsx`. `SupplierFormModal`/`CreateClientModal`/`NewTransactionModal` siguen sin schema.

## Hallazgos ALTO ya resueltos (verificados, no listar como pendientes)

`CreateOrderModal` con fecha UTC en vez de local (AUDIT_11 #1, fix en `97f9643`) · estado de listados fuera de la URL (AUDIT_13 #1, Tanda 4) · `Order` resuelto por nombre en vez de `clientId` tipado (AUDIT_4 #1, Tanda 5) · Reposición sin service/paginar (AUDIT_2 #1, AUDIT_3 #1, AUDIT_14 #5, Tanda 3f) · **Sin code-splitting, bundle único y creciendo** (AUDIT_8 #1/#2, Tanda 10A/ADR-012 — reverificado 2026-09-30: `grep -c "lazy(() =>" src/shared/routes/AppRoutes.tsx` → **13** (eran 10 en 10A; Tanda 10B sumó Viajes/Vehículos/Choferes); carga inicial 347.246 B en 6 archivos, contra 1.537,42 kB en un solo chunk antes de 10A — ver `docs/historial/reportes/REPORTE_2026-09-09_codesplitting.md` y `REPORTE_2026-09-30.md`) · Reposición: join de "Generar OC" por `Map` (sesión 2026-09-30) · `updateProduct` descartaba lotes (PENDIENTES #13, sesión 2026-09-30, sin verificar en navegador).

## Checklists de verificación en navegador — sin evidencia de haberse ejecutado

Ningún commit en el historial dice "confirmado en navegador" sobre ninguno de los checklists de `docs/historial/verificaciones/` (43 archivos, incluidos `VERIFICACION_TANDA_9.md` a `VERIFICACION_TANDA_25.md`, `VERIFICACION_BE-0b.md`, `VERIFICACION_BE-1b.md`, `VERIFICACION_BE-1c.md` y los 2 de la sesión 2026-09-30: `VERIFICACION_2026-09-30_T2_lotes.md` y `VERIFICACION_2026-09-30_T4_reposicion.md`). Hay que asumir que **todos** siguen pendientes de que Leandro los corra, no solo los que dicen explícitamente "PENDIENTE"/"NO EJECUTADA" en su propio texto.

**Por dónde empezar:** `docs/VERIFICACION_PENDIENTE_UNIFICADA.md` junta en 42 puntos, ordenados por riesgo, todo lo pendiente de las Tandas 0/1, 3a-3d, 3g, 4-8, ADR-009 y el barrido de `empresaId`. Quedan fuera del unificado, pendientes en su archivo original: Tandas 2, 2.5, 3e, 3f, 9, 10A, 10B, 11-18, 20-25, B, C1, C2, los 2 de 2026-09-30 y BE-0b, BE-1b y BE-1c (más `BackEnd/docs/verificaciones/VERIFICACION_BE-0a.md` y `VERIFICACION_BE-1a.md`, este último ajustado en BE-1b al prefijo `/api`).

## Deuda técnica viva

Ver `docs/PENDIENTES.md` (24 ítems numerados, cada uno con severidad y estado — no se copia acá porque cambia con cada tanda). Los ítems 1 y 13 figuran cerrados en la tabla resumen desde el 2026-09-30, y el 15 desde la Tanda 16. Los ítems 16-20 se sumaron el 2026-10-07: dirección de entrega sin consumidor, campos fantasma de `OrderDeliverySection`, `fetchProducts` anidado (ADR-016), SKUs huérfanos en el seed de pedidos (**19, cerrado** en las Tandas 20/21) y el mismo dato huérfano en analytics/alertas/proveedores (20, vigente). El 21 se sumó en la Tanda 22: las 3 funciones de `money.ts` sin consumidor de producción y 3 multiplicaciones de dinero en float, que se conectan con cada módulo (ADR-BE-006 §49-51). El 22 y el 23 se sumaron en la Tanda 23: las respuestas de `httpClient` sin validar en viajes, entregas, vehículos y choferes, y el centinela `'' as Trip['id']` (**23 cerrado** en la Tanda 25). El 24 se sumó en la Tanda 25: el rango de un preset fijo memoizado entre días (Baja, sin disparador). Hallazgos preexistentes nuevos, documentados y no corregidos, en `AUDIT_2026-09-30_iam.md`: `AlertsBell.tsx:72-100` usa `useEffect`+`setState` con `Promise.resolve()` para callar al linter (MEDIO, trampa 6.5 del protocolo), y el `USER_ROLE='ADMIN'` fijo de `InventoryPage.tsx:69` (BAJO).
