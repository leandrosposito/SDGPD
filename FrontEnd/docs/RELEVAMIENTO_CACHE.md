# Relevamiento — Cache para datos no paginados

**Fecha:** 04/09/2026
**Commit relevado:** `a338dd3` (HEAD, rama `lean`) + working tree de Tanda 2 sin commitear
(`usePagedQuery.ts`, `queryClient.ts`, `queryKeys.ts`, `AppRoutes.tsx` — cache de TanStack
Query ya activo para los 7 listados paginados).

**Alcance:** solo reconocimiento. Ningún archivo de código fue modificado para este
relevamiento. Toda afirmación cita `ruta:línea`.

**Motivo:** al navegar Inventario → Clientes → Inventario, la segunda carga de Inventario
demora igual que la primera. Confirmado: el cache de Tanda 2 (`usePagedQuery`) solo cubre
listados paginados. Este documento inventaría todo lo demás.

---

## A. Inventario de cargas no paginadas

### A1. `useEffect` que llama a un service o importa datos mock

Se encontraron 25 archivos con `useEffect` en `src/`. De esos, los que efectivamente cargan
datos de un service o mock (excluidos los que son solo UI — debounce, click-outside, foco,
reset de formulario, tema) son:

| # | Componente (ruta:línea) | Función llamada | Devuelve | Deps del efecto | Volumen aprox. hoy | `cancelled`/AbortController |
|---|---|---|---|---|---|---|
| 1 | `InventoryPage.tsx:76-100` | `fetchProducts()` + `fetchSuppliers(session.company.id)` (`Promise.all`) | Catálogo de productos + lista completa de proveedores | `[session]` | 28 productos, 3 proveedores | `cancelled` (bool), no AbortController |
| 2 | `InventoryPage.tsx:108-124` | `getStockedProductsForBranch(activeBranchId)` | Catálogo unido a stock de la sucursal activa | `[activeBranchId, products]` | 53 registros de stock (`productStock.data.ts`) | `cancelled` (bool) — **se dispara 2 veces por montaje**, ver D2 |
| 3 | `ComprasPage.tsx:102-127` | `fetchSuppliers(session.company.id)` + `fetchProducts()` (dos `.then()` independientes, no `Promise.all`) | Lista completa de proveedores + catálogo de productos | `[session]` | 3 proveedores, 28 productos | `cancelled` (bool) |
| 4 | `CreateOrderModal.tsx:28-32` (módulo `orders`) | `fetchProducts()` | Catálogo de productos | `[]` (solo al montar) | 28 productos | Ninguno — ni `cancelled` ni AbortController |
| 5 | `ClientsPage.tsx:46-58` | `fetchClients()` | Directorio completo de clientes | `[]` (solo al montar) | 30 clientes | `cancelled` (bool) |
| 6 | `useDashboard.ts:23-51` | `fetchDashboardData()` | KPIs + serie de ventas + top productos + pedidos recientes, todo en un solo objeto | `[refreshKey]` (cambia solo con `refetch()` manual) | — (agregado, no es una lista) | `cancelled` (bool) |
| 7 | `SupplierDetailPanel.tsx:87-103` | `getPurchaseOrdersBySupplierId(supplierId)` | Historial de OC de un proveedor puntual | `[isOpen, supplierId]` | 10 OC en el mock completo (recorte por proveedor) | `cancelled` (bool) |
| 8 | `StockAdjustmentModal.tsx:28-37` | `getStockForBranch(product.id, activeBranchId)` | Stock puntual de UN producto en la sucursal activa | `[isOpen, product, activeBranchId]` (a confirmar el array completo, no relevante para el conteo) | 1 registro | `cancelled` (bool) |
| 9 | `AppShell.tsx:28-30` | `loadSession()` (acción de `useSessionStore`, no un service directo) | Sesión (empresa, usuario, sucursales) | `[loadSession]` | 1 objeto de sesión | Es idempotente por diseño (`useSessionStore.ts:71-73`), no necesita `cancelled` |

