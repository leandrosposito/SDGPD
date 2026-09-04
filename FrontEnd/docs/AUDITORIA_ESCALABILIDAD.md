# Auditoría de Escalabilidad — SDGPD Frontend

**Fecha:** 2026-09-03
**Commit auditado:** `6a5610d` (rama `lean`, working tree limpio)
**Alcance:** solo diagnóstico, sin cambios de código (ver reglas base de la tarea). Todas las rutas son relativas a `FrontEnd/` salvo que se indique lo contrario.

**Cómo leer este documento:** el proyecto mantiene su propio registro de decisiones técnicas en `docs/DECISIONES_TECNICAS.md` (788 líneas a la fecha de esta auditoría), que ya documenta con mucho detalle — y con verificación en navegador — buena parte de los ejes A y B para los 6 listados migrados a paginación server-side (Compras, Pendientes de Recepción, Bajo Stock Mínimo, Logística, Cuentas Corrientes, Clientes Morosos). Esta auditoría **verificó contra el código real** cada afirmación de ese documento que cita como evidencia, y extiende la cobertura a los ejes que ese documento no trata (C, D3, D4, E) y a los módulos que quedan fuera de su alcance (orders, cash, analytics, settings, suppliers, directorio de clientes, y 6 de las 9 tabs de inventory).

---

## A. Datos y Red

### A1 — Contrato de fetching: `usePagedQuery`

Único hook de fetching paginado del proyecto: `src/shared/hooks/usePagedQuery.ts` (177 líneas). Tipos del contrato en `src/shared/types/pagination.types.ts`.

**Firma:**
```ts
usePagedQuery<TItem, TFilters, TSort extends string = string, TAggregates = undefined>(
  fetchPage: (query: PageQuery<TFilters, TSort>) => Promise<PageResult<TItem, TAggregates>>,
  filters: TFilters,
  options?: { pageSize?: number; sort?: PageSort<TSort>; enabled?: boolean }
): { items, aggregates, page, pageSize, totalItems, totalPages, sort, isLoading, isFetching, error, setPage, setPageSize, setSort, refetch }
```

**Qué hace** (`usePagedQuery.ts:93-158`):
- Dispara el fetch en un `useEffect` con `[fetchPage, trackedFilters, sort, page, pageSize, enabled, refetchToken]` como dependencias.
- Descarta respuestas fuera de orden con un flag `cancelled` en el cleanup del efecto (`usePagedQuery.ts:95,120-122`) — **no es cancelación de red real** (ver A3).
- Vuelve a página 1 cuando cambia `filters` **por referencia** (`usePagedQuery.ts:86-91`) — exige que el llamador memoice `filters` con `useMemo`; si no lo hace, cada render dispara un reset de página y un fetch nuevo.
- `isFetching` se marca `true` en manejadores de evento (`setPage`, `setPageSize`, `setSort`, `refetch`) y durante el render (cambio de filtros), nunca dentro del cuerpo del efecto — evita la regla de lint `react-hooks/set-state-in-effect`.
- El total y los agregados (`aggregates`) los calcula el origen de datos, nunca el hook ni el componente.

**Qué NO hace** (ninguno de estos mecanismos existe en el hook ni en ningún otro lugar del proyecto — verificado por grep de `cache`, `AbortController`, `stale`, `retry`, `dedupe` sobre todo `src/`):
- **Sin cache entre componentes/rutas.** Cada `usePagedQuery` tiene su propio estado local (`useState`); navegar fuera y volver a montar el componente repite el fetch desde cero, incluso si los filtros no cambiaron.
- **Sin dedupe de requests concurrentes.** Si dos componentes llamaran a `fetchPage` con los mismos parámetros, se disparan dos fetches independientes.
- **Sin invalidación cruzada.** El único mecanismo de "refrescar tras mutar" es `refetch()` llamado explícitamente por quien tiene el hook montado (P10, ver `DECISIONES_TECNICAS.md` línea 385-390). Está documentado como limitación conocida (`DECISIONES_TECNICAS.md:480`) que crear/editar un cliente no refresca `ClientAccountsTable`/`ClientOverdueTable` si ya están montadas en otra pestaña.
- **Sin stale-while-revalidate.** Mientras `isFetching` es `true`, se muestra la data anterior atenuada (`FetchingOverlay`) — es SWR *visual*, pero no hay revalidación en segundo plano ni background refetch por intervalo/focus.
- **Sin reintentos.** Un error de red pone `error` y listo; no hay backoff ni retry automático (ver D4).

**Alcance real:** solo 6 consumidores en todo el proyecto usan `usePagedQuery` (ver A2). El resto de los listados (16 de 22 vistas con listas, ver A2) no pasan por este contrato en absoluto.

### A2 — Paginación: censo completo de listados

