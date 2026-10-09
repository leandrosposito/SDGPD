# REPORTE 2026-10-09 — Tanda 25: cierre de PENDIENTES #23 y gate intermitente de v13

> Verificado contra el filesystem el **2026-10-09**, en `lean` `9dba150` + la rama `sesion-centinela-trip-2026-10-09`. Si leés esto después, reverificá.

Rama `sesion-centinela-trip-2026-10-09`, desde `lean` `9dba150`. Tags `pre-sesion-centinela-trip-2026-10-09` / `post-sesion-centinela-trip-2026-10-09`. Las decisiones vienen cerradas por Leandro: opción (b) para #23 y excepción a la regla 2.5 para `v13`.

## Preflight y línea base

`C:/proyectos/SDGPD`, `lean`, árbol limpio, `pull --ff-only` → "Already up to date" (`9dba150`). Línea base:

- tsc exit 0.
- eslint con 0 errores y 1 warning (`PurchaseOrderFormModal.tsx:183`).
- build OK.
- 28/28 scripts con exit 0 y sin FAIL.

## Qué hice, por tanda

### Tanda 25: HECHA

**B1, regla reaplicada:** los dos selectores de la Tanda 23 (`TSIndexedAccessType` con clave `/^(id|[A-Za-z]+Id)$/`, directo y dentro de `TSUnionType`). eslint antes del fix:

```
C:\proyectos\SDGPD\FrontEnd\src\modules\logistics\components\TripDetailPanel.tsx
  119:113  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). ...  no-restricted-syntax
✖ 2 problems (1 error, 1 warning)
exit 1
```

Marcó **exactamente** TripDetailPanel.tsx:119 (el warning es el preexistente).

**B2, antes de tocar:**

```
// TripDetailPanel.tsx:51
const TRIP_LIVE_INTERVAL_MS = 12_000; // ADR-011 seccion 4 / enmienda ADR-003: rango 10-15s
// :119-124
const positionFilters: TripPositionQueryFilters = useMemo(() => ({ empresaId, tripId: localTrip?.id ?? ('' as Trip['id']) }), [empresaId, localTrip?.id]);
const { items: positionItems } = useLiveQuery(getTripPosition, positionFilters, {
  enabled: isOpen && localTrip?.estado === 'EnTransito' && Boolean(localTrip),
  intervalMs: TRIP_LIVE_INTERVAL_MS,
});
const livePosition = positionItems[0] as TripPosition | undefined;
```

- **Query key:** `pagedQueryKey` = `['paged', fetchPage.name, empresaId, filters, sort, page, pageSize]` (`usePagedQuery.ts:202-208`).
- **Polling:** `refetchInterval: intervalMs` solo con `live` (`usePagedQuery.ts:223`).
- **Lecturas del resultado:** `positionItems` y `positionFilters` solo se usan en ese bloque. `livePosition` tiene **un único lector**, :221, dentro del bloque `{localTrip.estado === 'EnTransito' && (<div …>Posición actual (sin mapa)… formatPosition(livePosition ?? localTrip.posicionActual)</div>)}`.
- No hay ningún uso fuera del bloque que se mueve, así que no aplicó la parada de B3.
- `SidePanel` devuelve `null` con `!isOpen` (`SidePanel.tsx:34`), así que el bloque ya existía solo con el panel abierto.

**B3, subcomponente:**