**Fuera de esta tabla, confirmado que NO cargan datos** (useEffect presente pero es UI pura):
`SupplierFormModal.tsx:27` (reset de formulario al abrir), `ProductFormModal.tsx:72`
(reset de formulario), `NewTransactionModal.tsx:34` (hora actual + reset de formulario),
`CreateClientModal.tsx:61` (reset de formulario), `PurchaseOrderFormModal.tsx:101` (reset
de formulario con defaults ya recibidos por props), `BranchSelector.tsx:25` (click-outside),
`Header.tsx:61` (tema guardado en `localStorage`), `Modal.tsx`/`SidePanel.tsx` (foco/scroll),
`useDebouncedValue.ts` (debounce genérico), `ExportButton.tsx` (click-outside del menú).
`ClientGeneralTab.tsx:38-49` simula una consulta AFIP con `setTimeout` — no llama a ningún
service ni mock real, es una simulación inline, no entra en el inventario.

Los 7 consumidores de `usePagedQuery` (`TabLowStock`, `TabPendingReceipt`,
`ClientAccountsTable`, `ClientOverdueTable`, `ComprasPage` listado principal,
`LogisticsPage`, `SuppliersPage`) están **fuera de este relevamiento** — ya migrados y
cacheados por Tanda 2.

### A2. Componentes que importan `data/mock/*` directo, sin pasar por un service

```
FrontEnd/src/modules/settings/components/widgets/AuditLogWidget.tsx:2
FrontEnd/src/modules/settings/components/tabs/TabUsersRoles.tsx:2
FrontEnd/src/modules/settings/components/tabs/TabSubscription.tsx:2
FrontEnd/src/modules/orders/OrdersPage.tsx:2
FrontEnd/src/modules/inventory/InventoryPage.tsx:3   (además de sus llamadas a service, también lee INVENTORY_MOCK_DATA.suggestions/.movements/.history directo — ver A3)
FrontEnd/src/modules/cash/CashPage.tsx:2
FrontEnd/src/modules/analytics/AnalyticsPage.tsx:2
```

Los servicios (`services/mock/*.service.ts`, `modules/*/api/*.service.ts`,
`modules/logistics/services/deliveries.service.ts`) también importan `data/mock/*` — eso
es el patrón correcto (la única capa autorizada a hacerlo, regla ya vigente desde Tanda 1).
Los 7 archivos de arriba son componentes de UI que se lo saltean.

### A3. Lecturas fuera de un `useEffect` (cuerpo del componente, handlers, stores)

- **`InventoryPage.tsx:143-146`** — `purchaseSuggestions` se calcula con `useMemo` filtrando
  `INVENTORY_MOCK_DATA.suggestions` directo por `activeBranchId`. Es **síncrono** (el array
  ya está en memoria desde el `import`, no hay `await` ni latencia) — no es una carga
  asíncrona, así que no contribuye a la demora percibida, pero tampoco puede reflejar
  ninguna mutación real.
- **`InventoryPage.tsx:212`** — `<TabMovements data={INVENTORY_MOCK_DATA.movements} />`,
  prop pasada directo desde el mock importado, sin estado ni efecto.
- **`InventoryPage.tsx:247`** — `<TabProductHistory data={INVENTORY_MOCK_DATA.history} />`,
  mismo patrón.
- **`OrdersPage.tsx:55`** — `useState<Order[]>(ORDERS_MOCK_DATA)`: el mock se usa como
  **valor inicial del estado**, leído en el cuerpo del componente al montar, no en un
  efecto. Nunca hay un `await`/latencia — el listado aparece instantáneo, pero cualquier
  alta/edición hecha con `setOrders` durante la sesión se pierde al desmontar (no hay
  ningún `orders.service.ts` con un store en memoria como sí tiene `products.service.ts`).
- **`CashPage.tsx:14`** — `useState(CASH_MOCK_DATA)`, mismo patrón que `OrdersPage`: mismo
  problema de estado que se pierde al desmontar, no relacionado con cache.
- **`AnalyticsPage.tsx:55`** — `const data = ANALYTICS_DATA[period]`: lookup síncrono
  directo en el cuerpo del componente, sin estado. 100% estático.