| Módulo / vista | Mecanismo | Registros en mock hoy | Evidencia |
|---|---|---|---|
| Compras — listado general | `usePagedQuery` server-side | 34 (`purchaseOrders.data.ts`) | `src/modules/compras/ComprasPage.tsx` |
| Compras — Pendientes de Recepción | `usePagedQuery` server-side | subset de 34 | `src/modules/compras/components/TabPendingReceipt.tsx` |
| Inventario — Bajo Stock Mínimo | `usePagedQuery` server-side | ~13 en déficit | `src/modules/inventory/components/TabLowStock.tsx` |
| Logística — Entregas del Día | `usePagedQuery` server-side | 18 (`logistics.data.ts`) | `src/modules/logistics/LogisticsPage.tsx` |
| Clientes — Cuentas Corrientes | `usePagedQuery` server-side | 30 (`clients.data.ts`) | `src/modules/clients/components/ClientAccountsTable.tsx` |
| Clientes — Clientes Morosos | `usePagedQuery` server-side | 22 con deuda vencida | `src/modules/clients/components/ClientOverdueTable.tsx` |
| Clientes — Directorio | **Sin paginar.** Trae TODO (`fetchClients()`, sin filtros de servidor) y filtra/busca en memoria (`ClientsPage.tsx`, `useMemo` sobre `clients`) | 30, trae el 100% de una sola vez | `src/modules/clients/ClientsPage.tsx:46-48,129`; `src/services/mock/clients.service.ts:43-46` (`fetchClients` no acepta ningún parámetro) |
| Pedidos (`orders`) | **Sin paginar y sin service.** `OrdersPage.tsx` importa `ORDERS_MOCK_DATA` directo y renderiza todo vía `Table` | 41 líneas de mock (~pedidos) | `src/modules/orders/OrdersPage.tsx:2`; sin ningún hit de `usePagedQuery`/`Pagination`/`.slice(` en el archivo |
| Proveedores (`suppliers`) | **Sin paginar y sin service dedicado a listado** (usa `fetchSuppliers`, que trae todo) | 11 líneas de mock (~3 proveedores + detalle) | `src/modules/suppliers/SuppliersPage.tsx`; sin `usePagedQuery`/`Pagination` |
| Caja (`cash`) | **Sin paginar.** `CASH_MOCK_DATA` importado directo | 15 líneas de mock | `src/modules/cash/CashPage.tsx:2`; sin `usePagedQuery`/`Pagination` |
| Analítica (`analytics`) | **Sin paginar** (gráficos + tablas top-N sobre `ANALYTICS_DATA` completo) | 13 líneas de mock | `src/modules/analytics/AnalyticsPage.tsx:2` |
| Configuración (`settings`) — usuarios/roles, suscripción, auditoría | **Sin paginar**, 3 archivos leen `settings.data.ts` directo | 16 líneas de mock repartidas en 3 arrays | `src/modules/settings/components/tabs/TabSubscription.tsx:2`, `TabUsersRoles.tsx:2`, `widgets/AuditLogWidget.tsx:2` |
| Inventario — Stock Actual | Async vía servicio (`getStockedProductsForBranch`), **sin paginar**: trae el catálogo completo de la sucursal | 18 productos | `src/modules/inventory/components/TabStockCurrent.tsx` |
| Inventario — Reposición (`TabPurchases`) | Client-side sobre `INVENTORY_MOCK_DATA.suggestions` filtrado por `branchId` en el componente | pocas decenas | `src/modules/inventory/InventoryPage.tsx:138` |
| Inventario — Categorías | Sin paginar, datos estáticos del mock | variable | `src/modules/inventory/components/TabCategories.tsx` |
| Inventario — Movimientos | Sin paginar, datos estáticos del mock | variable | `src/modules/inventory/components/TabMovements.tsx` |
| Inventario — Historial del Producto | Sin paginar, datos estáticos del mock | variable | `src/modules/inventory/components/TabProductHistory.tsx` |
| Inventario — Listas de Precios | Sin paginar, datos estáticos del mock | variable | `src/modules/inventory/components/TabPriceLists.tsx` |
| Inventario — Lotes | Sin paginar. No es una tab propia de `InventoryPage` (no tiene `id`/`label` en la lista de 9 tabs) — es un panel lateral (`SidePanel`) que se abre desde "Stock Actual" sobre un producto puntual | variable | `src/modules/inventory/components/ProductLotsPanel.tsx` (montado en `InventoryPage.tsx:299`) |
| Inventario — Ajustes de Stock | Sin paginar; formulario decorativo (búsqueda de producto por código de barras sin conectar, solo `console.log`), no un listado con filas de datos | N/A (no lista, es un formulario) | `src/modules/inventory/components/TabAdjustments.tsx` |
| Inventario — Importar / Exportar | Sin paginar; dos botones decorativos sin `onClick` ("Exportar Inventario (CSV)"/"Exportar Lista de Precios"), no un listado con filas de datos | N/A (no lista, es una zona de carga de archivos) | `src/modules/inventory/components/TabImportExport.tsx` |

**Resumen:** de 22 vistas identificadas en `inventory`+el resto de módulos, **6 usan paginación server-side** (`usePagedQuery`), **0 usan un `usePagination` client-side** (ese hook existió y se eliminó explícitamente al migrar a `usePagedQuery` — `DECISIONES_TECNICAS.md:369-370` — no quedó ningún consumidor client-side paginado), y **16 no paginan en absoluto**: traen el dataset completo (ya sea síncrono desde `data/mock/*` o async sin parámetros de página) y lo renderizan entero con el componente `Table` compartido u otro markup ad-hoc.

**Corrección (Tanda 1, Paso 0b):** de esas 16, 2 no son estrictamente "listas/tablas" — `TabAdjustments.tsx` (Ajustes de Stock) es un formulario de una sola búsqueda, y `TabImportExport.tsx` es una zona de carga de archivos con dos botones decorativos; ninguna de las dos renderiza el componente `Table` ni tiene filas de datos que paginar. Quedan como "16 vistas sin paginar" en sentido amplio (ninguna trae datos por página desde un servicio), pero solo 14 de ellas son listados de filas en el sentido estricto de A2/C1. `ProductLotsPanel.tsx` ("Lotes") tampoco es una tab de nivel superior de `InventoryPage` — es un panel lateral que se abre desde "Stock Actual" sobre un producto puntual, pero sí renderiza `Table` (lista los lotes de ese producto) y sí cuenta como listado sin paginar.

Con datasets mock de 10-40 registros esto es invisible. El propio `DECISIONES_TECNICAS.md` (E1, línea 270) ya modela el caso de 50.000 productos × 40 sucursales = 2.000.000 de filas de stock como el escenario de diseño — ninguno de los 16 listados no migrados sobreviviría a un dataset de ese orden sin romper la pestaña del navegador (todo el array en memoria + un `.map()` sin virtualizar, ver C1).

### A3 — Cancelación de requests

**No existe `AbortController` ni `signal` en ningún archivo del proyecto** (`grep -rn "AbortController\|signal" src` → 0 resultados).

El patrón usado universalmente es una bandera booleana en el cleanup del efecto:
```ts
useEffect(() => {
  let cancelled = false
  fetchX().then(r => { if (!cancelled) setState(r) })
  return () => { cancelled = true }
}, [...])
```
Presente en `usePagedQuery.ts:95,120-122`, `shared/hooks/useDashboard.ts`, `InventoryPage.tsx`, `ClientsPage.tsx`, `OrdersPage.tsx`, `SuppliersPage.tsx`, `PurchaseOrderDetailPanel.tsx`, `StockAdjustmentModal.tsx`, `ComprasPage.tsx` (13 archivos en total, ver listado del grep de `cancelled`).

**Qué resuelve:** evita que una respuesta tardía pise el estado con datos de una consulta que ya no es la vigente (race condition de UI) — correcto y suficiente para el propósito de consistencia visual.

**Qué NO resuelve:** el request HTTP real sigue en vuelo hasta que el servidor responde — no se libera la conexión, no se cancela el trabajo del backend, no se reduce tráfico. Con búsquedas debounced (`useDebouncedValue`, 300ms, `ClientsPage.tsx` — ver M6 en `DECISIONES_TECNICAS.md:470-473`) el debounce ya evita la mayoría de los requests innecesarios en el cliente, pero cualquier fetch que sí se dispare y quede obsoleto (cambio de página rápido, cambio de filtro antes de que resuelva el anterior) sigue consumiendo ancho de banda y cómputo de servidor sin necesidad. Con un backend real y alto volumen de usuarios esto es tráfico y carga de servidor evitable — no es solo un detalle interno del hook.

