# REPORTE 2026-10-09 — Tanda 22: Gate 5, huérfanos y regla de IDs branded

> Verificado contra el filesystem el **2026-10-09**, en `lean` `d82df11` + la rama `sesion-gate5-huerfanos-2026-10-09`. Si leés esto después, reverificá.

Rama `sesion-gate5-huerfanos-2026-10-09`, desde `lean` `d82df11`. Tags `pre-sesion-gate5-huerfanos-2026-10-09` / `post-sesion-gate5-huerfanos-2026-10-09`. Las decisiones de la consigna vienen cerradas por Leandro, a partir de la reverificación de los 23 huérfanos del P2 de `REPORTE_2026-10-09_piloto-graphify.md`.

## Qué hice, por tanda

**Tanda 22: hecha.** Es una sola tanda y cada bloque de la consigna quedó así:

| Bloque | Estado | Detalle |
|---|---|---|
| A. Preflight | hecho | `C:/proyectos/SDGPD`, `lean`, árbol limpio, `pull --ff-only` → "Already up to date" (`d82df11`). Línea base: tsc exit 0; eslint con 0 errores y 1 warning (`PurchaseOrderFormModal.tsx:183`, `react-hooks/incompatible-library`); build OK; 27/27 scripts con exit 0 |
| B. Regla de ESLint | hecha | `no-restricted-syntax` con los dos selectores de la consigna, excepción solo para `ids.types.ts`, sin dependencias. Salida de B2 abajo |
| C1. `defaultDateRangeValue` | hecho | `LogisticsPage.tsx`. Los otros 4 listados no repiten el cuerpo y no se tocaron |
| C2. `isVehicleId`/`isDriverId` | hecho | `TripsPage.tsx`, con el patrón `safeBranchId` |
| C3. eslint después del fix | hecho | 0 errores |
| D. Borrar `SkeletonCard` | hecho | se borró después de pegar el grep |
| E. Smoke de `parseMoneyInput` | hecho, **con 1 corrección** | 13 casos. "-10" quedó fuera porque el contrato no define el signo |
| F. Documentación | hecha | PROTOCOLO, ADR-006, PENDIENTES #21, DECISIONES_TECNICAS, ESTADO. ARQUITECTURA no aplica |
| G. Verificación adversarial | hecha | G1-G4 abajo |

### B2: la regla antes del fix (salida de `npx eslint .`)

```
C:\proyectos\SDGPD\FrontEnd\src\modules\compras\components\PurchaseOrderFormModal.tsx
  183:17  warning  Compilation Skipped: Use of incompatible library
C:\proyectos\SDGPD\FrontEnd\src\modules\logistics\TripsPage.tsx
  70:48  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). Usá is<Tipo>Id para valores externos o as<Tipo>Id() para confiables  no-restricted-syntax
  71:46  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). Usá is<Tipo>Id para valores externos o as<Tipo>Id() para confiables  no-restricted-syntax
✖ 3 problems (2 errors, 1 warning)
exit 1
```

Marcó **exactamente** TripsPage.tsx:70 y :71 (el warning es el preexistente de la línea base). No hizo falta acotar el regex `/Id$/` a una lista explícita: no hubo falsos positivos.

### C3: después del fix

```
  183:17  warning  Compilation Skipped: Use of incompatible library
✖ 1 problem (0 errors, 1 warning)
eslint exit 0
```

### C1: comparación de cuerpos y de los otros listados

`dateRangePresets.ts:77-82` (`defaultDateRangeValue`) y `LogisticsPage.tsx:78-81` (antes del cambio) eran textualmente iguales:

```
if (preset === 'all' || preset === 'custom') {
  return { preset, dateFrom: undefined, dateTo: undefined };
}
return { preset, ...computeDateRangeForPreset(preset) };
```

Los tipos también coinciden:

- `preset` es `DateRangePreset`, igual que el parámetro.
- La función devuelve `DateRangeValue`, que es la anotación de `const dateRange`.
- El default del parámetro (`'all'`) no aplica, porque siempre se pasa `preset`.

Los otros listados derivan el rango **distinto**: arman `{ preset: url.preset ?? 'all', dateFrom: url.from, dateTo: url.to }` y no calculan nada desde el preset. Son estos:

- `ComprasPage.tsx:155-162`
- `TabPendingReceipt.tsx:77-84`
- `ClientAccountsTable.tsx:57-64`
- `ClientOverdueTable.tsx:72-79`

No se tocaron. La diferencia: con `?preset=thisMonth` en la URL y sin `from`/`to`, esos 4 no filtran por fecha, mientras que Logística sí calcula el rango.

### E: casos y corrección de `parseMoneyInput`

**Contrato usado:**