- **`TabUsersRoles.tsx:37`** — `<UsersTable data={SETTINGS_MOCK_USERS} />` (prop directa,
  sin estado); `permissions` sí pasa por `useState(SETTINGS_MOCK_PERMISSIONS)` (línea 20)
  pero sin ningún mutador real detectado (a confirmar si hay un handler de guardado en el
  resto del archivo, no relevado línea por línea completo).
- **`TabSubscription.tsx:31`**, **`AuditLogWidget.tsx:16`** — props directas desde el mock,
  sin estado.
- **Zustand:** ningún store lee datos de servidor en el cuerpo de un componente sin pasar
  por un `useEffect` o una acción explícita — ver sección E.

### A4. ¿Se repite la carga al remontar el componente?

**Sí, TODAS las de la tabla A1 se repiten al remontar** — ninguna tiene cache, cada
`useEffect` vuelve a ejecutar su función de servicio desde cero cuando el componente se
monta de nuevo (React no preserva estado entre desmontaje y remontaje; solo compara
dependencias DENTRO de la vida de una misma instancia montada). Esto incluye
específicamente el caso reportado: `InventoryPage` desmonta al navegar a `/clientes` y
remonta al volver a `/inventario`, disparando de nuevo `fetchProducts` + `fetchSuppliers` +
`getStockedProductsForBranch` (dos veces, ver D2) sin importar que nada haya cambiado.

Las de A3 (estado inicializado con el mock) técnicamente "recargan" también al remontar,
pero de forma instantánea (sin latencia) — el problema ahí no es de cache, es que
**pierden cualquier mutación hecha en la sesión anterior** (ver arriba).

---

## B. Clasificación por naturaleza del dato

| Dato | Naturaleza (B1) | Depende de (B2) | Quién lo muta (B3) | Se usa en más de un módulo (B4) |
|---|---|---|---|---|
| Catálogo de Productos (`fetchProducts`) | Catálogo | Ninguna explícita (empresa implícita — la función no recibe `empresaId`) | `createProduct`/`updateProduct`/`deleteProduct` (`ProductFormModal`, solo desde `InventoryPage`) | **Sí** — `InventoryPage`, `ComprasPage`, `CreateOrderModal` (orders) |
| Lista completa de Proveedores (`fetchSuppliers`) | Catálogo | Empresa (`empresaId` obligatorio) | `createSupplier`/`updateSupplier` (`SuppliersPage`, vía `fetchSuppliersPage`) | **Sí** — `InventoryPage`, `ComprasPage` |
| Stock por sucursal, catálogo unido (`getStockedProductsForBranch`) | Operativo | Sucursal | Ninguno hoy (comentario explícito en `products.service.ts:29-32`: "sin mutadores en esta tarea") | No (solo `InventoryPage`, tab "Stock Actual") |
| Stock puntual de un producto (`getStockForBranch`) | Operativo | Sucursal | Ninguno hoy | **Sí** — `ComprasPage` (handler), `StockAdjustmentModal` (inventory), `OrderProductsSection` (orders) |
| Directorio de Clientes (`fetchClients`) | Catálogo | Ninguna (M9: es de empresa, no de sucursal) | `createClient`/`updateClient` (mismo `ClientsPage`) | No |
| Dashboard (`fetchDashboardData`) | Derivado/Agregado | Ninguna explícita | Nadie — no hay ninguna mutación en el proyecto que debería invalidar el dashboard (ej. una OC nueva no lo actualiza) | No |
| Historial de OC por proveedor (`getPurchaseOrdersBySupplierId`) | Operativo | Empresa (implícito vía `supplierId`, sin filtro de sucursal) | `updatePurchaseOrderStatus` (Compras), `generatePurchaseOrderFromSuggestion` (Inventario, tab Reposición) — **ninguna de las dos invalida este panel hoy** | No directamente, pero depende de datos que sí mutan desde 2 módulos distintos |
| Pedidos (`ORDERS_MOCK_DATA` vía `useState`) | Operativo | A confirmar (`PENDIENTES.md` ya lo marca: "decidir scope antes de implementar") | Ninguna función de servicio — mutaciones solo en memoria del componente | No |
| Caja (`CASH_MOCK_DATA` vía `useState`) | Operativo | A confirmar (probablemente sucursal, sin service que lo confirme) | Ninguna función de servicio — mutaciones solo en memoria del componente | No |
| Analítica (`ANALYTICS_DATA[period]`) | Derivado/Agregado | Ninguna | Nadie, estático | No |
| Config. — Usuarios/Roles (`SETTINGS_MOCK_USERS`/`_PERMISSIONS`) | Catálogo | Empresa | Sin mutador real detectado | No |
| Config. — Auditoría (`SETTINGS_MOCK_AUDIT`) | Derivado (registro de eventos) | Empresa | Nadie, estático (nada en el proyecto genera entradas de auditoría reales) | No |
| Config. — Facturas/Suscripción (`SETTINGS_MOCK_INVOICES`) | Operativo | Empresa | Nadie, estático | No |