**Race conditions identificadas y ya cubiertas por este patrón:** todos los `usePagedQuery` (6 vistas) y `useDashboard`. **Race condition identificada y NO cubierta:** `OrderProductsSection.tsx` — el `await` del escaneo de código de barras puede recibir una respuesta tardía fuera de orden si el usuario escanea/tipea rápido; está documentado como deuda técnica conocida y no resuelta (`DECISIONES_TECNICAS.md:406,647`).

### A4 — Cómputo pesado en cliente

**Hallazgo principal — imputación FIFO de Clientes Morosos** (`src/services/mock/clients.service.ts`):
- `imputeOpenInvoices` (línea 238): recorre y ordena **todas** las transacciones de un cliente por fecha de emisión, y aplica un pool de pagos/créditos por moneda (`Map<Currency, number>`) contra cada factura, en orden.
- `computeOverdueSnapshot` (línea 344): llama a `imputeOpenInvoices` para **cada cliente** del dataset completo — no del filtrado, no de la página — para calcular tramos de aging (`bucketForDays`, línea 199) sobre facturas vencidas.
- **Cacheado** (línea 378, `getOverdueSnapshot`) por referencia de `clientsStore` + día calendario (`currentDayKey`, línea 374) — recalcula solo cuando cambian los datos crudos o cruza la medianoche, no en cada request de página. Esto es correcto y está bien razonado (`DECISIONES_TECNICAS.md:448-468`), pero **el costo del primer cálculo (o el de después de cualquier mutación) sigue siendo O(clientes × transacciones-por-cliente)**, ejecutado sincrónicamente en el hilo principal del navegador — no en un worker, no en el servidor.
- **Estimación con 100k registros:** si cada uno de 100.000 clientes tiene en promedio 10-20 transacciones históricas, la primera imputación tras un cambio de día o de dato recorre 1-2 millones de transacciones en un solo `reduce`/`sort`/`filter` encadenado, en el hilo principal — con alta probabilidad de bloquear la UI (jank perceptible o un frame largo que dispara "página no responde" en navegadores lentos) durante ese cálculo. El propio archivo de decisiones ya reconoce que esto no se probó con un dataset grande (`DECISIONES_TECNICAS.md:502`).

**Segundo hallazgo — agregados de aging y moneda:** `buildOverdueRow` (línea 304) hace un `reduce` para encontrar la factura más vieja y agrupa por moneda con `sort`+`map` (líneas 314-330) — por cliente, dentro del loop de `computeOverdueSnapshot`. Mismo costo O(n) ya contado arriba, no es un costo adicional aparte.

**Tercer hallazgo — filtro/orden/paginado post-cache:** `getOverdueClientsPage` (línea 503) y `exportOverdueClients` (línea 542) filtran (`.filter`, líneas 511,518,549,550) y ordenan (`sortOverdueEntries`, línea 446) el snapshot ya cacheado en cada request — esto sí es O(clientes-morosos), barato incluso a 100k (recorre como mucho el subconjunto con deuda vencida, no las transacciones).

**Otros reduce/loop sobre colecciones completas, menor severidad:**
- `products.service.ts#getStockedProductsForBranch`/`getLowStockForBranch` — join en memoria (`Map`) de `productsStore` × `stockStore`, tamaño acotado por el catálogo de una sucursal (documentado en E1/E4, `DECISIONES_TECNICAS.md:261-296`; con 50k productos × 1 sucursal esto ya es un `Map` de 50k entradas por request, sin cache).
- `TabPurchases.tsx` (O9, `DECISIONES_TECNICAS.md:629`): dos `.find()` sucesivos sobre `products`/`suppliers` completos por cada sugerencia — O(n) por click, sin índice `Map`, a diferencia del resto del proyecto que sí usa `Map` para joins (nota explícita de "por qué no aplica" en `clients.service.ts` línea 494, pero `TabPurchases` no tiene esa nota y sí tiene el patrón `find` sin `Map`).
- El **export a Excel/CSV** (`ExportButton.tsx`, Tarea C, `DECISIONES_TECNICAS.md:781-784`): trae hasta `MAX_EXPORT_ROWS = 10.000` filas al cliente y arma el archivo en el navegador (`XLSX.utils.json_to_sheet`) — documentado explícitamente como deuda técnica a migrar a generación server-side.

**Regla que sí se respeta de forma sistemática:** ningún componente de los 6 migrados calcula un total/conteo/promedio sobre `items` (la página ya paginada) — todos los agregados vienen resueltos del `aggregates` del `PageResult` (P3, verificado por lectura de `DeliveryAggregates`, `OverdueClientsAggregates`, `PurchaseOrdersAggregates`). Es la disciplina correcta; el problema de A4 está *antes* de la paginación (el cálculo del snapshot completo), no en el paginado en sí.

---

## B. Aislamiento Multi-Tenant

### B1/B2 — Stores de Zustand y registro central de reset

**El proyecto tiene exactamente 2 stores de zustand**, verificado por `grep -rn "= create<" src` (no hay ningún otro; un store anterior, `useDeliveriesStore`, se eliminó por completo al migrar logistics a paginación server-side — `DECISIONES_TECNICAS.md:390`, confirmado por ausencia total del archivo):

| Store | Ubicación | Registrado en `resettableStores.ts` | Datos de negocio | Riesgo si no se resetea |
|---|---|---|---|---|
| `useSessionStore` | `src/shared/state/useSessionStore.ts` | **No** (por diseño — es la fuente de verdad de sesión/sucursal, no un consumidor a resetear) | `session` (empresa+usuario+sucursales), `activeBranchId` | N/A — este store es el que *dispara* el reset de los demás (`setActiveBranch`, línea 87-105, llama a `resetAllStores()` en la línea 102) |
| `useReplenishmentStore` | `src/modules/inventory/state/useReplenishmentStore.ts` | **Sí** (`useReplenishmentStore.ts:58`) | `statusByProductId: Record<string, ReplenishmentStatus>` — solicitudes de reposición en memoria | Bajo — ya registrado y verificado (`DECISIONES_TECNICAS.md:244`: cambio de sucursal Sur→Norte→Sur resetea correctamente) |

**Mecanismo:** `src/shared/state/resettableStores.ts` (36 líneas) — un array de funciones `ResetFn` poblado por `registerResettableStore()`, invocado en bloque por `resetAllStores()` desde `useSessionStore#setActiveBranch`. Evita que `shared/` importe stores de `modules/` (dirección de dependencia del proyecto: `modules/` → `shared/`, nunca al revés).

