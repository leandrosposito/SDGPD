# REPORTE 2026-10-10 — Sesión `sesion-be1c-2026-10-09` (tanda BE-1c)

> Verificado contra el filesystem el **2026-10-10**, en la rama `sesion-be1c-2026-10-09` (desde `lean` `044ead6`). Si leés esto después, reverificá.

Base: `lean` en `044ead6`, tag `pre-sesion-be1c-2026-10-09`. Tarea única: cerrar los dos MEDIO de BE-1b (refresh concurrente entre pestañas y zod duplicado en el bundle). Todo se corrió en secuencia y en primer plano; los tests del backend, en tres tandas, por el tope de 10 minutos por comando.

## Preflight y línea base

- `C:\proyectos\SDGPD`, `lean` en `044ead6`, árbol limpio, Node `v24.19.0`.
- `npm ci` en la raíz: exit 0. Typecheck, lint y build de los tres workspaces: exit 0.
- Tests: `contracts` 27/27; backend 177/177 (31 + 10 + 136).
- Frontend: tsc 0, lint con 0 errores y 1 warning, build OK, 31 scripts con exit 0.
- Guardé el tamaño de los 62 chunks: `vendor-zod` 154.60 kB, `index-` 169.16 kB.
- `npm ls zod` de la línea base: `@sdgpd/backend` y `@sdgpd/contracts` con `zod@4.6.5`; `FrontEnd` con `zod@4.4.3`.

## Qué hice, por parte (hecha / parcial / no hecha + por qué)

| Parte | Estado | Detalle |
|---|---|---|
| 1 — refresh entre pestañas | **Hecha** | El refresh corre dentro de `navigator.locks.request('sdgpd-auth-refresh', …)`: tanto el que dispara un 401 como el del arranque, porque los dos pasan por `refreshAccessToken`. El single-flight por pestaña sigue adentro. Sin `navigator.locks` se sigue sin lock, con un aviso único en modo debug y sin polyfill. El servidor no cambió. Smoke `be-1c` (15 chequeos). `httpClientCore` gana dos puntos de inyección: `auth.lock` y `fetchImpl` (este último, solo para el smoke) |
| 2 — una sola zod | **Hecha** | `contracts`: zod como `peerDependency` 4.4.3 (y `devDependency`). `BackEnd`: zod 4.4.3 exacta. Vite: `resolve.dedupe: ['zod']`. zod 4.4.3 alcanza: typecheck en verde, backend 177/177, contracts 27/27 |
| Documentación | **Hecha** | ADR-BE-003 (sub-decisión 29), ADR-BE-001 (17), `VERIFICACION_BE-1c.md` (dos pestañas y una sola zod), `ESTADO.md`, nota de cierre en el reporte de BE-1b y este reporte. `ARQUITECTURA.md` no cambia: no hay archivos nuevos ni movidos en `src/` |

**Dependencias:** ninguna nueva. La Parte 2 cambia la versión de una existente (zod en `BackEnd` y `packages/contracts`), dentro de lo que autoriza la consigna. No hay polyfill.

## Commits creados (hash + mensaje) y qué se mergeó a lean

| Hash | Mensaje |
|---|---|
| `14a04e1` | feat(frontend): BE-1c parte 1 — refresh coordinado entre pestañas con navigator.locks |
| `888def9` | build: BE-1c parte 2 — una sola copia de zod (4.4.3) en todo el monorepo |
| `7e26410` | docs: BE-1c — sub-decisiones (ADR-BE-003 29, ADR-BE-001 17), checklist y estado |
| (este) | docs: BE-1c — reporte |

Las dos partes pasaron sus gates en el primer intento, así que se mergean las dos. El hash del commit del reporte y el del merge `--no-ff` están en el informe del chat.

## Decisiones que tomé sin consultar

1. **El lock se inyecta** (`HttpClientAuth.lock`, con la forma de `navigator.locks.request`) y **también el `fetch`** (`fetchImpl`, por defecto el global). Así el smoke ejercita el core real, con dos "pestañas" que comparten un frasco de cookies. En la app, `httpClient.ts` arma el lock con `navigator.locks` y no pasa `fetchImpl`.
2. **El lock envuelve al refresh de la pestaña:** `refreshInFlight ??= lock(nombre, runRefresh)`. Los 401 de la misma pestaña esperan ese mismo refresh, y las otras pestañas esperan el lock. La segunda pestaña igual hace su propio refresh (con la cookie ya rotada): es una rotación más, no un reuso.
3. **zod 4.4.3 como `peerDependency` exacta** de `contracts`: la versión la fija el frontend.
4. **El lockfile se editó a mano, solo en zod.**
   - `npm install` lo dejaba bien en zod, pero además pasaba 6 entradas de `ajv` y sus dependencias de `dev: true` a `devOptional: true`, sin cambiar versiones. Es la normalización de las marcas del lockfile que trasplanté a mano en BE-1b.
   - Como la consigna para si cambia algo más que zod, descarté ese lockfile y apliqué a mano solo las entradas de zod: la 4.4.3 queda una sola vez, en la raíz, con el mismo `resolved` e `integrity` que tenía la del frontend.
   - `npm ci` lo acepta sin reescribirlo (lo comprobé con `cmp`).
   - El próximo `npm install` que autorice una tanda va a normalizar esas 6 marcas: está anotado en ADR-BE-001, sub-decisión 17.