**Candidato a invalidación cruzada real, ya evidenciado:** `generatePurchaseOrderFromSuggestion`
(`TabPurchases.tsx:63`, tab "Reposición" de Inventario) crea una Orden de Compra nueva.
Esa OC debería aparecer en el listado de Compras (`getPurchaseOrdersPage`, ya cacheado por
Tanda 2) y en el historial de `SupplierDetailPanel` de ese proveedor — hoy ninguno de los
dos se entera: Compras solo refresca por `refetch()` manual desde dentro de sí misma, y
`SupplierDetailPanel` solo refetchea si se cierra y reabre.

---

## C. Duplicación actual

### C1. Datos pedidos más de una vez en la misma sesión de navegación

Verificación puntual del ejemplo del prompt — **corrección con evidencia**: `fetchSuppliers`
NO se llama desde `SuppliersPage` (esa usa `fetchSuppliersPage`, una función paginada
distinta, ya cacheada por Tanda 2 desde Tanda 1). `fetchSuppliers` (lista completa, sin
paginar) se llama desde exactamente **2** lugares, no 3:
- `InventoryPage.tsx:84`
- `ComprasPage.tsx:110`

En cambio `fetchProducts()` (que el prompt no mencionaba) es el caso con más duplicación
real, **3 lugares independientes**:
- `InventoryPage.tsx:84`
- `ComprasPage.tsx:118`
- `CreateOrderModal.tsx:29` (módulo `orders`)

Cada uno de estos 3 mantiene su propia copia en `useState` local — si el usuario abre
Inventario, después Compras, después el modal "Nuevo Pedido", pide el mismo catálogo de 28
productos 3 veces, con 3 copias en memoria simultáneas que pueden desincronizarse entre sí
(ej. crear un producto en Inventario no lo hace aparecer en el modal de Pedidos si ya
estaba montado).

`getStockForBranch` (stock puntual) se llama desde 3 lugares también (`ComprasPage.tsx:184`,
`StockAdjustmentModal.tsx:31`, `OrderProductsSection.tsx:60`) pero son lookups de UN
producto a la vez, no del catálogo completo — la duplicación ahí es por repetición de uso
(mismo producto consultado en momentos distintos), no por 3 módulos pidiendo lo mismo al
mismo tiempo.

### C2. Datos pedidos en cada montaje sin haber cambiado

Todos los de la tabla A1 aplica (ver A4). El caso más concreto y barato de verificar:
`SupplierDetailPanel.tsx:87-103` vuelve a pedir `getPurchaseOrdersBySupplierId(supplierId)`
cada vez que el panel se abre (`isOpen` pasa a `true`), **incluso si es el mismo proveedor
que ya se había abierto antes en la misma sesión** — el estado `ordersLoadedForSupplierId`
existe pero solo se usa para el flag de "cargando" (línea 85), no como condición para
saltear el fetch.

### C3. Estimación de peticiones ahorrables en un recorrido Dashboard → Inventario → Clientes → Inventario → Compras

Conteo de llamadas reales en ese recorrido (sin clickear tabs secundarias, solo la pantalla
default de cada módulo):

| Paso | Llamadas que dispara |
|---|---|
| Dashboard | `fetchDashboardData` ×1 |
| Inventario (1ra vez) | `fetchProducts` ×1, `fetchSuppliers` ×1, `getStockedProductsForBranch` ×2 (ver D2) |
| Clientes | `fetchClients` ×1 |
| Inventario (2da vez) | `fetchProducts` ×1, `fetchSuppliers` ×1, `getStockedProductsForBranch` ×2 |
| Compras | `fetchSuppliers` ×1, `fetchProducts` ×1, `getPurchaseOrdersPage` ×1 (ya cacheado, Tanda 2) |