**Riesgo actual: BAJO.** Con solo 2 stores, ambos contabilizados (uno no necesita reset, el otro ya está registrado), no hay ningún store de zustand hoy que filtre por sucursal y pueda quedar con datos pegados de una sucursal anterior. **Esto es un hallazgo de proceso, no solo de estado actual:** el mecanismo depende de que cada desarrollador nuevo copie la línea `registerResettableStore(...)` al crear un store — no hay ningún lint/test que lo fuerce (documentado como "evidente por convención", `DECISIONES_TECNICAS.md:242`, pero no verificado por tooling). El primer store nuevo que se olvide de esa línea será indistinguible en el código de uno que sí la tiene, hasta que alguien lo note manualmente cambiando de sucursal.

**Nota — estado que NO es de zustand y por lo tanto está fuera de `resettableStores`:** el estado local (`useState`) de cada página que arrastra datos entre navegaciones de sucursal sin refetch — ver B3 (`InventoryPage.tsx:138`, filtro client-side de `suggestions` que si viniera de un fetch inicial "todas las sucursales" quedaría desactualizado; hoy es seguro porque `INVENTORY_MOCK_DATA.suggestions` es estático, pero es el mismo patrón de riesgo si mañana se sirve de una API).

### B3 — Filtrado client-side por sucursal/empresa/tenant

Búsqueda exhaustiva de filtros de sucursal aplicados sobre datos ya traídos al cliente (candidatos a mover al servidor):

- **`InventoryPage.tsx:138`** — `INVENTORY_MOCK_DATA.suggestions.filter((s) => s.branchId === activeBranchId)`. Único caso real de filtrado client-side por sucursal sobre una colección de negocio. Hoy inofensivo porque el mock completo (`suggestions`) ya está en memoria de todas formas (no hay servicio que lo traiga por sucursal); con un backend real esto debería ser un parámetro de query, igual que ya lo es en `getLowStockForBranch`/`getStockedProductsForBranch` del mismo módulo.
- **Ningún otro caso de filtrado client-side por `branchId` existe** en `src/modules` fuera de esta línea (`grep` de `branchId` combinado con `.filter`/`===` sobre todo `src/modules` → un solo resultado adicional, que es la declaración del filtro tipado en `TabLowStock.tsx:49`, ya resuelto server-side).
- **Filtrado client-side genérico (no por sucursal) en las 16 vistas no migradas de A2** — el Directorio de Clientes, Pedidos, Proveedores, Caja, Analítica y Configuración filtran/buscan sobre el array completo ya en memoria (ej. `ClientsPage.tsx` con `filteredClients` vía `useMemo` sobre `zone`/`seller`/`status`/`searchQuery`). No es un problema de aislamiento multi-tenant en sí, pero es la misma clase de trabajo (filtrar en el cliente) que ya se identificó como no escalable en A2/A4 y que sí importa para B si algún día alguno de esos filtros pasara a ser un criterio de sucursal/empresa.

**No hay ningún filtrado client-side por *empresa*** — coherente con B4: la empresa nunca llega al frontend como una colección de la que filtrar, así que no hay nada que filtrar en el cliente por ese eje.

### B4 — Concepto de "empresa" (tenant)

**Existe `Company` únicamente como dato descriptivo de sesión, nunca como filtro:**
```ts
// shared/types/session.types.ts:17,26
interface Company { id: string; name: string; ... }
interface SessionUser { company: Company; branches: Branch[]; ... }
```
Se muestra en `BranchSelector.tsx` (nombre de la empresa junto al selector de sucursal) y no se usa para nada más. **Ningún tipo de dominio tiene un campo `tenantId`/`empresaId`/`companyId`** — verificado por `grep -rn "tenantId\|empresaId\|companyId" src` → 0 resultados en todo el proyecto, incluidos `Delivery`, `InventoryItem`, `ClientAccount`, `PurchaseOrder`, `Order`, `Supplier`.

Esta decisión es explícita y está documentada con su razonamiento de seguridad (`DECISIONES_TECNICAS.md:219-220,233`): el aislamiento entre empresas se delega enteramente al backend vía sesión/token — si `empresaId` fuera un parámetro que el frontend pudiera manipular (aunque fuera de solo lectura hoy), sería una superficie de IDOR el día que exista un backend real que confiara en un valor recibido del cliente en vez de derivarlo de la sesión autenticada. Misma nota de seguridad para `branchId`, que sí viaja como parámetro explícito a los servicios (D4/D5 de esa entrada): es una conveniencia de UI, no una autorización — el backend deberá validar siempre que la sucursal recibida pertenezca a la empresa de la sesión, no confiar en que el frontend "solo pide lo que le corresponde".

**Qué falta para soportar múltiples empresas de verdad (más allá de "es responsabilidad del backend"):**
1. No hay ningún mecanismo de *selección* de empresa en la UI — el modelo actual asume un usuario pertenece a una sola empresa (`SessionUser.company: Company`, singular, no `companies: Company[]`). Un caso de uso real de "un usuario con acceso a varias empresas" (ej. un contador que gestiona varios clientes SDGPD) no tiene ningún lugar en el tipo actual.
2. No hay ningún dato mock de una *segunda* empresa — `session.mock.ts` (no revisado línea por línea en esta auditoría, pero confirmado por el único `Company` referenciado en `SessionUser`) no ejercita el caso de cambio de empresa, solo cambio de sucursal dentro de una empresa. El camino de "cambiar de sucursal" está verificado en el navegador (D7, `DECISIONES_TECNICAS.md:249`); el de "cambiar de empresa" no existe ni como UI ni como dato de prueba.

---

## C. Render y Reactividad

### C1 — Virtualización

**No hay ninguna librería de virtualización instalada** (`react-window`, `react-virtual`, `virtuoso` — 0 resultados en `package.json` y en `src`). El único componente de tabla compartido, `src/shared/components/ui/Table.tsx`, renderiza con `data.map((row) => ...)` sin ningún límite (línea 46) — cualquier array que le llegue se renderiza entero en el DOM.

20 archivos usan `Table` (listado completo vía grep, ver evidencia de A2/D1). Con paginación server-side (6 vistas) esto es seguro por diseño: el DOM nunca recibe más de `pageSize` filas (máx. 100 con el selector, P7 — decisión documentada explícitamente de **no** virtualizar porque la paginación ya lo hace innecesario, `DECISIONES_TECNICAS.md:402-403`, razonamiento correcto). Para las **16 vistas no paginadas** (A2), `Table` (u otro markup ad-hoc como `ClientDirectoryTable.tsx:24`, `TabUsersRoles.tsx`) es el único mecanismo de render — sin límite de filas, sin virtualización, el costo de render crece linealmente (y en la práctica peor, por reconciliación de React) con el tamaño del dataset.

