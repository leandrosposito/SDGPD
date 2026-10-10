# REPORTE 2026-10-09 — Sesión `sesion-be1b-2026-10-09` (tanda BE-1b)

> Verificado contra el filesystem el **2026-10-09**, en la rama `sesion-be1b-2026-10-09` (desde `lean` `e638b83`). Si leés esto después, reverificá.

Base: `lean` en `e638b83`, tag `pre-sesion-be1b-2026-10-09`. Tarea única: BE-1b, conectar la autenticación y la gestión de usuarios al frontend, en cuatro partes con un commit cada una.

## Preflight y línea base

- `C:\proyectos\SDGPD`, `lean` en `e638b83`, árbol limpio, Node `v24.19.0`.
- `BackEnd/.env` tiene las tres URLs, `JWT_SECRET` y las credenciales del seed.
- **Raíz:** typecheck, lint y build con exit 0; test exit 0 (`contracts` 27/27, backend 165/165).
- **Frontend** (`npm ci` en `FrontEnd/`): tsc (`-p tsconfig.app.json` y `-b`) exit 0, lint con 0 errores y 1 warning (`PurchaseOrderFormModal.tsx:183`), build OK.
- **Scripts:** 28/28 con exit 0. Guardé, de cada uno, exit, cantidad de OK/FAIL y un hash de su salida; dos corridas dieron los mismos 28 hashes.
- Guardé `npm ls --all` del frontend (409 líneas) y `xlsx`: 0.20.3, `resolved` `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`, `integrity` `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`.

## Qué hice, por parte (hecha / parcial / no hecha + por qué)

| Parte | Estado | Detalle |
|---|---|---|
| 0 — backend | **Hecha** | (1) HMAC-SHA256 del payload de idempotencia con `IDEMPOTENCY_HMAC_KEY` (la genera `db:setup -- --secrets-only`). (2) Guarda de último admin: 422 `last-admin`, con advisory lock por empresa. (3) Login con tiempo parejo. (4) Limpieza de refresh tokens vencidos en el mismo scheduler (migración 0006). (5) Prefijo global `/api` y cookie `Path=/api/auth/refresh`; tests y checklist de BE-1a ajustados. (6) Seed con la empresa demo y sus 4 sucursales en UUID fijos (`scripts/db/demo-ids.ts`), con migración de las que ya existían. 10 tests nuevos |
| 1 — workspaces | **Hecha** | `FrontEnd` entra a los workspaces, el lockfile pasa a la raíz y se borra `FrontEnd/package-lock.json`. Ninguna versión cambió. El frontend consume `@sdgpd/contracts` por `sdgpd-source`, con la misma garantía que el backend (probado). `FrontEnd/CLAUDE.md` y `CLAUDE.md` raíz actualizados |
| 2 — modo mixto, auth y sesión | **Hecha** | (1) `VITE_HTTP_SERVICES`. (2) Ids compartidos en el mock. (3) `httpClient` con Bearer, single-flight y un reintento. (4) Proxy de Vite sin reescribir. (5) Login, logout y guard. (6) `useSessionStore` contra `/api/auth/session`. (7) Smoke `be-1b` (20 chequeos) |
| 3 — permisos y Settings | **Hecha** | (1) `usePermission`; `USER_ROLE` eliminado. (2) `TabUsersRoles` conectado (alta, edición, matriz 10 × 7, version, clave al abrir, 409 y 422 con mensaje). (3) Rama de fallo de v13 probada. Smoke `be-1b-ui` (13). Un arreglo posterior (sin `settings.ver`, la pestaña no consulta y avisa) |
| Documentación | **Hecha** | Los dos `ARQUITECTURA.md`, plan del README (BE-1b hecha y qué services van por http), sub-decisiones en ADR-BE-001/002/003/005 y la enmienda de ADR-006, `VERIFICACION_BE-1b.md`, `ESTADO.md` y este reporte |

**Dependencias:** ninguna nueva en ningún workspace. `@sdgpd/contracts` se declaró en `FrontEnd/package.json` como dependencia de workspace (`0.0.0`): es un paquete del propio monorepo, no de terceros, y la consigna exige que el frontend lo consuma.

## Commits creados (hash + mensaje) y qué se mergeó a lean