Total en este recorrido: `fetchProducts` ×3, `fetchSuppliers` ×3, `getStockedProductsForBranch`
×4, `fetchClients` ×1, `fetchDashboardData` ×1 = **12 llamadas** a las 3 primeras funciones
(las únicas sin cache), de las cuales, con un cache tipo `usePagedQuery`/TanStack Query y
corrigiendo el doble-disparo de `getStockedProductsForBranch` (D2), **9 serían evitables**
(quedarían en 1 `fetchProducts`, 1 `fetchSuppliers`, 1 `getStockedProductsForBranch`) — nada
cambió entre esas peticiones en este recorrido. `fetchClients` y `fetchDashboardData` no se
repiten en este recorrido puntual (cada pantalla se visita una sola vez), así que no suman
ahorro acá, pero sí lo harían en un recorrido que las revisitara.

---

## D. El caso Inventario en detalle

### D1. Todas las cargas de datos de `InventoryPage.tsx`

Ya cubierto en A1 (filas 1 y 2) y A3. Resumen: 2 `useEffect` (catálogo+proveedores, y
stock de sucursal) + 3 lecturas síncronas del mock (`suggestions` vía `useMemo`,
`movements` y `history` pasados directo como prop).

### D2. Por qué se repite al volver a la pantalla

Por A4: no hay ninguna capa de cache entre el componente y el service — cada montaje es un
`useState`/`useEffect` nuevo. Adicional, específico de Inventario, con evidencia concreta:

**`getStockedProductsForBranch` se dispara DOS veces por cada montaje**, no una:
- El efecto que lo llama (`InventoryPage.tsx:108-124`) depende de `[activeBranchId, products]`.
- En el primer render, `products` vale `[]` (estado inicial) — el efecto ya se dispara con
  ese valor (`activeBranchId` normalmente ya está disponible).
- Cuando el otro efecto (`InventoryPage.tsx:76-100`) resuelve `fetchProducts()` y llama
  `setProducts(productsData)`, la referencia de `products` cambia → el efecto de stock se
  vuelve a disparar (cleanup del anterior marca `cancelled=true`, se descarta esa
  respuesta, pero el trabajo — 400ms de delay simulado — ya se ejecutó igual).
- Resultado: **2 llamadas reales a `getStockedProductsForBranch` por cada montaje**, la
  primera completamente desperdiciada.

### D3. Cuáles de las 9 tabs disparan cargas propias y cuáles reusan datos del padre

Confirmado por `Tabs.tsx:39-41`: solo se renderiza el `content` de la tab activa
(`tabs.find(t => t.id === activeTabId)?.content`) — las otras 8 tabs NO montan sus
componentes hasta que el usuario hace click, así que sus datos (si tuvieran) no se piden
de entrada. Default: `activeTab = 'stock'` (`InventoryPage.tsx:64`).

| Tab | Dispara carga propia | Detalle |
|---|---|---|
| Stock Actual (`TabStockCurrent`) | No | Recibe `filteredStockedProducts` ya cargado por el padre |
| Bajo Stock Mínimo (`TabLowStock`) | **Sí, propia** | `usePagedQuery(getLowStockPage,...)` — único tab con cache (Tanda 2), pero SOLO se dispara si el usuario clickea esta tab, no en el montaje default |
| Movimientos (`TabMovements`) | No | Prop estática (`INVENTORY_MOCK_DATA.movements`) |
| Reposición (`TabPurchases`) | No (mutación, no carga) | Recibe `purchaseSuggestions`/`products`/`suppliers` del padre; su único llamado a servicio (`generatePurchaseOrderFromSuggestion`) es un handler de click, no un efecto |
| Ajustes de Stock (`TabAdjustments`) | No | Formulario decorativo sin service (confirmado también en `PENDIENTES.md`) |
| Categorías (`TabCategories`) | No | Sin `useEffect`/`useState`/import de mock — componente sin datos detectado |
| Listas de Precios (`TabPriceLists`) | No | Mismo caso que Categorías |
| Historial del Producto (`TabProductHistory`) | No | Prop estática (`INVENTORY_MOCK_DATA.history`) |
| Importar/Exportar (`TabImportExport`) | No | Sin datos, decorativo (confirmado también en `PENDIENTES.md`) |