## Hallazgos de la Fase D y cómo los corregí (con la evidencia antes y después)

**V1. El smoke de pestañas falla sin el lock y pasa con el lock.** Hice que el core ignore `auth.lock` (`refreshInFlight ??= run()`) y corrí el smoke:

```
OK   control sin lock: los dos refresh se solaparon en el servidor (maximo en vuelo: 2)
OK   control sin lock: el servidor vio un reuso y revoco la familia (1 reuso)
OK   control sin lock: una pestana perdio la sesion (onSessionExpired: A=1, B=2)
OK   control sin lock: la familia ya no refresca (el proximo vencimiento cierra la sesion)
FAIL con lock: los refresh NO se solaparon (maximo en vuelo: 2)
FAIL con lock: ningun reuso, la familia sigue viva (reusos: 1)
FAIL con lock: los dos requests terminaron bien despues del refresh
FAIL con lock: ninguna pestana perdio la sesion
FAIL con lock: las dos siguen pudiendo hacer requests
FAIL con lock: la familia sigue refrescando
FAIL el lock se pide con el nombre fijo sdgpd-auth-refresh
OK   arranque sin lock: dos recargas a la vez revocan la familia (control)
FAIL arranque con lock: las dos pestanas recargadas a la vez quedan con sesion
FAIL arranque con lock: ningun reuso y la familia sigue refrescando
OK   una pestana con 3 requests en paralelo: un solo refresh (1)

9 chequeo(s) fallaron
exit=1
```

Restaurado desde la copia (`cmp` idéntico):

```
OK   control sin lock: los dos refresh se solaparon en el servidor (maximo en vuelo: 2)
OK   control sin lock: el servidor vio un reuso y revoco la familia (1 reuso)
OK   control sin lock: una pestana perdio la sesion (onSessionExpired: A=1, B=2)
OK   control sin lock: la familia ya no refresca (el proximo vencimiento cierra la sesion)
OK   con lock: los refresh NO se solaparon (maximo en vuelo: 1)
OK   con lock: ningun reuso, la familia sigue viva (reusos: 0)
OK   con lock: los dos requests terminaron bien despues del refresh
OK   con lock: ninguna pestana perdio la sesion
OK   con lock: las dos siguen pudiendo hacer requests
OK   con lock: la familia sigue refrescando
OK   el lock se pide con el nombre fijo sdgpd-auth-refresh
OK   arranque sin lock: dos recargas a la vez revocan la familia (control)
OK   arranque con lock: las dos pestanas recargadas a la vez quedan con sesion
OK   arranque con lock: ningun reuso y la familia sigue refrescando
OK   una pestana con 3 requests en paralelo: un solo refresh (1)

todos los chequeos pasaron
exit=0
```

El servidor del smoke rota y detecta el reuso igual que el backend: marca el token usado de forma atómica al llegar, y presentar uno usado revoca la familia.

**V2. Una sola zod.**

```
sdgpd@ C:\proyectos\SDGPD
+-- @sdgpd/backend@0.0.0 -> .\BackEnd
| `-- zod@4.4.3
+-- @sdgpd/contracts@0.0.0 -> .\packages\contracts
| `-- zod@4.4.3 deduped
`-- distribuidoragestion@0.0.0 -> .\FrontEnd
  +-- @hookform/resolvers@5.9.1
  | `-- zod@4.4.3 deduped
  +-- eslint-plugin-react-hooks@7.1.1
  | +-- zod-validation-error@4.0.2
  | | `-- zod@4.4.3 deduped
  | `-- zod@4.4.3 deduped
  `-- zod@4.4.3 deduped