| Hash | Mensaje |
|---|---|
| `1399db1` | feat(backend): BE-1b parte 0 — HMAC de idempotencia, último admin, login parejo, limpieza, /api, ids demo |
| `9cd466f` | build: BE-1b parte 1 — FrontEnd entra a los workspaces |
| `fe40c9d` | feat(frontend): BE-1b parte 2 — modo mixto, auth y sesión contra el backend |
| `498bd71` | feat(frontend): BE-1b parte 3 — permisos en la UI y Settings conectado |
| `25f09ee` | fix(frontend): BE-1b parte 3 — Usuarios y Roles sin settings.ver no consulta y muestra un aviso |
| (docs) | docs: BE-1b — ADRs, plan, arquitectura, checklist, estado y reporte |

Las cuatro partes pasaron sus gates en el primer intento, así que se mergean todas. El hash del commit de documentación y el del merge `--no-ff` están en el informe del chat.

## Decisiones que tomé sin consultar

Las de diseño quedaron como sub-decisiones en sus ADRs: ADR-BE-003 (24-28), ADR-BE-005 (enmienda de la 2), ADR-BE-001 (15-16), ADR-BE-002 (22) y la enmienda de ADR-006.

1. **El único lugar que declara los services por http es `VITE_HTTP_SERVICES`** (lista separada por comas, validada en `shared/api/serviceModes.ts`).
   - Un nombre que no está conectado hace fallar el arranque con el mensaje: no se ignora.
   - `auth` y `session` van juntos; `users`, `roles` y `branches` exigen `auth`.
   - Conservé `VITE_API_MODE=http` como escape (todo por http), documentado como de antes de BE-1b.
2. **`VITE_API_BASE_URL` vale `/api` por defecto**, en el mismo origen. Los paths de los services no llevan el prefijo.
3. **Cómo entró `FrontEnd` a los workspaces:** trasplanté las 237 entradas de su lockfile al de la raíz bajo `FrontEnd/node_modules/`, sin re-resolver nada. Si un `npm install` re-resolviera, `xlsx` ("latest") podría cambiar de versión en silencio.
4. **Ids de la empresa demo:**
   - la empresa conserva el id de desarrollo que le dio BE-1a;
   - las sucursales usan `0192f000-0000-7000-8000-00000000000N`;
   - el seed migra las sucursales que ya existían y falla con un mensaje claro si `SEED_EMPRESA_ID` es otro.
5. **Guarda de último admin:**
   - se chequea al final de cada comando de usuarios y de matrices, con un advisory lock de transacción por empresa (`CommandTx.lockScope`);
   - una contraseña incorrecta suma un fallo también durante el bloqueo, para que el login tenga siempre las mismas transacciones.
6. **El access token vive en memoria.** El refresh vive en el core de `httpClient` (`refreshAccessToken`, single-flight), no en el service de auth: así lo prueba un servidor real.
7. **`RequireSession` envuelve a `AppShell`**, y `/login` es la única ruta afuera. `LoginPage`, `RequireSession`, `tokenStore` y `usePermission` viven en `shared/auth/` (no son un módulo de negocio).
8. **Usuarios y roles pasan al modelo del contrato:**
   - se borraron `SystemRole`, `UserAccount`, la matriz de 8 booleanos y el `dto.ts`/`mapper.ts` de `users-roles`;
   - el mock de Settings tiene las mismas matrices que siembra el backend, repetidas porque el mock no puede importar el backend;
   - el usuario de la sesión mock es Admin con toda la matriz, así en mock todos los botones se ven como antes.
9. **Export de usuarios:** solo en mock. Con `users` por http el botón no se muestra, porque el backend no exporta usuarios hasta BE-10 y la regla 3.3 prohíbe armarlo en el navegador.
10. **Si el admin cambia su propio rol, o la matriz de su rol, la sesión se recarga** (`refreshSession`), para que la UI oculte lo que corresponde.
11. **El Header muestra el nombre y el rol de la sesión** (en mock, "Lucia Fernandez · Admin"; antes decía "Admin · Configuración" fijo). El logout aparece solo con auth por http.
12. **Tests adaptados con justificación (regla 2.5):**
    - prefijo `/api` en las rutas de los tests;
    - firma nueva de `payloadHash`;
    - `JWT_SECRET` e `IDEMPOTENCY_HMAC_KEY` en el caso "todas las variables" de `config.test`;
    - un `timeout` de 120 s en el test concurrente del último admin, que crea su propia empresa;
    - en el frontend, `v-adr009` cambió sus ids a mano (la justificación está escrita en el script).
    - Ninguna aserción se aflojó.