### C2 — Selectores de Zustand (`?? []` y patrones que rompen el snapshot)

**Regla del proyecto (Z2), ya documentada y con salvaguarda de lint:** un selector `use*Store((s) => ...)` solo puede devolver una referencia que ya vive en el store (el store completo, un slice, un primitivo, o una acción) — nunca construir un valor nuevo (`?? []`, `.map`/`.filter`/spread/objeto literal), porque `zustand` usa `useSyncExternalStore` por debajo y compara por referencia: un valor "nuevo" en cada render entra en loop (`"Maximum update depth exceeded"`).

**Auditoría de los 16 call-sites actuales** (`grep -rn "useSessionStore(\|useReplenishmentStore(" src` — verificado en esta sesión, no solo citado del documento de decisiones):

| Archivo:línea | Selector | Estado |
|---|---|---|
| `ComprasPage.tsx:66-67` | `(s) => s.activeBranchId`, `(s) => s.session` | Seguro |
| `InventoryPage.tsx:70-71` | `(s) => s.session`, `(s) => s.activeBranchId` | Seguro |
| `StockAdjustmentModal.tsx:25` | `(s) => s.activeBranchId` | Seguro |
| `TabLowStock.tsx:46-47` | `(s) => s.statusByProductId`, `(s) => s.requestReplenishment` | Seguro |
| `LogisticsPage.tsx:45-46` | `(s) => s.activeBranchId`, `(s) => s.session` | Seguro |
| `OrderProductsSection.tsx:44` | `(s) => s.activeBranchId` | Seguro |
| `SupplierDetailPanel.tsx:80` | `(s) => s.session` | Seguro |
| `AppShell.tsx:18` | `(s) => s.loadSession` | Seguro |
| `BranchSelector.tsx:16-19` | `session`, `activeBranchId`, `isLoading`, `setActiveBranch` | Seguro |

**Ningún selector actual viola la regla.** Los dos únicos casos que sí la violaban (`ComprasPage.tsx`/`SupplierDetailPanel.tsx`, patrón `(s) => s.session?.branches ?? EMPTY_BRANCHES` dentro del selector) ya fueron corregidos en `[02/09/2026] — Regla de selectores estables en zustand` (`DECISIONES_TECNICAS.md:648-707`), moviendo la derivación fuera del selector. Hay además una salvaguarda real de ESLint (`eslint.config.js`, regla `no-restricted-syntax`, 3 entradas nuevas) que detecta por AST los tres patrones prohibidos (array/objeto literal, `?? []`/`?? {}`, llamadas a `.map`/`.filter`/`.slice`/`.concat`/`.sort`/`.reduce`/`.flatMap` dentro de un `use*Store((s) => ...)`) — confirmado en `npm run lint` (0 errores, el único warning es el ya conocido de `PurchaseOrderFormModal.tsx`, no relacionado a zustand).

**Es sistémico solo en el sentido de que el riesgo existe en cualquier selector nuevo** — hoy, con 16 call-sites y 2 stores, no es un problema activo. El riesgo real es de proceso: el lint es un *warning*, no un *error* (deliberado, para evitar falsos positivos — `DECISIONES_TECNICAS.md:698`), así que `npm run lint` sigue en verde aunque alguien reintroduzca el patrón.

### C3 — Memoización

- **`useMemo`: 21 usos** en todo `src/` (`grep -c`). Concentrados en los módulos migrados a paginación (filtros memoizados para `usePagedQuery`, índices `Map` para joins en `ComprasPage.tsx`/`PurchaseOrderDetailPanel.tsx` — O8, `DECISIONES_TECNICAS.md:626`).
- **`useCallback`: 1 solo uso** en todo el proyecto.
- **`React.memo`: 0 usos.**

**Dónde falta y sería crítico:** ninguno de los 16 listados no paginados (A2) memoiza su filtrado client-side de forma consistente — algunos sí (`ClientsPage.tsx#filteredClients`, `useMemo`), pero el patrón no es uniforme; varios (`OrdersPage.tsx`, `CashPage.tsx`, `AnalyticsPage.tsx`) no tienen ningún `useMemo` (0 apariciones del hook en esos archivos), así que cualquier filtrado/orden que se les agregue en el futuro corre el riesgo de recalcularse en cada render sin que haya un patrón ya establecido para evitarlo. Con datasets chicos esto no se nota; es una laguna estructural más que un bug puntual.

**Dónde está pero es innecesario:** no se encontró un caso claro de `useMemo`/`useCallback` sobrante durante esta auditoría — el uso existente (21 casos) está concentrado en los puntos donde ya importa (dependencias de efectos de `usePagedQuery`, índices de join). No se relevó cada uno de los 21 individualmente línea por línea; este es un panorama de distribución, no una revisión exhaustiva caso por caso.

**Ausencia total de `React.memo`:** con `Table.tsx` renderizando `data.map()` sin memo y sin virtualización (C1), cada re-render del componente padre (ej. un cambio de `isFetching` en `FetchingOverlay`) re-renderiza las hasta 100 filas de una página aunque su contenido no haya cambiado. A escala de página paginada (≤100 filas) esto es barato; en las 16 vistas no paginadas, con un dataset grande, sería un costo de re-render proporcional al tamaño completo del array en cada cambio de estado del padre.

### C4 — Formularios

Solo **2 formularios** usan `react-hook-form` + `zod` (obligatorio para formularios nuevos desde `[28/08/2026]`, `DECISIONES_TECNICAS.md:119-126`):

| Formulario | Schema | Líneas de schema | Modo de validación |
|---|---|---|---|
| `ProductFormModal.tsx` (`inventory`) | `ProductFormModal.schema.ts` | 132 | Sin `mode` explícito en `useForm()` → default de RHF (`onSubmit`) |
| `PurchaseOrderFormModal.tsx` (`compras`) | `PurchaseOrderFormModal.schema.ts` | 45 | Sin `mode` explícito → default `onSubmit`; usa además `useFieldArray` para las líneas de la orden |

**6 formularios "legacy" siguen con `useState` plano, sin validación declarativa** (deuda técnica reconocida explícitamente, no se migran salvo que se toquen — `DECISIONES_TECNICAS.md:123`): `CreateClientModal.tsx` (231 líneas, 21 `useState`), `CreateOrderModal.tsx` (186 líneas, 12 `useState`), `SupplierFormModal.tsx` (152 líneas, 7 `useState`), `NewTransactionModal.tsx` (217 líneas, 0 `useState` propio — probablemente delega a subcomponentes), `PurchaseEntryModal.tsx`, `StockAdjustmentModal.tsx`. El más grande por cantidad de campos gestionados es `CreateClientModal.tsx` (21 piezas de estado local).