### D4. Latencia simulada vs. render, y peticiones en cadena

**Aviso importante, no mencionado en el pedido original:** `VITE_MOCK_LATENCY_MS`
(configurable, default 300ms) **solo afecta a `httpClient`**, que HOY solo usa
`suppliers.service.ts` en su totalidad. `products.service.ts`, `dashboard.service.ts`,
`clients.service.ts`, `purchaseOrders.service.ts` y `deliveries.service.ts` (logistics)
todavía usan un `delay()` manual propio con un `SIMULATED_DELAY_MS` **fijo, no
configurable por variable de entorno**: 400ms para productos/OC/entregas/clientes, 500ms
para sesión, 800ms para dashboard. Esto incluye a `getStockedProductsForBranch`,
`fetchProducts` y `getStockForBranch` — es decir, **ninguna de las cargas de Inventario
pasa por `httpClient`, ninguna aparece en consola con `VITE_API_DEBUG=true`, y ninguna
respeta `VITE_MOCK_LATENCY_MS`/`VITE_MOCK_FAILURE_RATE`.** Confirmado con
`grep "httpClient"` sobre los 6 archivos de servicio: solo aparece en
`modules/suppliers/api/suppliers.service.ts`.

**Estimación de la demora en el montaje default de Inventario (tab "Stock Actual"),
con los valores fijos de arriba:**
- `fetchProducts()` (400ms) y `fetchSuppliers()` (~300ms vía `httpClient`, en paralelo por
  `Promise.all`) → termina en ~400ms (el más lento de los dos).
- `getStockedProductsForBranch` primera llamada arranca en paralelo con lo anterior
  (~400ms), pero su resultado se descarta (D2).
- `getStockedProductsForBranch` segunda llamada arranca recién cuando `products` cambia
  (~400ms después del inicio) y tarda otros 400ms más → **termina en ~800ms**.

**Esto es una cadena real** (el prompt pedía señalarlo si existía): la segunda llamada a
`getStockedProductsForBranch` no puede empezar hasta que `fetchProducts` haya resuelto,
así que el tiempo total hasta que "Stock Actual" muestra datos reales es
aproximadamente **800ms**, el doble de lo que tomaría una sola llamada, y con una llamada
completamente desperdiciada en el medio. El render en sí (React reconciliando ~28 filas de
tabla) es del orden de unos pocos milisegundos — no es la causa de la demora percibida;
la cadena de red simulada sí lo es.

---

## E. Estado en Zustand vs. estado de servidor

Solo existen **2 stores de Zustand en todo el proyecto** (`grep "= create<"` sobre `src/`):

### E1/E2. `useSessionStore.ts`

- `session: SessionUser | null` — **estado de servidor** (viene de `fetchSession()`,
  `useSessionStore.ts:78`). Es un singleton cargado una sola vez (idempotente,
  `useSessionStore.ts:71-73`), no una lista — encaja mal como "candidato a migrar a
  TanStack Query" en el sentido de listas/catálogos, pero técnicamente es dato de servidor
  viviendo en un store de Zustand.
- `activeBranchId: Branch['id'] | null` — **estado de UI** (qué sucursal eligió ver el
  usuario, persistido en `localStorage` como conveniencia, `useSessionStore.ts:99`). No
  viene del servidor, es una elección local.

### E3. ¿Mezcla ambos?

**Sí — `useSessionStore` mezcla los dos** en el mismo store: `session` (servidor) y
`activeBranchId` (UI) conviven en `SessionState` (`useSessionStore.ts:40-47`). No hay
separación entre ambos hoy.

### `useReplenishmentStore.ts` (inventory)