13. **`MOCK_ALL_PERMISSIONS` se arma con `Record<Module, true>` e `import type` del contrato.** Así TS exige los 10 módulos y las 7 acciones, y los scripts de node que cargan el mock no necesitan `contracts` compilado.

## Hallazgos de la Fase D y cómo los corregí (con la evidencia antes y después)

**V1. Guarda de último admin** (`test/auth/be1b-backend.test.ts`):

```
✓ … el único admin no puede quitarle settings.editar a su rol, desactivarse ni cambiarse de rol: 422 last-admin, sin efecto
✓ … con otro admin activo, sí puede quitarse settings.editar (cambiarse de rol)
✓ … dos admins que se desactivan entre sí a la vez: uno pasa y el otro recibe 422 (sin write skew)
Tests  3 passed | 7 skipped (10)
```

Contraprueba: comenté `assertAnAdminRemains` en los dos controllers y el primer test falló con `AssertionError: expected 200 to be 422`. Restaurado con `git checkout`; `git status` de `src` quedó limpio.

El test concurrente primero falló por timeout (30 s). No era un deadlock: un bloqueo lo habrían cortado `statement_timeout` (15 s) o el detector de deadlocks de Postgres, y el request habría vuelto con error. Era lentitud: crea su propia empresa (unas 75 inserciones contra la base remota) y hace dos logins con argon2. Con 120 s pasa.

**V2. Single-flight:** cambié `refreshInFlight ??= …` por `refreshInFlight = …` y corrí el smoke:

```
FAIL un solo refresh para los 3 (hubo 3)
FAIL con el token vigente no hay refresh
FAIL un solo intento de refresh, sin loop (hubo 3)
FAIL se aviso onSessionExpired una vez (3)
4 chequeo(s) fallaron
exit=1
```

Restaurado desde la copia (`cmp` sin diferencias); el smoke vuelve a dar `todos los chequeos pasaron`.

**V3. Ninguna ruta accesible sin sesión con auth por http:**
- El único archivo con `<Route` es `AppRoutes.tsx`, y no hay `useRoutes` ni `createBrowserRouter` (0).
- `/login` (línea 89) es la única ruta fuera del layout de la línea 91, que envuelve `<RequireSession><AppShell/></RequireSession>`. Las 14 rutas restantes (13 páginas y el catch-all), de la línea 99 a la 168, cuelgan de él.
- `RequireSession`, con auth por http, renderiza los hijos solo con `status === 'authenticated'`. Con `unauthenticated` redirige a `/login`.

**V4. El token no se guarda en storage ni en cookies legibles:**
- `localStorage`, `sessionStorage`, `document.cookie` e `indexedDB` en `FrontEnd/src` aparecen solo para el tema (`app-theme`) y la sucursal activa (`sdgpd.activeBranchId`).
- La única línea que además dice "token" es el comentario de `tokenStore.ts` que lo prohíbe.
- No hay `persist` de zustand (0 archivos con `zustand/middleware`).
- El token vive en una variable de módulo (`tokenStore.ts`), que solo leen y escriben `auth.service.ts` y `httpClient(Core).ts`.

**V5 y V6:** ver "V5/V6 desde cero" más abajo. Los corrí después de commitear la documentación, con el árbol limpio.

**Otras verificaciones, con evidencia:**
- **Proxy real:** backend levantado y `vite --port 5199` con `VITE_HTTP_SERVICES=auth,session,users,roles,branches`. Por el puerto de Vite: `/api/health` 200, `/api/auth/login` 200 con `set-cookie: sdgpd_refresh=<token>; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`, `/api/auth/refresh` 200 con esa cookie, y `/login` 200.
- **Garantía de contrato:** con un archivo de prueba que usaba `User['email']`, renombré `email` a `mail` en `userSchema`. El tsc del frontend falló con exit 2 (`Property 'email' does not exist…`). Revertido y borrado el archivo.
- **Parte 1, npm ls:**

  ```
  base: 207 nombre@versión | nuevo: 212
  solo en la base: ninguno
  solo en el nuevo (sin @sdgpd/contracts): [ 'zod@4.6.5', 'esbuild@0.28.2', '@esbuild/win32-x64@0.28.2', 'tsx@4.23.15' ]
  xlsx: misma versión, resolved e integrity
  ```

  - `zod@4.6.5` es el de `contracts`.
  - `esbuild`, `tsx` y un `ajv@6.15.0` que `npm ls` marca `invalid` son peers **opcionales** de vite y de @hookform/resolvers. Antes figuraban como UNMET y ahora se resuelven a paquetes de la raíz (los del backend). No se instaló nada nuevo para el frontend: el `ajv` de su eslint sigue anidado en `FrontEnd/node_modules/eslint/node_modules/ajv` y el frontend solo usa `@hookform/resolvers/zod`.
  - El build salió **idéntico** (mismos archivos, con sus hashes de contenido, y mismos tamaños), el lint también, y los 28 scripts dieron los mismos 28 hashes.