**Ningún formulario del proyecto usa `mode: 'onChange'` ni `'onBlur'`** explícito — los 2 con zod dependen del default de react-hook-form (validación recién al hacer submit); los 6 legacy no tienen ningún concepto de "modo de validación" porque no usan RHF.

---

## D. Arquitectura y Entrega

### D1 — Capa de servicios (el hallazgo más importante de esta auditoría)

**No existe una capa de adapters/mappers/DTO en ningún punto del proyecto.** Verificado por `grep -rn "DTO\|Mapper\|adapter\|Adapter" src` → 0 resultados en todo `src/`.

Los "servicios" que sí existen (`src/services/mock/*.service.ts`, 6 archivos: `clients`, `dashboard`, `products`, `purchaseOrders`, `session`, `suppliers`; más `src/modules/logistics/services/deliveries.service.ts`, 7 en total) siguen un patrón uniforme y documentado (`FrontEnd/CLAUDE.md:52-57`):
```ts
async function fetchX(): Promise<X> {
  await delay(MS)
  return structuredClone(MOCK_DATA)
}
```
`X` es **el mismo tipo de dominio** que consume la UI (`ClientAccount`, `InventoryItem`, `PurchaseOrder`, etc. — los tipos de `shared/types/*.types.ts`). No hay ninguna forma "de red" (`ClientAccountDTO`, `{ data: {...}, meta: {...} }`, snake_case, IDs numéricos vs. string) que un mapper traduzca a un modelo de dominio distinto: **el modelo de dominio y la forma de los datos son literalmente el mismo objeto, con un `delay()` en el medio.**

**Por qué esto es lo más importante de la auditoría:** cuando exista un backend real, es extremadamente improbable que su forma de datos (JSON de una API REST/GraphQL real, con su propia paginación, nombres de campo, tipos primitivos, convenciones de fecha, posible normalización de relaciones) coincida exactamente con los tipos de `shared/types/`. Hoy, migrar de mock a HTTP real no es "cambiar la implementación de la función manteniendo el contrato" (el ideal de una capa de servicios) — es dos migraciones acopladas en una: (1) cambiar `structuredClone(MOCK)` por `fetch(...)`, y (2) muy probablemente, cambiar la forma de la respuesta, lo que en ausencia de un mapper obliga a tocar cada componente que lee esos campos directamente.

**Qué SÍ separa el proyecto correctamente (para no subestimar lo que funciona):**
- El **contrato de paginación** (`PageQuery`/`PageResult`, `pagination.types.ts`) es genérico y no depende de la forma del mock — es una capa real de abstracción sobre "cómo se pide una página", solo que el lado servidor de ese contrato hoy lo implementa una función mock en vez de un backend.
- Los **componentes de los 6 módulos migrados nunca leen `data/mock/*` directamente** — pasan siempre por su `*.service.ts` correspondiente (`getXPage`, `exportX`), así que el *punto de reemplazo* (cambiar la implementación interna de esas funciones por `fetch`) está bien localizado y acotado a un archivo por dominio.
- Las acciones mutables devuelven **resultados estructurados** (`{success, reason?}`), no excepciones de UI ni texto en español — un patrón consistente en los 6+ módulos con mutaciones (`setActiveBranch`, `requestReplenishment`, `advanceDeliveryStatus` histórico, `updatePurchaseOrderStatus`), que sobrevive bien a un cambio de transporte.

**Qué NO separa (la deuda real):**
- **5 módulos (`orders`, `cash`, `analytics`, `settings`, y parte de `inventory`) importan `data/mock/*.data.ts` directamente en el componente de página** (`grep -rln "from '@/data/mock" src/modules --include=*.tsx` → `AnalyticsPage.tsx`, `CashPage.tsx`, `InventoryPage.tsx` (`suggestions`, `movements`, `history`), `OrdersPage.tsx`, `TabSubscription.tsx`, `TabUsersRoles.tsx`, `AuditLogWidget.tsx` — 7 archivos). Estos ni siquiera pasan por el patrón `delay()`+`structuredClone()`: son imports síncronos de nivel de módulo, sin ningún punto de indirección que reemplazar por HTTP sin tocar el componente.
- Ningún servicio existente traduce nombres de campo, tipos ni estructura — si el backend real usara, por ejemplo, `client_name` en vez de `clientName`, o devolviera fechas como `{seconds, nanos}` en vez de ISO string, cada componente que lee `client.clientName`/`new Date(t.date)` se rompe, no solo el servicio.

### D2 — Datos mock: ubicación y facilidad de reemplazo

**Ubicación:** `src/data/mock/*.data.ts` — 12 archivos (uno por módulo de negocio más `productStock.data.ts` separado de `inventory.data.ts` por diseño, E1). 2.520 líneas en total (`find src/data -name "*.ts" | xargs wc -l`).

**Cómo se conectan a la UI, dos caminos distintos:**
1. **Vía servicio** (6 módulos + logistics): el `*.data.ts` se importa **solo** dentro de su `*.service.ts` correspondiente como una variable de módulo mutable (ej. `clientsStore` en `clients.service.ts`, reasignada — no mutada in-place — por `createClient`/`updateClient`, mismo patrón en `productsStore`/`stockStore`/`suppliersStore`/`purchaseOrdersStore`). El componente nunca ve el archivo `.data.ts`.
2. **Directo desde el componente** (5 módulos, ver D1): el componente importa la constante del `.data.ts` en el top-level del archivo y la usa de forma síncrona, sin `async`/`await`, sin `delay`, sin estado de carga.

**Facilidad real de reemplazo por HTTP, por camino:**
- **Camino 1 (vía servicio):** reemplazar `structuredClone(store)` por `fetch('/api/...')` dentro de la función del servicio es mecánicamente sencillo **si y solo si** la respuesta de esa API ya tiene la forma exacta del tipo de dominio (ver D1 — no hay garantía de eso). El *call site* en el componente no cambia.
- **Camino 2 (directo):** requiere primero **introducir** un servicio que no existe — no es "cambiar una llamada", es agregar una capa entera antes de poder apuntar a HTTP, y tocar el componente para que pase de leer una constante síncrona a manejar un estado async (loading/error) que hoy no tiene en absoluto (ver D4).

### D3 — Code-splitting

**No hay ningún `React.lazy`/`import()` dinámico en el proyecto** (`grep -rn "React.lazy\|lazy(" src` → 0 resultados). `src/shared/routes/AppRoutes.tsx` importa los 9 módulos de forma estática al tope del archivo (líneas 3-12) — las 9 páginas (incluidos `analytics`, `settings`, `cash`, que pueden ser secciones poco usadas por el grueso de los usuarios) viajan en el mismo bundle inicial que `dashboard`, la ruta `index`.