- Header de `parseMoneyInput`: "lanza si el string no es un número válido, nunca devuelve NaN".
- "Mismo criterio que los 2 schemas Zod": `z.coerce.number()` sobre `<input type="number">`, cuyo valor DOM es decimal con punto y sin separador de miles.
- `moneyFromNumber`: el valor está en la unidad principal.
- `money()` + ADR-008 (enmienda 2026-10-07): half-up al centavo, en un solo punto.

| Caso | Esperado (contrato) | Antes | Después |
|---|---|---|---|
| `"1234"` | 123400 | OK | OK |
| `"1234.567"` (3 decimales) | 123457 | OK | OK |
| `"1.005"` (3 decimales, mitad exacta) | 101 | **FAIL: 100** | OK |
| `""`, `"   "`, `"abc"` | lanza | OK | OK |
| `"1234,56"`, `"1.234,56"`, `"0,5"`, `"1,234.56"`, `"12,345"`, `"1.234.567,89"` | lanza (no son números para el criterio de `input type="number"`) | OK | OK |
| `"Infinity"` (agregado: cubre el cambio de validación) | lanza | no lanzaba: `Infinity` centavos | OK |
| `"-10"` | **sin definir**, queda fuera del smoke | — | — |

**Corrección 1, mitad exacta.**

- Antes: `return moneyFromNumber(parsed, moneda)`. Eso hace `money(value * 100)`, y `1.005 * 100` da `100.49999999999999`, que `Math.round` lleva a **100**.
- Después: `return money(principalToUnroundedCentavos(parsed), moneda)`. La función desplaza la coma en base 10 (`Number('1.005e2')` = `100.5`) y `money()` redondea a **101**. El redondeo sigue ocurriendo solo en `money()`.

**Corrección 2, no finitos.**

- Antes: `Number.isNaN(parsed)`, que deja pasar `Infinity`.
- Después: `!Number.isFinite(parsed)`. Sin este cambio, la corrección 1 habría convertido `"Infinity"` en centavos `NaN`.

Smoke: tanda-7 pasa de 17 a 30 OK (antes del fix, 1 FAIL y exit 1; después, exit 0).

## Commits creados y qué se mergeó a lean

- `b584bfb` — `feat(frontend): Tanda 22 — Gate 5: regla de IDs branded en ESLint, 3 exports conectados, SkeletonCard borrado` (código, ESLint, smoke, PROTOCOLO, ADR-006, PENDIENTES, DECISIONES_TECNICAS, checklist).
- Un commit `docs:` con `ESTADO.md` y este reporte.
- El merge `--no-ff` a `lean` y el tag `post-sesion-gate5-huerfanos-2026-10-09`. Los hashes del merge y del commit de docs están en el informe final del chat (este archivo se escribe antes de crearlos).

## Decisiones que tomé sin consultar

1. **Severidad `error` para toda la regla `no-restricted-syntax`, zustand incluido (antes `warn`).** Flat config no fusiona las opciones de una regla entre bloques: el último gana. Por eso zustand e IDs tienen que compartir una sola declaración y una sola severidad. Para que G3 pudiera fallar, la regla tenía que estar en `error`. Hoy no hay ninguna violación de zustand, así que no cambia el resultado de lint. La excepción de `ids.types.ts` vuelve a declarar los selectores de zustand para no perderlos ahí.
2. **`parseMoneyInput` se corrigió en su propio cuerpo y `moneyFromNumber` no se tocó.** `moneyFromNumber` tiene el mismo bug de mitad exacta, pero tiene un consumidor de producción (`dashboardAggregates.service.ts:106`) y la consigna autorizaba corregir solo la función sin llamadores. Quedó anotado en PENDIENTES #21.
3. **`Number.isNaN` → `Number.isFinite` en `parseMoneyInput`**, y un caso extra (`"Infinity"`) en el smoke. Ver E.
4. **Los formatos con coma y con separador de miles se testean como "lanza".** El criterio de la referencia a Zod es `z.coerce.number()` sobre `input type="number"`. Ver la decisión pendiente 1.
5. **El re-export `export { toISODateString }` (dateRangePresets.ts) no se borró.** Es un resto sin importadores que el método de P2 no vio (solo buscaba declaraciones de función). PROTOCOLO D7 dice "listar, no borrar" y no estaba en lo que se decidió borrar. Corregí su comentario, que nombraba a `ExportButton.tsx` como consumidor sin que lo fuera.
6. **Identidad de git:** `C:\proyectos\SDGPD` no tiene `user.name`/`user.email` configurados. Commiteé con `git -c user.name=leandrosposito -c user.email=…`, la misma identidad de los commits anteriores del repo, sin dejar config persistente.
7. **`ESTADO.md` ahora menciona el piloto de Graphify** (una línea, veredicto USO LIMITADO). En esa sesión no se había tocado por BE-0b, que ya está mergeada. También corregí el "32 scripts" de la sección BE-0b: son 27.