- **Parte 2, scripts:** `v11`, `v12`, `v16` y `v-adr009` cambiaron su salida porque imprimen ids. Reemplacé en la salida actual los UUID por `branch-00N`/`company-001` y el hash quedó **idéntico al de la línea base** en los cuatro.
  - Antes de actualizarlo, `v-adr009` daba 2 FAIL con los ids nuevos (`FAIL ord-004 tiene entregas reales en branch-001 y branch-003…`).
  - Con los ids viejos, su chequeo `filterOrdersForBranch` pasaba en vacío (0 contra 0).
- **Rama de fallo de v13:** cambié `>= 2` por `>= 200` y dio `exit=1` con `FAIL tipo 'reprogramacion'…`, `FAIL tipo 'no-entrega'…` y `2 verificacion(es) de integridad fallaron`, sin el assert de libuv. Revertido (`git diff` vacío) y de nuevo en `exit=0`.
- **Seed:** la primera corrida dio `4 sucursales (migradas a id fijo: CTR, NOR, SUR, VMA)` y las 4 filas de `user_branches` re-apuntadas. La segunda, sin migraciones. Las sucursales en `sdgpd`: `0192f000-0000-7000-8000-000000000001` (CTR) a `…0004` (VMA).

### V5/V6 desde cero

**Primer intento, cortado.** Lo corrí en segundo plano y Claude Code lo cortó por falta de memoria en la máquina (había 674 MB libres de 7.9 GB), al empezar los tests del backend. Hasta ahí, `npm ci` y typecheck, lint y build de la raíz habían dado exit 0. No era una falla de los gates. Lo frené ahí y lo reporté.

**Segundo intento: completo, en secuencia y en primer plano**, a pedido de Leandro. Sobre `464f91b`, con `git status --porcelain` vacío:

1. `rm -rf` de todos los `node_modules` y `dist`, y `npm ci` en la raíz: exit 0 (solo los avisos `allow-scripts` de esbuild).
2. Raíz: typecheck, lint y build con exit 0. El lint da 0 errores y el warning de siempre (frontend).
3. `contracts`: 27/27 en 3 archivos.
4. Backend: **177/177 en los 13 archivos**, en tres tandas sucesivas en primer plano (cada comando tiene un tope de 10 minutos y la suite tarda unos 11):
   - `auth` y `permissions`: 31 tests (357 s);
   - `be1b-backend`: 10 (195 s);
   - `db`, `http` y `config`: 136 (305 s).
5. Frontend: tsc exit 0, lint con 0 errores y 1 warning, build OK.
6. Los 31 scripts, uno por uno:
   - **24 idénticos a la línea base**;
   - **4 con la salida distinta solo por los ids** (`v11`, `v12`, `v16` y `v-adr009`, iguales a la corrida de la Parte 3, donde lo demostré re-mapeando los ids);
   - **3 nuevos** (`be-1b` 20 OK, `be-1b-ui` 13 OK, `v18-ids-demo` 7 OK);
   - ninguno con exit distinto de 0, ningún FAIL y ningún `UV_HANDLE_CLOSING`.

**V6, sobre esa instalación limpia:**
- `npm ls --all` del frontend contra la línea base: `solo en la base: ninguno`. Las únicas apariciones nuevas son `zod@4.6.5` (de `@sdgpd/contracts`), `esbuild@0.28.2`, `@esbuild/win32-x64@0.28.2` y `tsx@4.23.15` (peers opcionales visibles desde la raíz).
- El único `npm error` es `invalid: ajv@6.15.0`, el peer opcional documentado más abajo.
- `xlsx`: 0.20.3, con el mismo `resolved` e `integrity` que la línea base.
- `git grep` de los 11 secretos de `BackEnd/.env` (ref, host del pooler, las tres contraseñas, `JWT_SECRET`, `IDEMPOTENCY_HMAC_KEY` y los emails y contraseñas del seed): **0 coincidencias en los 11**. Control: `sdgpd_refresh` aparece en 9 archivos de `HEAD`.

## Hallazgos MEDIO/BAJO documentados y no tocados

