# REPORTE 2026-10-09 — Tandas 23 y 24: dinero, restos de la 22 y rango de fechas en la URL

> Verificado contra el filesystem el **2026-10-09**, en `lean` `7721eaf` + la rama `sesion-dinero-fechas-2026-10-09`. Si leés esto después, reverificá.

Rama `sesion-dinero-fechas-2026-10-09`, desde `lean` `7721eaf`. Tags `pre-sesion-dinero-fechas-2026-10-09` / `post-sesion-dinero-fechas-2026-10-09`. Las decisiones de la consigna vienen cerradas por Leandro.

## Preflight y línea base

`C:/proyectos/SDGPD`, `lean`, árbol limpio, `pull --ff-only` → "Already up to date" (`7721eaf`). Línea base:

- tsc exit 0.
- eslint con 0 errores y 1 warning (`PurchaseOrderFormModal.tsx:183`).
- build OK.
- 27 scripts sin FAIL.

En la pasada de la línea base, `v13-tanda11-integrity.mjs` salió con **exit 127**. La causa real: los 24 checks pasan y después Node crashea al salir.

```
Toda la integridad verificada paso.
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

Apareció en 4 de 12 corridas aisladas, y es un crash de libuv en Windows en el `process.exit(0)`. **Esto corrige el reporte de la Tanda 22**, que lo había atribuido a "un fallo del shell al lanzar node". No toqué el script (regla 2.5): queda como hallazgo.

## Qué hice, por tanda

### Tanda 23: PARCIAL (23.1, 23.3 y 23.4 hechos; 23.2 no hecho por condición de parada)

**23.1, re-export borrado: hecho.** El grep previo:

```
src/shared/components/ui/dateRangePresets.ts:8:import { toLocalDateString as toISODateString } from '@/shared/utils/date';
src/shared/components/ui/dateRangePresets.ts:44:export { toISODateString };
src/shared/components/ui/dateRangePresets.ts:54/61/65/70: (usos internos)
== imports desde dateRangePresets: ninguno trae toISODateString
```

Borré el re-export y su comentario. El import interno se conserva.

**23.2, cast por tipo indexado: NO HECHO (PARADA en 23.2c).**

- a) Selectores probados: `TSAsExpression > TSIndexedAccessType.typeAnnotation[indexType.literal.value=/^(id|[A-Za-z]+Id)$/]` y la variante dentro de `TSUnionType`.
- b) eslint antes del fix:
  ```
  C:\proyectos\SDGPD\FrontEnd\src\modules\logistics\components\TripDetailPanel.tsx
    119:113  error  Prohibido 'as <Tipo>Id' fuera de ids.types.ts (ADR-006). ...  no-restricted-syntax
  ✖ 2 problems (1 error, 1 warning)
  ```
  Marcó **exactamente** TripDetailPanel.tsx:119.
- c) **Parada.** `getTripPosition(query: PageQuery<TripPositionQueryFilters>)` exige `tripId: TripId` (`trips.service.ts:744-747`). Para modelar "no hay id todavía" como `undefined` hay que cambiar `TripPositionQueryFilters.tripId` a `TripId | undefined`, y eso es cambiar la firma de un service. El repo no tiene un patrón previo de id indefinido en `usePagedQuery`/`useLiveQuery`. Los dos que existen no sirven acá:
  - el centinela `empresaId ?? ''`, que es un string plano;
  - la clave `null` de `useCachedQuery`, que es otro hook.

  Inventar un adaptador local no es "el patrón que ya existe".
- d) Sin el fix, la regla extendida rompe lint. **Revertí 23.2a.** Hoy la regla no ve `as X['id']` (lo confirma V3). Registrado en PENDIENTES #23.

**23.3, dinero: hecho.**

Qué decían sobre negativos antes de tocar nada:

- **ADR-008:** su única mención es "saldos de cuenta corriente que se acumulan" (alternativa 2). No prohíbe negativos.
- **Header de `money.ts`:** nada.
- **`packages/contracts/src/money.ts`:** `amount: z.int()`, que admite negativos.

No había prohibición, así que se aplicó la regla de la consigna:

- a) `Money` admite negativos.
- b) `money()`: `Math.sign(c) * Math.round(Math.abs(c)) + 0`. Es simétrico (+100.5 → 101, −100.5 → −101) y el `+ 0` normaliza `-0`.
- c) `moneyFromNumber`: `principalToUnroundedCentavos(value)` en lugar de `value * 100`. Lanza si el valor no es finito.
- d) `parseMoneyInput` valida el string y delega en `moneyFromNumber`. Queda un solo camino de conversión.
- e) Smoke tanda-7: 40 OK (eran 30). Contra el `money.ts` de `HEAD`, **7 casos nuevos dan FAIL**: `-1.005`, la cancelación, `moneyFromNumber(1.005)`, NaN, Infinity, `multiplyMoney` negativo y `money` simétrico. Dos casos de la consigna **ya pasaban** con el código viejo, porque en V8 los dos productos caen del lado correcto: `moneyFromNumber(8.345)` (`8.345 * 100` = `834.5000000000001`) y `0.1 + 0.2`. `-10` → −1000 también pasaba (`Math.round(-1000)`).
- f) Impacto en el tablero (ver abajo): **cero diferencias**.
- g) ADR-008, enmienda 2026-10-09, con el texto de la consigna.

**23.4, PENDIENTES: hecho.**

- #21: sin la nota de `moneyFromNumber`.
- #22: las 28 llamadas a `httpClient.request<T>`, con archivo:línea. Agregué `pod.service.ts:63`, que tiene el mismo caso aunque no estaba en la lista pedida.
- #23: el centinela, por la parada de 23.2.

#### Diff de totales del tablero (23.3.f)

Script descartable (no commiteado). Llama a la función real `getOverdueTotalsInMoney` contra el mock, con el loader de `v17`:

```
ANTES (money.ts de 7721eaf)                      DESPUES
emp-001 ARS origen=1608000 centavos=160800000    emp-001 ARS origen=1608000 centavos=160800000
emp-001 USD origen=1000 centavos=100000          emp-001 USD origen=1000 centavos=100000
  bucket ARS 1-30  totalOverdue=290000             (idem)
  bucket ARS 31-60 totalOverdue=421000             (idem)
  bucket ARS 61-90 totalOverdue=327000             (idem)
  bucket ARS 90+   totalOverdue=570000             (idem)
  bucket USD 61-90 totalOverdue=1000               (idem)