```

- Hay una sola copia física: `node_modules/zod/package.json` 4.4.3, sin otra en ningún `node_modules` de los workspaces.
- En el build del frontend, la marca de versión de zod (`major:4,minor:4,patch:3`) aparece **una sola vez**, en `vendor-zod-Ds3jdy_d.js`. La otra aparición de "Invalid input" en `index-` es el adaptador de `@hookform/resolvers/zod` (`Invalid input: not a Zod schema`), no código de zod.
- **Tamaños de los chunks (antes → después):**

  ```
  vendor-zod.js        154.60 ->  69.11 kB   (antes de BE-1b: 64.64 kB)
  index.js             169.16 -> 169.36 kB
  InventoryPage.js      57.04 ->  57.05 kB
  los otros 59 chunks: iguales
  total JS + CSS     1898.22 -> 1812.94 kB
  ```

  `vendor-zod` quedó 4.5 kB por encima de antes de BE-1b, por las partes de zod que usa `contracts` (email, ISO, UUID).

**V3. Build desde cero, en secuencia y en primer plano** (sobre `7e26410`, con `git status --porcelain` vacío):

1. `rm -rf` de todos los `node_modules` y `dist`, y `npm ci` en la raíz: exit 0. El árbol siguió limpio después (`npm ci` no tocó el lockfile).
2. Raíz: typecheck, lint y build con exit 0.
3. `contracts`: 27/27.
4. Backend: 177/177 en 13 archivos (tandas: 31, 10 y 136).
5. Frontend: tsc 0, lint con 0 errores y 1 warning, build OK, `vendor-zod` 69.11 kB.
6. Scripts: **31 de 31 idénticos a la línea base** (mismo exit, OK, FAIL y hash de salida) y el nuevo `be-1c` 15 OK. 0 FAIL y ningún exit distinto de 0.

**V4. Lockfile y secretos.**
- Entradas del lockfile distintas entre `pre-sesion-be1c-2026-10-09` y `HEAD`:

  ```
  cambia BackEnd                      campos: dependencies              (zod 4.6.5 -> 4.4.3)
  cambia node_modules/zod             campos: version,resolved,integrity (4.6.5 -> 4.4.3)
  cambia packages/contracts           campos: dependencies,devDependencies,peerDependencies (zod pasa a peer/dev)
  sale   FrontEnd/node_modules/zod    campos: version,resolved,integrity,license,funding (queda la de la raíz)
  entradas distintas: 4
  ```

  Las 4 son de zod. Además cambian `BackEnd/package.json` (+1/−1) y `packages/contracts/package.json` (+4/−3), los dos solo en zod.
- `git grep -F` de los 11 secretos de `BackEnd/.env`: **0 en los 11**. Control: `sdgpd_refresh` aparece en 10 archivos de `HEAD`.

## Hallazgos MEDIO/BAJO documentados y no tocados

- **Sigue abierto de BE-1b (BAJO-MEDIO):** el chunk de entrada (`index-`) pesa ~169 kB (117.5 antes de BE-1b). Lo explican los schemas de `@sdgpd/contracts` y el código de auth que el store carga al arrancar, no la zod duplicada. Se podría cargar el service de auth de forma diferida.
- **BAJO:** 6 marcas `dev`/`devOptional` del lockfile (`ajv` y sus dependencias) quedan sin normalizar. El próximo `npm install` autorizado las va a cambiar, sin cambiar versiones.
- **BAJO:** en la app, una pestaña puede quedar esperando el lock mientras otra refresca. Si el refresh de la otra se cuelga, el timeout del request (15 s) lo corta y el lock se libera.

## Riesgos introducidos

- **`contracts` ahora corre con zod 4.4.3 también en el backend.** Los 177 tests y el typecheck lo cubren, pero cualquier uso futuro de una API de zod posterior a 4.4.3 falla. Para subir zod hay que hacerlo desde el frontend, y pasa por el navegador.
- **La segunda pestaña hace su propio refresh** después de la primera (rotación extra, no reuso). Hay una fila más en `refresh_tokens` por pestaña; la limpieza de vencidos las borra.

## Qué NO verifiqué (esta verificación es estática, no abre un navegador)

- Nada en un navegador: dos pestañas reales con Web Locks, la recarga simultánea y los formularios con zod 4.4.3 (`contracts` corre ahora con esa versión en el navegador).
- Navegadores sin `navigator.locks`: no tengo uno. El camino sin lock es el mismo de BE-1b, y el aviso se arma al cargar el módulo.

## Qué tiene que probar Leandro a mano, en orden de riesgo

Está en `docs/historial/verificaciones/VERIFICACION_BE-1c.md`:

1. Dos pestañas: forzar el vencimiento del access token en las dos y recargar ambas casi a la vez; las dos siguen con sesión (sección 1).
2. Formularios con validación zod (login, alta de usuario, Nuevo Producto, Compras) y el tamaño de `vendor-zod` (sección 2).

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-be1c-2026-10-09 en lean>
```

Después del revert, correr `npm ci` en la raíz (vuelven la zod 4.6.5 del backend y `contracts`, y la 4.4.3 anidada del frontend).