- `TripLivePosition` vive en el mismo archivo y no se exporta. Recibe `{ empresaId: string; tripId: TripId; fallback: TripPosition | undefined }` y contiene el `useMemo` de filtros, el `useLiveQuery` con `intervalMs: TRIP_LIVE_INTERVAL_MS` y el `<div>` de posición.
- El panel lo monta con `{isOpen && localTrip.estado === 'EnTransito' && <TripLivePosition empresaId={empresaId} tripId={localTrip.id} fallback={localTrip.posicionActual} />}`. Es la misma condición que el `enabled` anterior: `Boolean(localTrip)` ya está garantizado por el `if (!localTrip) return null` previo.
- El centinela se eliminó. `getTripPosition` y `TripPositionQueryFilters` no se tocaron.
- **Query key antes y después**, con la `pagedQueryKey` real:
  ```
  antes  : ["paged","getTripPosition","emp-001",{"empresaId":"emp-001","tripId":"trip-001"},null,1,20]
  despues: ["paged","getTripPosition","emp-001",{"empresaId":"emp-001","tripId":"trip-001"},null,1,20]
  iguales: true
  ```
  Con la consulta habilitada, `localTrip` siempre existía, así que el `?? ''` nunca entraba en la key.
- **Intervalo:** `TRIP_LIVE_INTERVAL_MS = 12_000` en los dos casos.
- La única opción que cambió es `enabled`, que pasó del default `true` a ser el montaje condicional. `enabled` no forma parte de la key, y `usePagedQuery` sigue exigiendo `empresaId` internamente (`queryEnabled = enabled && Boolean(empresaId)`).

**B4:** eslint con 0 errores, tsc exit 0, y `grep "as Trip\['id'\]"` en TripDetailPanel no encuentra nada.

**B5, regla viva:**

```
=== con la linea temporal (src/shared/utils/orderNumber.ts):
export const x = 'a' as Trip['id'];
  26:25  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). ...  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
eslint exit 1
=== revertido:
git status --porcelain -- src/shared/utils/orderNumber.ts  -> (vacío)
eslint exit 0
```

**B6:**

- PENDIENTES #23 pasó a cerrado (se conserva el texto original).
- Actualicé el comentario de la regla en `eslint.config.js` y la enmienda 2026-10-09 de ADR-006, que ahora nombra la forma indexada.
- ARQUITECTURA no cambia: no hay archivos nuevos ni movidos (Gate 8).

**C, `v13`:**

- **C1:** `process.exit(1)` → `process.exitCode = 1` y `process.exit(0)` → `process.exitCode = 0` (las dos ramas del cierre). El diff son 2 líneas y no hay ningún otro cambio.
- **C2:** 20 corridas seguidas, con un tope de 60 s para detectar si alguna se colgaba:

| # | exit | ms | `UV_HANDLE_CLOSING` | OK |
|---|---|---|---|---|
| 1 | 0 | 264 | 0 | 24 |
| 2 | 0 | 171 | 0 | 24 |
| 3 | 0 | 166 | 0 | 24 |
| 4 | 0 | 168 | 0 | 24 |
| 5 | 0 | 171 | 0 | 24 |
| 6 | 0 | 164 | 0 | 24 |
| 7 | 0 | 167 | 0 | 24 |
| 8 | 0 | 168 | 0 | 24 |
| 9 | 0 | 174 | 0 | 24 |
| 10 | 0 | 172 | 0 | 24 |
| 11 | 0 | 174 | 0 | 24 |
| 12 | 0 | 183 | 0 | 24 |
| 13 | 0 | 173 | 0 | 24 |
| 14 | 0 | 169 | 0 | 24 |
| 15 | 0 | 166 | 0 | 24 |
| 16 | 0 | 190 | 0 | 24 |
| 17 | 0 | 185 | 0 | 24 |
| 18 | 0 | 169 | 0 | 24 |
| 19 | 0 | 168 | 0 | 24 |
| 20 | 0 | 167 | 0 | 24 |

  **20/20 exit 0** y ninguna colgada (máximo 264 ms). Sin `exit 127`. Antes del cambio, el assert aparecía en 4 de 12.
- **C3, scripts con el mismo patrón** (loader `register` + `process.exit` al final), **sin tocar**:
  - smoke: `avance-2026-09-30-lotes.smoke.mjs`, `tanda-15.smoke.mjs`, `tanda-24.smoke.mjs`;
  - verificación: `v-adr009-order-branch-links.mjs`, `v11-referential-integrity.mjs`, `v12-trips-referential-integrity.mjs`, `v14-tanda12-integrity.mjs`, `v15-tanda14-16-integrity.mjs`, `v16-avance-2026-09-30-integrity.mjs`, `v17-clientes-inactivos.mjs`, `v2-order-client-integrity.mjs`.

  Además, 16 smoke sin loader también terminan con `process.exit`.