## Hallazgos de la Fase D (G) y cómo los traté

### G1 — Puntos ciegos de la regla (ids externos que llegan a un `<Tipo>Id` sin un cast visible para el selector)

| # | Archivo:línea | Qué es | ¿Idéntico a C2? | Acción |
|---|---|---|---|---|
| 1 | `modules/logistics/components/TripDetailPanel.tsx:119` | `localTrip?.id ?? ('' as Trip['id'])`: cast a `TripId` por tipo indexado (`TSIndexedAccessType`), que el selector no ve. No es externo (es un centinela vacío para un filtro deshabilitado) | No | Listado, no corregido |
| 2 | `modules/logistics/services/trips.service.ts:134, 176, 226, 322, 430, 470, 529, 639, 754, 778` | `httpClient.request<T>` con tipos de dominio (`Trip`, `TripPosition`, resultados) que llevan ids branded. En modo `http` la respuesta JSON llega tipada sin pasar por un guard | No | Listado. Es el BLOQUEANTE "wire no definido" de la auditoría de backend; se resuelve al conectar el módulo (ADR-BE-004) |
| 3 | `modules/logistics/services/deliveries.service.ts:228, 296` | Ídem, con `Delivery` | No | Ídem |
| 4 | `shared/api/vehicles/vehicles.service.ts`, `shared/api/drivers/drivers.service.ts` | Ídem: no tienen DTO ni mapper (`clients`/`orders` sí validan con `as<Tipo>Id(dto.id)` en el mapper) | No | Ídem |
| — | `useUrlListState` (genéricos) | Los filtros son `string`. Para llegar a un `<Tipo>Id` hace falta un cast, y la regla lo ve (así salieron TripsPage:70-71) | — | Cubierto |
| — | `useParams` | No se usa en `src/` | — | — |
| — | `searchParams.get` | `ComprasPage.tsx:251` ya pasa por `safeBranchId`. `proveedor`/`producto` (:208, :232) no son ids branded | — | Sin caso |
| — | `localStorage` | `useSessionStore.ts:54` resuelve contra `session.branches` (sin cast). `Header.tsx` es el tema, no un id | — | Sin caso |
| — | `JSON.parse` | No se usa en `src/` | — | — |

Formas de cast que el selector tampoco cubre y que hoy **no aparecen** en `src/` (grep vacío): `as OrderId[]`, `as Array<OrderId>`, `as Record<…, OrderId>` y `<OrderId>x`.

### G2 — Huérfanos con la definición nueva del Gate 5

Mismo método que el reporte del piloto, ampliado a los re-exports `export { … }`. Escaneé 211 exports de `shared/**` y `modules/*/api/**`:

- **Sin (a) ni (b): `sumMoney` (money.ts:40), `multiplyMoney` (:50) y `parseMoneyInput` (:87).** Los 3 figuran en PENDIENTES #21. ✔
- **Con (b):** 16, cada uno con su llamador interno, y ese llamador cumple (a):
  - `sortAlertsByRecency` (→ `paginateAlertsByCursor` → `alerts.service.ts`)
  - `exportJobStepAt` (→ `createExportJob` → `useExportJob.ts`)
  - los 4 de `useUrlListState` (22 consumidores)
  - `extractOrderNumberSuffix` (→ `maxOrderNumberSuffix` → `orders.service.ts`)
  - los 9 `is*Id` (cada `as*Id` tiene entre 1 y 5 consumidores externos)
  - el re-export `toISODateString` (→ `computeDateRangeForPreset` → `DateRangeFilter.tsx`)
- `defaultDateRangeValue`, `isVehicleId` e `isDriverId` ya no aparecen (ahora tienen uso externo). `SkeletonCard` ya no existe.

### G3 — La regla sigue viva

```
=== con la linea temporal (src/shared/utils/orderNumber.ts):
import type { OrderId } from '@/shared/types/ids.types';
export const x = 'a' as OrderId;
C:\proyectos\SDGPD\FrontEnd\src\shared\utils\orderNumber.ts
  26:25  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). ...  no-restricted-syntax
✖ 2 problems (1 error, 1 warning)
eslint exit 1
=== revertido:
git status --porcelain -- src/shared/utils/orderNumber.ts   -> (vacío)
eslint del archivo exit 0
```

Probé también la excepción: la misma línea en `ids.types.ts` da eslint exit 0. Revertí, y `git status` quedó vacío.

### G4 — Gates completos (D8 desde cero, después del commit)