> **Los dos MEDIO de abajo se cerraron en BE-1c (2026-10-10, `REPORTE_2026-10-10_be1c.md`):** lock entre pestañas y una sola zod (`vendor-zod` 154.6 → 69.1 kB). El chunk de entrada sigue más grande que antes de BE-1b, por otra razón (schemas de `contracts` y código de auth en el arranque).

- **MEDIO, tamaño del bundle:**
  - el chunk `vendor-zod` pasó de 64.6 a 154.6 kB y el de entrada (`index-`), de 117.5 a 169.2 kB;
  - el frontend empaqueta dos zod (su 4.4.3 y el 4.6.5 de `contracts`), más los schemas que el store carga al arrancar;
  - afecta también al modo mock;
  - propuesta: `resolve.dedupe: ['zod']` en Vite, o alinear versiones en una tanda que autorice tocar dependencias. No lo hice porque cambia la versión de zod con la que corre `contracts` en el navegador y no lo podía probar en runtime.
- **MEDIO, dos pestañas:**
  - el single-flight es por pestaña;
  - dos pestañas que refrescan a la vez con la misma cookie cuentan como reuso, y el servidor revoca la familia: las dos van al login;
  - propuesta: coordinar entre pestañas (`navigator.locks` o `BroadcastChannel`).
- **BAJO:** `npm ls --all` del frontend ahora sale con exit 1, por el `ajv` invalid de arriba (un peer opcional). En la línea base salía con 0.
- **BAJO:** la navegación no filtra módulos por `ver`. Un Chofer ve el menú de Inventario y entra (con los botones ocultos); como Inventario sigue en mock, ve los datos mock.
- **BAJO:** las matrices de los roles mock repiten las del backend (`default-roles.ts`). Si cambian allá, hay que cambiarlas acá.
- **BAJO:** el test de tiempo parejo compara medianas contra la base remota (factor 2). En una red muy inestable puede ser frágil.
- **BAJO:** quedan dos perillas de modo: `VITE_HTTP_SERVICES` (la real) y `VITE_API_MODE=http` (escape global).

## Riesgos introducidos

- **El frontend depende de que el backend sirva `/api` en el mismo origen.** En producción, frontend y API tienen que compartir site (ADR-BE-003, objeción 2), o la cookie `SameSite=Strict` no viaja.
- **Las claves de idempotencia guardadas antes del HMAC** (TTL 48 h, solo en desarrollo) ya no coinciden: un replay de una de ellas da 422.
- **Con auth por http, la carga inicial hace un refresh y un `GET /api/auth/session`** antes de mostrar la app. Sin backend, la app va al login con el mensaje "No se pudo conectar…".
- **La UI nueva no tiene tests de componente** (la regla 2.3 los prohíbe en el frontend). Lo probado está en los smokes (lógica pura y `httpClient` contra un servidor real) y en el checklist.

## Qué NO verifiqué (esta verificación es estática, no abre un navegador)

- **Nada en un navegador:** la pantalla de login, la recarga con sesión, el refresh transparente en pantalla, el logout, `TabUsersRoles` (modal, matriz y mensajes), el selector con una sola sucursal y los módulos mock filtrando por los ids nuevos.
- **El comportamiento de la cookie `Secure` en `http://localhost`** en el navegador real (curl no la valida).
- **`db:setup` completo**, porque no tengo `SUPABASE_DB_PASSWORD`. Corrí `--secrets-only`, que generó `IDEMPOTENCY_HMAC_KEY`.
- **Los commits intermedios aislados:** las partes 2 y 3 se probaron sobre la parte anterior, en orden, no desde un checkout de cada commit.

## Qué tiene que probar Leandro a mano, en orden de riesgo

Está en `docs/historial/verificaciones/VERIFICACION_BE-1b.md`:

1. Sesión: login, recarga, token vencido forzado y logout (sección 1).
2. Último admin y conflicto de versión (sección 3).
3. Permisos en la UI con un usuario Chofer y una sola sucursal (sección 2).
4. Los módulos en mock filtrando por sucursal, y el modo mock sin `VITE_HTTP_SERVICES` (sección 4).

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-be1b-2026-10-09 en lean>
```

El revert no deshace la migración 0006 aplicada en Supabase ni la migración de las sucursales demo a sus ids fijos en `sdgpd`. Si se revierte, el frontend vuelve a tener su propio `FrontEnd/package-lock.json`, así que hay que correr `npm ci` en `FrontEnd/` y en la raíz.