**D:** PENDIENTES #24 (Baja), con el texto de la consigna, más su fila en la tabla resumen.

## Commits creados y qué se mergeó a lean

- `631e716` — Tanda 25.
- Un commit `docs:` con ESTADO y este reporte, más el merge `--no-ff` y el tag `post-`. Sus hashes están en el informe del chat.

## Decisiones que tomé sin consultar

1. **`TripLivePosition` vive en el mismo archivo y no se exporta.** "Del mismo módulo" lo permite, comparte `TRIP_LIVE_INTERVAL_MS` y `formatPosition` sin duplicar y sin archivo nuevo, y así no hay cambio de estructura (Gate 8).
2. **La condición de montaje mantiene el `isOpen` explícito**, aunque `SidePanel` ya devuelve `null` cerrado. Así refleja literalmente el `enabled` anterior y no depende de un detalle de `SidePanel`.
3. **`fallback={localTrip.posicionActual}`** como prop, para conservar el `livePosition ?? localTrip.posicionActual` original.
4. **C1 cambia los dos `process.exit`** del bloque final. El enunciado dice "el process.exit(n) final", y en el código son las dos ramas de ese cierre.
5. **El tope de 60 s en C2 (`timeout 60`)** sirve para detectar una corrida colgada. No es una forma de forzar la salida: ninguna llegó a usarlo.

## Hallazgos de la verificación

- **E1, Gate 5:** escaneé 212 exports. Sin (a) ni (b) siguen solo los 3 de `money.ts` (PENDIENTES #21). `TripLivePosition` tiene call-site real en `TripDetailPanel.tsx:241`.
- **E2, desde cero:**
  - árbol limpio y `package.json`/lockfiles con diff de 0 bytes;
  - `rm -rf node_modules && npm ci` exit 0 (206 paquetes);
  - tsc exit 0;
  - eslint con 0 errores y el mismo warning de la línea base;
  - build OK;
  - **28/28 scripts con exit 0, sin FAIL y sin `UV_HANDLE_CLOSING`**.

## Hallazgos MEDIO/BAJO documentados y no tocados

- **BAJO:** PENDIENTES #24, el rango de un preset fijo memoizado entre días.
- **Proceso:** 11 scripts más con loader y `process.exit` al final (C3). Pueden tener el mismo crash de libuv; en la pasada de E2 ninguno lo mostró.

## Riesgos introducidos

- **El subcomponente se desmonta y se vuelve a montar** al cerrar y abrir el panel, o cuando el viaje entra o sale de `EnTransito`. La key es la misma, así que TanStack Query reusa la caché y no hay parpadeo extra frente a antes, pero en ese momento el polling se reinicia desde cero.
- **`v13` con `exitCode`:** si un handle quedara abierto, el proceso no saldría solo. Hoy, en 20 corridas, no se colgó ninguna.

## Qué NO verifiqué

- Nada en el navegador.
- La rama de falla de `v13` (`process.exitCode = 1`): no tengo un dato roto para provocarla sin tocar mocks.

## Qué tiene que probar Leandro a mano, en orden de riesgo

El detalle está en `VERIFICACION_TANDA_25.md`.

1. Abrir y cerrar el panel varias veces: con el panel cerrado no tiene que quedar ninguna request de posición.
2. En un viaje En tránsito, la posición se ve y se actualiza cada 12 s.
3. En un viaje en otro estado, no aparece el bloque de posición ni hay requests.
4. Al marcar en tránsito desde el panel, aparece el bloque.

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-centinela-trip-2026-10-09 en lean>
```

El hash está en el informe final del chat.