`vite.config.ts` (14 líneas) no tiene ninguna configuración de `build.rollupOptions.output.manualChunks` ni equivalente — solo el plugin de React y el alias `@/`.

**`npm run build` (ejecutado en esta auditoría):**
```
tsc -b && vite build
✓ 2641 modules transformed
dist/index.html                     0.71 kB │ gzip:   0.42 kB
dist/assets/index-Cou9HS_p.css    121.39 kB │ gzip:  15.53 kB
dist/assets/index-UNSc-Uc8.js   1,395.51 kB │ gzip: 403.34 kB
✓ built in 2.23s (real 12.5s de wall-clock total, incluyendo tsc -b)
```
**Un solo chunk JS de 1.4 MB (403 KB gzip)** — Vite emite su warning nativo de "chunks larger than 500 kB" al final del build. Cualquier usuario que solo necesite `/pedidos` descarga y parsea el código de los 9 módulos (incluidos `xlsx` para exportar, `recharts` para analítica/dashboard, `react-hook-form`+`zod` para los 2 formularios migrados) antes de poder ver una sola pantalla.

### D4 — Estados de error y carga

**Error boundaries: existen, pero no son globales.** `src/shared/components/ui/ErrorBoundary.tsx` se usa en exactamente **6 puntos**, todos envolviendo la tabla paginada de un listado migrado: `ClientAccountsTable.tsx:106`, `ClientOverdueTable.tsx:187`, `TabPendingReceipt.tsx:166`, `ComprasPage.tsx:354`, `TabLowStock.tsx:129`, `LogisticsPage.tsx:153`.

**No hay ningún `ErrorBoundary` en `App.tsx`, `AppShell.tsx` ni `AppRoutes.tsx`** (verificado leyendo los 3 archivos completos). Un error de render no capturado en cualquiera de los otros puntos del árbol — las 5 páginas no migradas completas (`orders`, `cash`, `analytics`, `settings`, directorio de `clients`), el layout (`AppShell`, `Sidebar`, `Header`, `BranchSelector`), o cualquier componente fuera de los 6 boundaries locales — desmonta **toda la aplicación** a una pantalla en blanco, sin ningún mecanismo de recuperación ni mensaje al usuario.

**Qué pasa si un fetch falla:** cada servicio mock puede lanzar (`SupplierServiceError`, `ClientServiceError`, `ProductServiceError` — 10 sites de `throw` en `src/services`, todas por **validación de negocio** — SKU duplicado, entidad no encontrada — nunca por una falla de red simulada). `usePagedQuery`/`useDashboard` capturan el `catch` y ponen `error` en estado, que **solo `DashboardPage.tsx` renderiza** (`grep -rln "error &&\|{error}" src/modules` → un único archivo). Los otros 5 consumidores de `usePagedQuery` no muestran `error` en ningún lugar visible al usuario más allá de lo que haga (o no haga) el propio componente — no se revisó cada uno individualmente para confirmar un mensaje de error visible, pero el grep confirma que el patrón `{error}`/`error &&` no aparece fuera de dashboard.

**Qué pasa si un fetch tarda 30 segundos:** **no hay ningún timeout configurado en ningún servicio ni en `usePagedQuery`.** Los `delay()` de los mocks son fijos y cortos (300-500ms, `grep -n "setTimeout" src/services` → 6 archivos, todos con un `ms` numérico fijo pasado por el llamador) y **siempre resuelven** — ningún servicio mock simula una respuesta lenta, un timeout de red, ni un 5xx. El camino de "la request tarda mucho" o "el servidor no responde" **nunca se ejercitó ni una sola vez** en todo el desarrollo documentado en `DECISIONES_TECNICAS.md` — es una superficie completamente sin probar, ni siquiera manualmente.

**Reintentos:** no existen en ningún punto del proyecto (`grep -rn "retry" src/services` → 0 resultados).

**Skeletons:** `SkeletonLoader`/`SkeletonTable` se usa en 13 archivos, concentrados en los módulos migrados + `dashboard`. Los 5 módulos no migrados (`orders`, `cash`, `analytics`, `settings`, + directorio de `clients`) no muestran ningún skeleton porque no tienen ningún estado de carga que mostrar — leen datos síncronos (D1/D2).

---

## E. Línea de base

### E1 — Lint

```
npm run lint
✖ 1 problem (0 errors, 1 warning)
```
El único warning (`PurchaseOrderFormModal.tsx:172`, uso de `watch()` de react-hook-form incompatible con memoización del compilador de React) es preexistente y está documentado como tal (`DECISIONES_TECNICAS.md:730`) — no introducido por esta auditoría (no se modificó ningún archivo de código). **Confirmado: 0 errores.**

### E2 — Build

```
npm run build
tsc -b && vite build
✓ 2641 modules transformed, built in 2.23s
```
**Confirmado: pasa sin errores.** Tiempo total de wall-clock del comando completo (`tsc -b` + `vite build`): **~12.5 segundos** (medido con `time npm run build` en esta sesión; la mayor parte es `tsc -b`, ya que Vite reporta 2.23s de los suyos).

### E3 — Archivos y líneas por módulo

| Módulo | Archivos (.ts/.tsx) | Líneas |
|---|---|---|
| `analytics` | 7 | 530 |
| `cash` | 6 | 556 |
| `clients` | 12 | 1.395 |
| `compras` | 9 | 1.493 |
| `dashboard` | 5 | 569 |
| `inventory` | 17 | 2.062 |
| `logistics` | 6 | 641 |
| `orders` | 10 | 1.291 |
| `settings` | 8 | 539 |
| `suppliers` | 6 | 766 |
| **`src/shared`** | 36 | 2.852 |
| **`src/data`** (mock) | 12 | 2.520 |
| **`src/services`** | 6 | 1.240 |
| **Total `src/`** | **142** | **16.497** |

`inventory` (17 archivos, 2.062 líneas) y `compras`/`clients` (~1.400-1.500 líneas) son los módulos de mayor superficie — consistente con ser los que ya atravesaron más tareas de migración (paginación, multi-sucursal, exportación). `analytics`/`settings`/`cash` (500-560 líneas cada uno) son los de menor esfuerzo ya invertido y, coincidentemente, los que quedan enteramente fuera del contrato de paginación (A2) y de la capa de servicios (D1).

---

## Tabla de hallazgos