**100% estado de UI, no de servidor** — confirmado explícitamente en el propio código
(`useReplenishmentStore.ts:35`: *"Nada solicitado al arrancar; es estado de sesión, no
viene del mock"*). Rastrea qué productos el usuario marcó "Solicitar reposición" en esta
sesión del navegador — nunca se persiste ni se lee de ningún service. **No es candidato a
migrar** a `useCachedQuery`.

**Conclusión de la sección E:** no hay ningún store de Zustand hoy que sea un cache de
datos de servidor disfrazado (el escenario que suele justificar sacarlo de Zustand y
pasarlo a TanStack Query) — el problema de cache de este relevamiento está enteramente en
`useState` local dentro de componentes (A1/A3), no en Zustand.

---

## F. Línea de base para medir

### F1. Llamadas a servicios por pantalla (montaje default, sin clickear tabs secundarias)

| Pantalla | Llamadas | Con cache hoy (Tanda 2) |
|---|---|---|
| Dashboard (`/`) | 1 (`fetchDashboardData`) | No |
| Inventario (`/inventario`) | 4 (`fetchProducts`, `fetchSuppliers`, `getStockedProductsForBranch` ×2) | No |
| Clientes (`/clientes`) | 1 (`fetchClients`) | No |
| Proveedores (`/proveedores`) | 1 (`fetchSuppliersPage`, vía `usePagedQuery`) | **Sí** |
| Compras (`/compras`) | 3 (`fetchSuppliers`, `fetchProducts`, `getPurchaseOrdersPage` vía `usePagedQuery`) | Parcial (solo la 3ra) |
| Logística (`/logistica`) | 1 (`getDeliveriesPage` vía `usePagedQuery`) | **Sí** |
| Caja (`/caja`) | 0 (estado local desde el mock, sin service) | N/A |
| Pedidos (`/pedidos`) | 0 (estado local desde el mock, sin service) | N/A |
| Analítica (`/analitica`) | 0 (lookup síncrono) | N/A |
| Configuración (`/settings`) | 0 por tab (todas leen el mock directo, sin service) | N/A |

### F2. Valor actual de `staleTime`/`gcTime` y qué cubren

Confirmado en `shared/api/queryClient.ts:53-56`:
```
staleTime: 30_000,       // 30s
gcTime: 5 * 60_000,      // 5 min
refetchOnWindowFocus: false,
retry: false,
```
Hoy cubren únicamente las queries armadas por `usePagedQuery` (los 7 listados paginados) —
ninguna de las cargas de la sección A pasa por `useQuery`, así que ninguna se beneficia de
estos defaults todavía.

### F3. ¿El `QueryClientProvider` llega a todos los módulos?

**Sí.** Confirmado en `shared/routes/AppRoutes.tsx:45-109`: envuelve `<Routes>` completo
(dentro del `ErrorBoundary` global, por encima de `<AppShell>`), así que estructuralmente
todos los módulos ya tienen acceso a `useQueryClient()`/`useQuery()` — el motivo por el que
solo 7 listados lo usan hoy es que solo esos migraron a `usePagedQuery`, no una limitación
del Provider.

---

## Tabla maestra

| Dato | Dónde se carga | Naturaleza | Depende de | Quién lo muta | Se pide N veces (recorrido C3) | Prioridad de cachear |
|---|---|---|---|---|---|---|
| Catálogo de Productos (`fetchProducts`) | `InventoryPage.tsx:84`, `ComprasPage.tsx:118`, `CreateOrderModal.tsx:29` | Catálogo | Ninguna (implícito) | `createProduct`/`updateProduct`/`deleteProduct` (solo Inventario) | 3 | **Alta** |
| Lista de Proveedores (`fetchSuppliers`) | `InventoryPage.tsx:84`, `ComprasPage.tsx:110` | Catálogo | Empresa | `createSupplier`/`updateSupplier` (Proveedores) | 3 | **Alta** |
| Stock por sucursal unido a catálogo (`getStockedProductsForBranch`) | `InventoryPage.tsx:111` | Operativo | Sucursal | Ninguno hoy | 4 (2 por montaje × 2 montajes) | **Alta** |
| Stock puntual de un producto (`getStockForBranch`) | `ComprasPage.tsx:184`, `StockAdjustmentModal.tsx:31`, `OrderProductsSection.tsx:60` | Operativo | Sucursal | Ninguno hoy | No relevado en el recorrido C3 (depende de interacción, no de montaje) | Media |
| Directorio de Clientes (`fetchClients`) | `ClientsPage.tsx:48` | Catálogo | Ninguna (empresa) | `createClient`/`updateClient` | 1 | Media |
| Dashboard (`fetchDashboardData`) | `useDashboard.ts:30` | Derivado/Agregado | Ninguna | Nadie | 1 | Baja |
| Historial de OC por proveedor (`getPurchaseOrdersBySupplierId`) | `SupplierDetailPanel.tsx:90` | Operativo | Empresa (vía supplierId) | `updatePurchaseOrderStatus`, `generatePurchaseOrderFromSuggestion` — sin invalidar hoy | Se repite en cada apertura del panel, incluso mismo proveedor | Media |
| Pedidos (estado local, `ORDERS_MOCK_DATA`) | `OrdersPage.tsx:55` | Operativo | A confirmar | Ninguna (sin service) | — | Baja (problema distinto: no hay persistencia, no solo cache) |
| Caja (estado local, `CASH_MOCK_DATA`) | `CashPage.tsx:14` | Operativo | A confirmar | Ninguna (sin service) | — | Baja (mismo caso que Pedidos) |
| Analítica (`ANALYTICS_DATA[period]`) | `AnalyticsPage.tsx:55` | Derivado/Agregado | Ninguna | Nadie, estático | — | Baja (ya es síncrono, nada que cachear) |
| Config. — Usuarios/Roles/Auditoría/Facturas | `TabUsersRoles.tsx`, `AuditLogWidget.tsx`, `TabSubscription.tsx` | Catálogo/Derivado | Empresa | Sin mutador real | — | Baja (sin service real todavía, no hay nada async que cachear) |

---

## Preguntas abiertas

1. **¿`useCachedQuery` debe cubrir también los "get puntual" (`getStockForBranch`,
   `getPurchaseOrdersBySupplierId`) o solo catálogos/listas completas?** Son formas
   distintas de key (una entidad por id, no una lista completa) — decide si el hook
   hermano necesita una variante o si es el mismo hook con una key de un solo elemento.
2. **¿Qué política de invalidación cruzada querés para `generatePurchaseOrderFromSuggestion`
   (Inventario) → cache de Compras (`getPurchaseOrdersPage`, ya en TanStack Query)?** Hoy
   ninguna mutación de un módulo invalida el cache de otro salvo el barrido total por
   cambio de sucursal/empresa (Tanda 2). ¿Invalidación total también acá, o algo más
   quirúrgico por key?
3. **Pedidos y Caja no tienen ningún service** — leen su mock directo a `useState` y
   pierden cualquier mutación al desmontar. ¿Entra en el alcance de este trabajo crearles
   un service (mismo patrón que `products.service.ts`) antes de poder cachearlos, o eso
   queda fuera y se documenta como deuda aparte (ya hay un ítem parecido en
   `PENDIENTES.md` para Pedidos, scope empresa/sucursal sin decidir)?
4. **`fetchProducts()`/`fetchSuppliers()` no reciben `branchId` ni filtran por sucursal —
   ¿son realmente de alcance empresa (nunca cambian con la sucursal activa), o falta
   confirmarlo como se hizo explícitamente con `Supplier`/`ClientAccount` en tandas
   anteriores?** Ninguna decisión previa lo confirma para el catálogo de productos en sí
   (distinto del STOCK del producto, que sí es por sucursal).
5. **¿El catálogo de Productos y la lista de Proveedores deberían migrar a
   `usePagedQuery`/paginación server-side en vez de a un `useCachedQuery` sin paginar?**
   Hoy son listas completas (28 y 3 registros) sin límite — a una escala mayor (miles de
   productos) un cache sin paginar de la lista completa no resuelve el problema de fondo,
   solo lo pospone. Vale la pena decidir esto antes de diseñar el hook, no después.
6. **`useSessionStore` mezcla `session` (servidor) con `activeBranchId` (UI) en el mismo
   store (E3) — ¿separarlo es parte de esta tarea o queda fuera?** No es estrictamente un
   caso de "dato no paginado sin cache" (session ya es idempotente y no se repite), pero
   es el único caso de mezcla real encontrado en Zustand.