| Gate | Línea base | Final |
|---|---|---|
| `git status --porcelain` | 0 | 0 |
| `package.json`/lockfiles vs `lean` | — | diff de 0 bytes |
| `rm -rf node_modules && npm ci` | — | exit 0 (206 paquetes) |
| `tsc -b --noEmit` | exit 0 | exit 0 |
| `eslint .` | 0 errores, 1 warning | 0 errores, el mismo warning |
| `vite build` | exit 0 | exit 0 |
| scripts (18 smoke + 9 verificación) | 27/27 exit 0 | 27/27 exit 0, sin FAIL. tanda-7 pasó de 17 a 30 OK |

En la primera pasada después de `npm ci`, `v13-tanda11-integrity.mjs` salió con **exit 127** (24 OK, 0 FAIL). Lo corrí 3 veces aislado y dio exit 0 las 3, y la segunda pasada completa dio 27/27. 127 es "comando no encontrado" del shell: falló el lanzamiento de `node`, no el script. Lo registro igual, sin ocultarlo.

**D3, el diff contra este informe:** en `git show b584bfb --stat` aparecen 13 archivos: `eslint.config.js`, `TripsPage.tsx`, `LogisticsPage.tsx`, `dateRangePresets.ts`, `SkeletonLoader.tsx`, `SkeletonLoader.css`, `money.ts`, `tanda-7.smoke.mjs`, `PROTOCOLO.md`, `ADR-006`, `PENDIENTES.md`, `DECISIONES_TECNICAS.md` y `VERIFICACION_TANDA_22.md`. Cada afirmación de este informe sobre código corresponde a uno de esos archivos.

## Hallazgos MEDIO/BAJO documentados y no tocados

- **MEDIO**: `moneyFromNumber` pierde la mitad exacta (`1.005` → 100). Tiene un consumidor en dashboard. Está en PENDIENTES #21.
- **MEDIO**: las 4 derivaciones de rango que no calculan desde el preset (C1). Con un preset fijo en la URL y sin fechas, no filtran.
- **BAJO**: el re-export `toISODateString` sin importadores (dateRangePresets.ts).
- **BAJO**: `'' as Trip['id']` en TripDetailPanel.tsx:119 (G1 #1).
- **Ya conocido (BLOQUEANTE de la auditoría de backend)**: las respuestas de `httpClient` tipadas con ids branded sin validar (G1 #2-4).

## Riesgos introducidos

- `no-restricted-syntax` pasó a `error`. Un selector de zustand mal escrito, que antes era warning, ahora **rompe** lint.
- La URL de Viajes con un id inválido ahora muestra el listado **sin** ese filtro. Antes el valor se mandaba tal cual al service y no matcheaba nada (listado vacío). Ahora ignorar el filtro es lo correcto, pero es un cambio visible.
- `parseMoneyInput` no tiene llamadores, así que el cambio no afecta a la UI.

## Qué NO verifiqué

- Nada en el navegador.
- El comportamiento del `<select>` de Vehículo/Chofer cuando la URL trae un valor inválido: lo revisé solo en el código.
- Que los 4 presets fijos de Logística den exactamente el mismo rango que antes: el cuerpo es textualmente el mismo, pero no hay smoke de `LogisticsPage`.

## Qué tiene que probar Leandro a mano, en orden de riesgo

Detalle en `docs/historial/verificaciones/VERIFICACION_TANDA_22.md`:

1. Viajes con `?vehicleId=basura`, `?driverId=basura` y los dos juntos: no rompe, el listado sale sin ese filtro y aparece el `console.warn` (igual que ComprasPage con una sucursal inválida).
2. Viajes filtrando por un vehículo y un chofer reales: filtra igual que antes, y el filtro se mantiene al recargar.
3. Logística: cada preset de fecha (sin preset/"Hoy", "Todos", los 4 fijos, "Personalizado"), y `?preset=thisMonth` escrito a mano en la URL. Tiene que dar el mismo resultado que antes.
4. Los skeletons de tablas y KPI se ven como siempre.

## Decisiones pendientes (necesitan a Leandro)

1. **Formato de entrada de dinero.** El contrato de `parseMoneyInput` se escribió para `input type="number"` (punto decimal, sin miles). Si algún formulario va a usar un input de texto con formato es-AR (`1.234,56`), hace falta decidir el parseo. Hoy el smoke fija esos formatos como "lanza".
2. **Signo.** ¿`parseMoneyInput("-10")` lanza (como el `.min(0)` de los schemas) o devuelve −1000 centavos (`Money` admite negativos)? Quedó fuera del smoke.
3. **`moneyFromNumber`:** ¿se le aplica ya la misma corrección? Cambia el tablero solo en los casos de mitad exacta, y para bien.
4. **¿Se unifica la derivación del rango de fechas?** (C1) Hoy Compras, TabPendingReceipt, Cuentas Corrientes y Morosos no calculan el rango desde el preset.
5. **El re-export `toISODateString`:** ¿se borra?

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-gate5-huerfanos-2026-10-09 en lean>
```

El hash está en el informe final del chat.