$ diff dash_before.txt dash_after.txt  -> exit 0, sin diferencias
```

Ningún total cambió: todos los orígenes son enteros, así que no hay casos de mitad exacta. `moneyFromNumber` es el único camino del módulo hacia la UI, y `formatMoney` no redondea.

### Tanda 24: HECHA

#### 24.1, auditoría

**a) Qué escribe en la URL un preset fijo.**

- `DateRangeFilter.tsx:42` emite `onChange({ preset, ...computeDateRangeForPreset(preset) })`, es decir, el preset **más** `dateFrom`/`dateTo` calculados.
- Los 5 `setDateRange` escriben `preset` (salvo el default), `from` y `to` tal cual. Están en `LogisticsPage.tsx:82-88`, `ComprasPage.tsx:164-170`, `TabPendingReceipt.tsx:86-92`, `ClientAccountsTable.tsx:66-72` y `ClientOverdueTable.tsx:81-87`.

Resultado: con un preset fijo, la URL queda **con preset + from + to**, y las fechas quedan congeladas al día en que se eligió.

**b) Rango efectivo que le llega al service**, con hoy = 2026-10-09. Lo obtuve con un script descartable que reproduce literalmente las dos derivaciones vigentes en `7721eaf` (Logística :73-79 y los otros 4) con la `defaultDateRangeValue` real:

| Caso | Logística (default `today`) | Compras / Pendientes / Cuentas Corrientes / Morosos (default `all`) |
|---|---|---|
| 1. sin parámetros | Hoy · 10-09..10-09 | Todos · sin rango |
| 2. `?preset=thisMonth` | Este mes · 10-01..10-09 | **BUG:** dice "Este mes", **no filtra** |
| 3. `?preset=thisMonth&from=2026-09-01&to=2026-09-30` | **BUG:** dice "Este mes", filtra **septiembre** | **BUG:** dice "Este mes", filtra **septiembre** |
| 4. `?preset=custom&from&to` | Personalizado · from..to | Personalizado · from..to |
| 5. `?from&to` sin preset | **BUG:** dice "Hoy", filtra from..to | **BUG:** dice "Todos", filtra from..to |

**c)** Hay bugs, así que la tanda siguió.

#### 24.2, implementación

- **Helper compartido** en `dateRangePresets.ts`:
  - `readDateRangeFromUrl(params, defaultPreset, today = new Date())`
  - `dateRangeToUrlParams(value, defaultPreset)`
  - `defaultDateRangeValue` acepta un `today` opcional.
- **Los 5 listados** pasan a usar los dos helpers. LogisticsPage tiene una constante `LOGISTICS_DEFAULT_DATE_PRESET = 'today'`; el resto usa `'all'`.
- **Casts eliminados:** se fueron 5 casts del preset que venía de la URL (`as DateRangePreset` / `as DateRangeValue['preset']`). Ahora el preset se valida con el guard privado `isDateRangePreset`.
- **Ningún listado** tuvo una necesidad distinta. `OrdersPage` no es uno de los 5: no tiene presets, solo dos inputs `from`/`to`, y no se tocó.

#### 24.3, smoke

`scripts/smoke/tanda-24.smoke.mjs`, con 29 casos y `today` inyectado. Cubre:

- los 5 casos de 24.1.b con los dos defaults reales;
- el link viejo;
- custom → fijo limpia `from`/`to`;
- un preset inválido;
- `preset=all` con fechas;
- ida y vuelta;
- cruce de mes, de trimestre y de año.

#### 24.4, documentación

La regla que gobierna el estado en URL es **PROTOCOLO 3.8**. No existe un ADR de estado en URL: solo ADR-009 la menciona, y para el alcance del tablero. La enmienda 2026-10-09 va en 3.8, con el texto de 24.2. También corregí los comentarios de `dateRangePresets.ts` y de `LogisticsPage`.

## Commits creados y qué se mergeó a lean

- `6dead64` — Tanda 23.
- `210eac8` — Tanda 24.
- Un commit `docs:` con ESTADO y este reporte, más el merge `--no-ff` y el tag `post-`. Sus hashes están en el informe del chat (este archivo se escribe antes de crearlos).

## Decisiones que tomé sin consultar

1. **Selector indexado más amplio que la consigna** (`'id'` o cualquier clave terminada en `Id`, por ejemplo `['tripId']`), porque esas claves también son ids branded. Igual quedó revertido por la parada de 23.2.
2. **Seguir con 23.1, 23.3, 23.4 y la Tanda 24 después de la parada de 23.2c**, y revertir solo 23.2a. La parada de la consigna está acotada al fix, y lo demás no depende de él (PROTOCOLO §5: revertir lo que falla y seguir con lo independiente).
3. **`preset=all` con `from`/`to`: las fechas se ignoran**, igual que con un preset fijo. La regla dice "from/to van SOLO con preset=custom".
4. **Un preset inválido en la URL se trata como ausente.** Si hay fechas, cuenta como custom; si no, rige el default del listado.
5. **`useMemo` con dependencias primitivas** (`preset`/`from`/`to` desestructurados). Hice esto porque no confirmé si `urlState.filters` mantiene la misma identidad entre renders.
6. **PENDIENTES #22 incluye `pod.service.ts:63`**, aunque no estaba en la lista pedida.
7. **PENDIENTES #23** registra el bloqueo de 23.2.
8. **No sumé una fila en DECISIONES_TECNICAS** por la enmienda de PROTOCOLO 3.8, porque ese índice lista ADRs y decisiones, no reglas del protocolo. Sí actualicé la fila de ADR-008.

## Verificación adversarial

- **V1, Gate 5:** escaneé 212 exports. Sin (a) ni (b) quedan solo `sumMoney`, `multiplyMoney` y `parseMoneyInput` (PENDIENTES #21). `defaultDateRangeValue` cumple (b) vía `readDateRangeFromUrl`. Los dos helpers nuevos tienen call-site en los 5 listados (`ClientAccountsTable.tsx:60/65`, `ClientOverdueTable.tsx:76/81`, `TabPendingReceipt.tsx:81/86`, `ComprasPage.tsx:159/164`, `LogisticsPage.tsx:76/81`).
- **V2:** `grep -rnE "filters\.(from|to)\b|filters\.preset\b"` encuentra solo `OrdersPage.tsx:103,105,126,127,129`, que no es uno de los 5 (sin presets). Dentro de los 5 nadie lee `from`/`to` fuera del helper: solo los desestructuran para pasárselos.
- **V3: FALLA, como se esperaba por la parada.** Con `'a' as Trip['id']` temporal en `orderNumber.ts`, eslint da **exit 0**: la regla no lo ve porque 23.2a se revirtió. El control `'a' as OrderId` da exit 1 (`26:25 error … no-restricted-syntax`). Revertí y `git status` quedó vacío.
- **V4:**
  - La key es `pagedQueryKey` = `['paged', queryName, empresaId, filters, sort, page, pageSize]` (`queryKeys.ts:42`, `usePagedQuery.ts:202-208`).
  - En los 5 listados, `filters` lleva `dateFrom: dateRange.dateFrom`/`dateTo: dateRange.dateTo`, y su `useMemo` depende de `dateRange` (Logística :94-97, Compras :302-305, Pendientes :90-91, Cuentas :69-70, Morosos :89-92).
  - `dateRange` depende de `preset`/`from`/`to`. Al cambiar de preset cambia la key y hay refetch.
- **V5, desde cero:**
  - árbol limpio y `package.json`/lockfiles con diff de 0 bytes;
  - `rm -rf node_modules && npm ci` exit 0 (206 paquetes);
  - tsc exit 0;
  - eslint con 0 errores y el mismo warning de la línea base;
  - build OK;
  - **28/28 scripts con exit 0 y sin FAIL**: tanda-7 da 40 OK y tanda-24 da 29 OK. En esta pasada no apareció el crash de libuv.

## Hallazgos MEDIO/BAJO documentados y no tocados

- **BAJO:** el centinela `'' as Trip['id']` (PENDIENTES #23). Es inofensivo, porque la consulta está deshabilitada sin viaje.
- **MEDIO hoy, ALTO al conectar:** las respuestas sin validar de `httpClient` en logística, vehículos y choferes (PENDIENTES #22).
- **Proceso:** el crash de libuv al salir de `v13` (intermitente, la lógica en verde).
- **BAJO:** "hoy" se calcula al renderizar (`useMemo` por preset/from/to). Una pestaña abierta que cruza la medianoche sigue mostrando el rango del día anterior hasta que cambie la URL. Es el mismo comportamiento que tenía Logística antes.

## Riesgos introducidos

- **Links guardados con preset fijo y fechas** (los que generaba la versión anterior) ahora filtran por el período **actual**, no por el guardado. Es lo que pide la regla, pero cambia lo que el usuario ve.
- **Links con `from`/`to` sin preset** ahora muestran "Personalizado". Antes mostraban "Hoy" o "Todos" con otro rango.
- **`money()` cambia en mitades negativas exactas** (−100.5 → −101; antes −100). Hoy ningún consumidor de producción pasa negativos (el tablero suma deuda, siempre ≥ 0).

## Qué NO verifiqué

- Nada en el navegador.
- El comportamiento de Atrás/Adelante: lo deduje de que la URL es la fuente de verdad, pero no lo vi.

## Qué tiene que probar Leandro a mano, en orden de riesgo

1. **T24:** en los 5 listados, elegir cada preset y mirar la URL: sin `from`/`to`, salvo en Personalizado.
2. **T24:** pegar a mano el link de septiembre con `preset=thisMonth` y comprobar que filtra por el mes actual.
3. **T24:** Personalizado conserva las fechas al recargar.
4. **T24:** Atrás/Adelante respetan el filtro.
5. **T23:** los totales del tablero se ven igual.
6. **T23:** el detalle de un viaje abre y carga.
7. **T23:** sin viaje seleccionado no hay errores ni consultas de posición.

El detalle está en `VERIFICACION_TANDA_23.md` y `VERIFICACION_TANDA_24.md`.

## Decisiones pendientes (necesitan a Leandro)

1. **23.2:** ¿cómo se saca el centinela de `TripDetailPanel.tsx:119`? Opciones:
   - (a) aceptar el cambio de firma `TripPositionQueryFilters.tripId: TripId | undefined`, con `getTripPosition` lanzando o devolviendo vacío si falta;
   - (b) montar la consulta de posición en un subcomponente que solo se renderiza con un viaje, sin cambiar firmas;
   - (c) dejarlo así (inofensivo).

   Con (a) o (b), la extensión de la regla de ESLint se reaplica tal como quedó probada.

## Cómo revertir el merge de un solo comando

```
git revert -m 1 <hash del merge de sesion-dinero-fechas-2026-10-09 en lean>
```

El hash está en el informe final del chat.