| # | Hallazgo | Eje | Severidad | Esfuerzo | Bloquea a |
|---|---|---|---|---|---|
| 1 | No existe capa de adapters/mappers/DTO — el modelo de dominio del frontend y la forma de datos del mock son el mismo objeto | D1 | **Crítico** | L | Cualquier integración con un backend real cuya forma de datos no coincida field-por-field con `shared/types/*` |
| 2 | Imputación FIFO + aging de Clientes Morosos recorre todas las transacciones de todos los clientes en el hilo principal del navegador (cacheado, pero el primer cálculo/cada invalidación es O(clientes × transacciones)) | A4 | **Crítico** | L | Escalar Clientes Morosos a decenas/cientos de miles de cuentas sin mover el cálculo al servidor o a un worker |
| 3 | 16 de 22 listados no usan paginación server-side ni client-side — traen el dataset completo y lo renderizan entero, sin virtualizar | A2 / C1 | **Crítico** | L | Cualquiera de esos módulos (`orders`, `cash`, `analytics`, `settings`, directorio de clientes, 6 tabs de inventory) al operar con volumen real |
| 4 | Sin `ErrorBoundary` global — un error de render no capturado en cualquier punto fuera de los 6 boundaries locales rompe toda la aplicación a pantalla en blanco | D4 | **Crítico** | S | Confiabilidad en producción para cualquier módulo, incluidos los 5 no migrados sin ningún boundary |
| 5 | Sin code-splitting — un solo bundle JS de 1.4 MB (403 KB gzip), Vite ya emite warning nativo | D3 | Alto | M | Tiempo de carga inicial con muchas empresas cliente accediendo desde redes/dispositivos variados |
| 6 | 5 módulos importan `data/mock/*.data.ts` directo en el componente de página, sin service ni estado async — no hay ningún punto de indirección que reemplazar por HTTP sin tocar el componente | D1 / D2 | Alto | M | Migración de `orders`, `cash`, `analytics`, `settings`, y parte de `inventory` a backend real |
| 7 | Ningún fetch tiene timeout ni reintentos; el camino de "la red es lenta o falla" nunca se probó ni una vez (todos los mocks siempre resuelven, rápido) | A1 / D4 | Alto | M | Confiabilidad ante un backend real con latencia/errores variables |
| 8 | Sin cache, dedupe ni invalidación cruzada entre componentes en `usePagedQuery` — remontar un componente repite el fetch, y mutar en una pestaña no refresca otra ya montada (limitación ya documentada) | A1 | Medio | M | UX consistente con múltiples vistas abiertas del mismo dato |
| 9 | Cancelación de requests es solo un flag en memoria (`cancelled`), nunca `AbortController` — el request de red real sigue en vuelo aunque la UI lo descarte | A3 | Medio | S | Tráfico/carga de servidor evitable a alto volumen de usuarios concurrentes |
| 10 | Export a Excel/CSV trae hasta 10.000 filas al cliente y arma el archivo en el navegador — deuda técnica ya documentada por el propio equipo | A4 | Medio | M | Exportaciones grandes con backend real (mover a generación server-side) |
| 11 | `useMemo`/`useCallback`/`React.memo` con presencia muy desigual (21/1/0 usos) — los 16 listados no migrados no tienen un patrón establecido de memoización para filtrado client-side | C3 | Medio | S | Performance de render al escalar cualquiera de esos 16 listados antes de migrarlos a paginación |
| 12 | El registro de `resettableStores` depende de disciplina manual (copiar una línea al crear un store) sin lint/test que lo fuerce | B1 / B2 | Bajo (hoy: 0 stores sin registrar) | S | Ningún bloqueo actual — riesgo de proceso a futuro |
| 13 | `TabPurchases.tsx` resuelve proveedor/producto con `.find()` doble sin `Map`, a diferencia del resto del proyecto que sí usa `Map` para joins | A4 | Bajo | S | Ninguno hoy (catálogo pequeño); costo O(n) por click a escala |
| 14 | No hay ningún mecanismo de selección de múltiples empresas por usuario ni datos mock que ejerciten ese caso — el modelo asume 1 empresa por usuario | B4 | Bajo (fuera de alcance actual del producto) | M | Un caso de uso futuro de "un usuario con acceso a varias empresas" (ej. un contador) |
| 15 | 6 formularios legacy sin validación declarativa (`useState` plano); el más grande (`CreateClientModal`) gestiona 21 piezas de estado local | C4 | Bajo | M | Consistencia de validación si se migran a `zod`/RHF |

---

## Decisiones abiertas

Estas requieren una decisión del negocio/producto antes de poder planificar la implementación — no son ambigüedades de lectura de código, son elecciones de alcance y prioridad:

1. **¿Se prioriza migrar los 16 listados sin paginar (A2) antes o después de introducir un backend real?** Migrarlos ahora (a `usePagedQuery` contra el mock) reduce el trabajo de migración a HTTP después, pero es esfuerzo invertido en un contrato que igual va a cambiar de implementación. Migrarlos junto con el backend real concentra el trabajo pero deja 16 pantallas sin el patrón de carga/error/skeleton ya establecido mientras tanto.

2. **¿La imputación FIFO de Clientes Morosos (hallazgo #2) se resuelve moviendo el cálculo al backend (lo natural cuando exista), o se necesita una mitigación intermedia** (ej. un Web Worker, o un límite de "clientes con actividad reciente" para el cálculo del día) **para el período en que el frontend siga sirviendo de mock con un dataset de prueba más grande?**

3. **¿Vale la pena introducir una capa de DTO/mapper *antes* de que exista un backend real** (hallazgo #1), a riesgo de estar diseñando un contrato para una forma de datos que todavía no se conoce, **o se espera a que el primer endpoint real exista** para diseñar el mapper contra su forma concreta, aceptando que la primera integración va a tocar más componentes de los que tocaría con la capa ya en su lugar?

4. **¿Se define ya un criterio de code-splitting por rol/módulo** (ej. separar `analytics`/`settings`/`cash` si no todos los roles de usuario acceden a ellos) **o se espera a tener datos reales de uso** (qué módulos carga cada tipo de usuario) antes de decidir dónde cortar los chunks?

5. **¿El caso de "un usuario con acceso a varias empresas" (hallazgo #14) es un requisito real del producto,** o el modelo actual (un usuario, una empresa, N sucursales) es intencional y ese caso queda fuera de alcance? Esto determina si `SessionUser.company` debe pasar a `companies: Company[]` con un selector adicional, o si el hallazgo se cierra como "no aplica".

6. **¿Se define un SLA/timeout esperado para el backend real** (hallazgo #7) que sirva de base para implementar timeout + retry en `usePagedQuery`/los servicios, o se difiere hasta tener el backend y medir latencias reales?
