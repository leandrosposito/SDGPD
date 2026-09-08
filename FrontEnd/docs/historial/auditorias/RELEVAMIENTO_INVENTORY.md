# Relevamiento — Migración de `inventory` (Tanda 3e y siguientes)

**Fecha:** 04/09/2026
**Commit relevado:** `f5ead33` (HEAD de `lean` al momento de este relevamiento — Tanda 3d, Directorio de Clientes, ya mergeada)
**Tipo de tarea:** Reconocimiento puro. No se modificó ningún archivo de código — la única escritura es este documento.

---

## A. Estado actual por tab

### A1. Las 9 tabs, una por una

**1. Stock Actual — `src/modules/inventory/components/TabStockCurrent.tsx`**
- Migrada: **NO**.
- Recibe por props: `data` (`StockedInventoryItem[]`), `branchName`, `searchQuery`/`onSearchChange`, `onOpenLots`, `onEditProduct`, `userRole` (`TabStockCurrent.tsx:16-24`). No se autoconsulta.
- Datos reales, no decorativa: 4 `onClick` reales (`TabStockCurrent.tsx:94,101` — "Ver Lotes"/"Editar"; el resto son botones del header de `InventoryPage`).
- Mock: `getStockedProductsForBranch` (join `productsStore` × `stockStore`, `products.service.ts:132-162`) — hoy **19 productos** de catálogo (`inventory.data.ts`, conteo de `items[]`) unidos a **17-18 registros de stock por sucursal** (`productStock.data.ts`, 18/18/17 según sucursal).
- Filtros: búsqueda por sku/barcode/nombre/descripción, **en memoria**, calculada en el padre (`InventoryPage.tsx:134-143`) sobre el array ya traído completo. Sin orden, sin paginación.

**2. Bajo Stock Mínimo — `src/modules/inventory/components/TabLowStock.tsx`**
- Migrada: **SÍ**, ya en una tanda anterior a esta (Tanda 2/pre-3-series, según su propio comentario `TabLowStock.tsx:19-27`).
- Se autoconsulta: `usePagedQuery(getLowStockPage, filters)` (`TabLowStock.tsx:51-62`), recibe `branchId`/`branchName` por props (mínimo indispensable, no todo el dataset).
- Datos reales: `PurchaseOrderService`-style export + `ExportButton` + acciones reales ("Solicitar reposición", "Generar OC" con `useReplenishmentStore`, `navigate`).
- Mock: `getLowStockPage` (`products.service.ts:231-259`), filtra `stockStore` por `branchId` con `record.stock <= record.minStock` (E6).
- Filtros/orden: **server-side** (`LowStockQueryFilters`, `LowStockSortField`), ya con `<Pagination>`.
- **No necesita trabajo en esta ronda de tandas.**

**3. Movimientos — `src/modules/inventory/components/TabMovements.tsx`**
- Migrada: **NO**.
- Recibe por props: `data: InventoryMovement[]` completo (`InventoryPage.tsx:232`, pasa `INVENTORY_MOCK_DATA.movements` directo).
- Datos reales pero **cero `onClick`** en todo el archivo (confirmado por grep, `TabMovements.tsx` no aparece en la lista de 6 archivos con matches de `onClick`) — es una tabla de solo lectura, no decorativa en el sentido de "sin dato real" (aprendizaje 7 de la guía distingue "sin dato" de "sin mutación"; acá hay dato real, solo no hay acción).
- Mock: `INVENTORY_MOCK_DATA.movements` (`inventory.data.ts:69-90`) — **2 registros** hoy.
- Filtros/orden/búsqueda: **ninguno**. Tabla íntegra sin `<Pagination>`.

**4. Reposición (`Compras` interno de Inventario) — `src/modules/inventory/components/TabPurchases.tsx`**
- Migrada: **NO**.
- Recibe por props: `data: PurchaseSuggestion[]` (ya filtrado por `branchId` en el padre, `InventoryPage.tsx:149-152`), `branchName`, `branchId`, `products`, `suppliers` (`TabPurchases.tsx:22-28`).
- Datos reales y **con mutación real**: "Generar OC" (`TabPurchases.tsx:43-109`) llama a `generatePurchaseOrderFromSuggestion` (`purchaseOrders.service.ts`) e invalida cache cruzada hacia Compras.
- Mock: `INVENTORY_MOCK_DATA.suggestions` (`inventory.data.ts:97-149`) — **4 registros**, ya con `branchId` propio.
- Filtros: filtrado por `branchId` **en memoria en el padre** (`.filter()`, no en un service). Sin búsqueda, sin orden, sin paginación.

**5. Ajustes de Stock — `src/modules/inventory/components/TabAdjustments.tsx`**
- Migrada: **NO** — y **no aplica** migrar (ver A2).
- No recibe props, es 100% estado local (`useState` de `productSearch`/`quantity`/`motive`).
- **Decorativa**: cero `onClick` (confirmado por grep). El único handler es `onSubmit={(e) => e.preventDefault()}` (`TabAdjustments.tsx:29`) y un `console.log` en el buscador (`TabAdjustments.tsx:17`). No hay tabla, no hay listado.
- Mock: ninguno.
- Filtros: N/A, es un formulario, no un listado.

**6. Categorías — `src/modules/inventory/components/TabCategories.tsx`**
- Migrada: **NO** — y **no aplica** migrar (ver A2).
- No recibe props. `CATEGORIES_MOCK` está **hardcodeado dentro del componente** (`TabCategories.tsx:19-26`), no sale de `data/mock/inventory.data.ts` ni de ningún service.
- **Decorativa**: cero `onClick` (confirmado por grep) — "Nueva Categoría" (`TabCategories.tsx:36`) y "Editar" (`TabCategories.tsx:57`) son botones sin ningún handler.
- Mock: ninguno real (mock local de UI, 6 filas fijas).
- Filtros: ninguno.

**7. Listas de Precios — `src/modules/inventory/components/TabPriceLists.tsx`**
- Migrada: **NO** — y **no aplica** migrar (ver A2).
- No recibe props. `PRICE_LIST_MOCK` hardcodeado dentro del componente (`TabPriceLists.tsx:19-24`), no sale de ningún mock/service real.
- **Decorativa**: cero `onClick` (confirmado por grep) — "Guardar Cambios" (`TabPriceLists.tsx:38`) sin handler; los inputs de margen son `defaultValue` sin `onChange` (no controlados, no persisten nada).
- Mock: ninguno real (4 filas fijas de UI).
- Filtros: ninguno.

**8. Historial del Producto — `src/modules/inventory/components/TabProductHistory.tsx`**
- Migrada: **NO**.
- Recibe por props: `data: ProductHistoryEvent[]` completo (`InventoryPage.tsx:267`, pasa `INVENTORY_MOCK_DATA.history` directo).
- Datos reales, **cero `onClick`** (confirmado por grep) — misma situación que Movimientos: hay dato real, no hay mutación.
- Mock: `INVENTORY_MOCK_DATA.history` (`inventory.data.ts:150-178`) — **3 registros** hoy.
- Filtros: búsqueda por SKU/nombre **en memoria dentro del propio componente** (`TabProductHistory.tsx:32-35`, `searchTerm` local). Sin orden, sin paginación.

**9. Importar / Exportar — `src/modules/inventory/components/TabImportExport.tsx`**
- Migrada: **NO** — y **no aplica** migrar (ver A2).
- No recibe props, no tiene estado.
- **Decorativa**: cero `onClick` (confirmado por grep) — dropzone y los 2 botones de exportar (`TabImportExport.tsx:45,51`) no tienen ningún handler.
- Mock: ninguno.
- Filtros: N/A.

### A2. Necesitan migración real vs. no

| Necesita migración | Tabs |
|---|---|
| **Sí** | Stock Actual, Movimientos, Reposición, Historial del Producto |
| **Ya migrada, sin trabajo pendiente** | Bajo Stock Mínimo |
| **No — decorativa, confirmado por `grep` de `onClick` (cero matches)** | Ajustes de Stock, Categorías, Listas de Precios, Importar/Exportar |

Nota sobre Movimientos e Historial: a diferencia de las tabs decorativas de `settings` (Tanda 3c), acá SÍ hay dato real de un mock real (`INVENTORY_MOCK_DATA.movements`/`.history`) — el criterio de "no migrar" de la guía (aprendizaje 7) es "cero `onClick` Y cero dato real que un hook pudiera mejorar". Estas dos tabs cumplen la primera condición pero no la segunda: son candidatas al hallazgo #3 de la auditoría (listados sin paginar) aunque no tengan ninguna mutación que conectar — mismo criterio ya usado para el widget de Auditoría en `settings` (Tanda 3c, `useCachedQuery` sin ninguna mutación).

### Hallazgos colaterales fuera de las 9 tabs

- **`ProductLotsPanel.tsx`** — no es una tab (se abre como `SidePanel` desde Stock Actual, `InventoryPage.tsx:325-329`). Ver sección B4.
- **`StockAdjustmentModal.tsx`** — **código huérfano**, confirmado por su propio comentario (`StockAdjustmentModal.tsx:10-15`: "No tiene ningún punto de montaje... es código huérfano preexistente"). Llama a `getStockForBranch` pero no está montado en ningún lado. No forma parte del árbol real de `InventoryPage`.
- **`PurchaseEntryModal.tsx`** — SÍ está montado (`InventoryPage.tsx:320-323`, botón "Registrar Compra"), pero es 100% decorativo: "Cancelar" y "Confirmar Ingreso" ambos solo llaman a `onClose` (`PurchaseEntryModal.tsx:22-23`), el formulario tiene `onSubmit={(e) => e.preventDefault()}` sin ningún handler real.

---

## B. El problema del padre

### B1. Qué carga `InventoryPage.tsx` hoy

Archivo leído completo (`InventoryPage.tsx`, 333 líneas). Carga:

| Dato | Hook | Línea | Reparte a |
|---|---|---|---|
| `products` (catálogo completo, empresa) | `useCachedQuery('products', undefined, fetchProducts, {staleTime: CATALOG})` | `InventoryPage.tsx:79-86` | `TabPurchases` (prop `products`), `ProductFormModal` (prop `existingProducts`) |
| `suppliers` (lista completa, empresa) | `useCachedQuery('suppliers-list', undefined, fetchSuppliers, {staleTime: CATALOG})` | `InventoryPage.tsx:95-104` | `TabPurchases` (prop `suppliers`), `ProductFormModal` (prop `suppliers`) |
| `stockedProducts` (catálogo × stock de la sucursal activa) | `useCachedQuery('stock-by-branch', activeBranchId, getStockedProductsForBranch, {staleTime: OPERATIONAL})` | `InventoryPage.tsx:118-128` | `TabStockCurrent` (prop `data`, ya filtrado por búsqueda) |
| `purchaseSuggestions` (sugerencias de la sucursal activa) | `useMemo` sobre `INVENTORY_MOCK_DATA.suggestions` (no pasa por ningún service) | `InventoryPage.tsx:149-152` | `TabPurchases` (prop `data`) |
| `INVENTORY_MOCK_DATA.movements` (sin transformar) | import directo del mock, sin ningún hook | `InventoryPage.tsx:232` | `TabMovements` (prop `data`) |
| `INVENTORY_MOCK_DATA.history` (sin transformar) | import directo del mock, sin ningún hook | `InventoryPage.tsx:267` | `TabProductHistory` (prop `data`) |

Es el único módulo del proyecto que mezcla los 3 patrones a la vez: (a) `useCachedQuery` real con service+httpClient, (b) `useMemo` sobre un mock importado directo sin service, y (c) paso del mock crudo sin ninguna transformación — dentro del mismo componente padre.

### B2. El patrón "el padre reparte por props" vs. autoconsulta por tab

Impacto de migrar cada tab a que se autoconsulte:

- **Stock Actual**: si se autoconsulta (como ya hace Bajo Stock Mínimo), el padre deja de necesitar `stockedProducts`/`filteredStockedProducts` — pero el padre SIGUE necesitando `products`/`suppliers` para `TabPurchases`/`ProductFormModal`. La búsqueda (`searchQuery`) tendría que pasar de "filtro en memoria en el padre" a "filtro server-side dentro de la tab" (mismo cambio que hizo el Directorio de Clientes en Tanda 3d) — el `ProductSearchBar` seguiría viviendo dentro de `TabStockCurrent`, sin cambio visual.
- **Movimientos/Historial**: autoconsultarse es trivial en términos de acoplamiento (nadie más lee `movements`/`history` en el padre) — el único costo es que cada una necesita su propio DTO+mapper+función de service, aunque el dataset hoy sea chico.
- **Reposición**: autoconsultarse es más delicado, porque la tab también recibe `products`/`suppliers` (para resolver `supplierId` real al generar la OC, O9) — ESOS dos no se autoconsultarían aparte (seguirían viniendo del padre, igual que hoy), solo `data` (las sugerencias) pasaría a autoconsultarse. Es una migración parcial de props, no total, distinto a las otras 3 tabs.
- **Bajo Stock Mínimo**: sin cambios — ya es el patrón de referencia.

Ninguna tab necesita MÁS de lo que el padre ya expone hoy (no hay una dependencia oculta de una tab hacia el estado interno de otra tab) — el acoplamiento es todo padre→hijo por props, nunca hijo↔hijo directo.

### B3. Estado compartido entre tabs (búsqueda explícita, mismo tipo de hallazgo que `clientsStore`)

**No se encontró un equivalente a `clientsStore`** (una variable de módulo compartida por referencia entre funciones de service, con invalidación de cache por igualdad de referencia). Evidencia:

- `products.service.ts` tiene DOS variables de módulo: `productsStore` (`products.service.ts:25`, reasignada en cada mutación) y `stockStore` (`products.service.ts:31`, `const`, nunca mutada — "sin mutadores en esta tarea"). Ninguna las lee por igualdad de referencia para invalidar un cache — la invalidación de `TabStockCurrent`/`TabLowStock` pasa por `queryClient.invalidateQueries` con keys de TanStack Query (`InventoryPage.tsx:172-176`), no por un mecanismo custom como `overdueSnapshotCache`.
- El único estado compartido ENTRE tabs es `useReplenishmentStore` (`useReplenishmentStore.ts`), pero es estado de sesión de UI (qué producto tiene reposición solicitada), no un cache de datos del servidor — ya sigue el patrón estándar del proyecto (`registerResettableStore`, `useReplenishmentStore.ts:58`) y no se ve afectado por cómo se paginen las tabs.
- Lo que SÍ hay (distinto de un bug, es diseño correcto) es **cache compartido entre MÓDULOS** vía `useCachedQuery`: `'products'` y `'suppliers-list'` son el mismo `queryName` que usan `ComprasPage.tsx` y `CreateOrderModal.tsx` (comentario explícito, `InventoryPage.tsx:47-51`) — dedupe intencional, ya documentado en Tanda 2.5. No es un hallazgo nuevo de esta tanda, pero es relevante para la sección D (el service se consume fuera del módulo).

**Conclusión B3: no hay ningún hallazgo tipo Tanda 3d acá.** La complejidad de `inventory` no viene de un estado compartido frágil, viene de (1) el padre gordo repartiendo por props y (2) el service ya siendo cross-módulo (ver D3).

### B4. `ProductLotsPanel` — ¿de dónde saca sus datos? ¿Se rompe si Stock Actual pagina?

- `ProductLotsPanel` recibe `product: InventoryItem | null` por prop (`ProductLotsPanel.tsx:11-15`) y lee `product.lots ?? []` directo (`ProductLotsPanel.tsx:42`) — **no llama a ningún service propio**, no hace ningún fetch.
- `product` es el `selectedProduct` de `InventoryPage` (`InventoryPage.tsx:69`), seteado en `handleOpenLotsPanel` (`InventoryPage.tsx:154-157`) cuando se hace click en "Ver Lotes" de una fila de `TabStockCurrent` (`TabStockCurrent.tsx:94`, `onOpenLots(row)` donde `row: StockedInventoryItem`).
- `StockedInventoryItem = InventoryItem & ProductStock` (`inventory.types.ts:33`) — el objeto `row` que se pasa YA es el producto completo (incluye `lots`, porque `getStockedProductsForBranch` hace `{...product, ...}`, `products.service.ts:150-158`), no un ID que haya que resolver después.
- **Conclusión: NO se rompe si Stock Actual pagina.** El click pasa el objeto completo de la fila (ya con `lots` adentro) directo al estado de React — no importa si esa fila viene de una página 1 de 5 o de un array completo sin paginar, el dato ya está en memoria en el momento del click.
- **Hallazgo colateral, no un bug de esta migración pero sí una inconsistencia de modelado**: `lots` vive en `InventoryItem` (catálogo, EMPRESA — E1) pero un lote es físicamente stock en un lugar concreto. Hoy el mock (`inventory.data.ts:20-23,40-42`) tiene lotes fijos por producto, iguales sin importar la sucursal activa — ver la pregunta abierta en la sección de preguntas.

---

## C. Scope por entidad

| Entidad | Scope | Evidencia | Consistente con "catálogo=empresa, stock=sucursal" |
|---|---|---|---|
| `InventoryItem` (catálogo) | **Empresa** | Ya cerrado en Tanda 2.5 (`DECISIONES_TECNICAS.md`, E1) — sin `branchId` en el tipo (`inventory.types.ts:39-64`). Confirmado de nuevo: cero campo de sucursal en la interfaz. | Sí — es la entidad de referencia. |
| `ProductStock` (stock/mínimo) | **Sucursal** | `ProductStock.branchId: Branch['id']` (`inventory.types.ts:23`), archivo de mock separado (`productStock.data.ts`) a propósito (E1). | Sí — es la entidad de referencia. |
| `ProductLot` (lotes) | **Ambiguo — hoy vive en el catálogo (empresa), pero conceptualmente es físico (sucursal)** | `InventoryItem.lots?: ProductLot[]` (`inventory.types.ts:56`), sin `branchId` en `ProductLot` (`inventory.types.ts:8-13`). El mock (`inventory.data.ts:20-23,40-42`) da lotes fijos por producto, no por combinación producto×sucursal. | **No** — inconsistente con el criterio catálogo/stock. Ver pregunta abierta. |
| `InventoryMovement` (movimientos) | **No modelado — sin campo de sucursal** | `InventoryMovement` (`inventory.types.ts:76-85`): `id, date, sku, productName, type, quantity, user, notes` — ningún `branchId`. Un movimiento físico de stock (ingreso/egreso) ocurre en una sucursal concreta en la realidad, pero el tipo no lo captura. | **No aplica todavía** — el tipo no tiene el campo para evaluar. Ver pregunta abierta. |
| `PurchaseSuggestion` (sugerencias de reposición) | **Sucursal** | `PurchaseSuggestion.branchId: Branch['id']` (`inventory.types.ts:103`), ya filtrado por sucursal en el padre (`InventoryPage.tsx:149-152`), comentario explícito "E1: el stock que la origina es de sucursal" (`inventory.types.ts:101-102`). | Sí. |
| `ProductHistoryEvent` (historial) | **No modelado — sin campo de sucursal** | `ProductHistoryEvent` (`inventory.types.ts:66-74`): `id, date, sku, productName, eventType, description, user` — ningún `branchId`. Mismo caso que `InventoryMovement`. | **No aplica todavía**. Ver pregunta abierta. |
| Categorías (tab decorativa) | N/A — no hay tipo de dominio real, es un mock de UI hardcodeado | `TabCategories.tsx:10-26` | N/A |
| Listas de precios (tab decorativa) | N/A — no hay tipo de dominio real, es un mock de UI hardcodeado | `TabPriceLists.tsx:9-24` | N/A |

**C3 — confirmación del criterio ya cerrado:** catálogo=empresa / stock=sucursal se sostiene sin contradicciones para las dos entidades que ya lo tenían resuelto (`InventoryItem`/`ProductStock`) y para la única entidad nueva con scope ya explícito en el código (`PurchaseSuggestion`, sucursal). Las 3 entidades restantes (`ProductLot`, `InventoryMovement`, `ProductHistoryEvent`) **no tienen un campo de sucursal que confirmar o contradecir** — el código simplemente no modela esa dimensión todavía, a diferencia de los casos de `orders`/`cash` (Tandas 3a/3b) donde SÍ había una hipótesis previa explícita para contrastar contra el código. Acá no hay hipótesis previa que romper, hay una laguna de modelado que requiere una decisión nueva (ver preguntas abiertas).

---

## D. Service existente (`products.service.ts`)

### D1. Estado compartido entre funciones — ¿hay un caso tipo `clientsStore`?

Archivo leído completo (280 líneas, `src/services/mock/products.service.ts`). Dos variables de módulo:
- `productsStore: InventoryItem[]` (`products.service.ts:25`) — reasignada (nunca mutada in-place) en `createProduct`/`updateProduct`/`deleteProduct`.
- `stockStore: ProductStock[]` (`products.service.ts:31`) — `const`, se lee siempre de una copia clonada, **sin ningún mutador todavía** (comentario explícito: "movimientos/ajustes de stock quedan fuera de alcance").

**No hay ningún mecanismo de invalidación por igualdad de referencia** (nada como `overdueSnapshotCache.computedFor === store`). Las funciones que leen ambos stores (`getStockedProductsForBranch`, `filterAndSortLowStock`) arman un `Map` nuevo en cada llamada — no cachean nada a nivel de módulo. **Conclusión: no aplica el aprendizaje 11/12 de la guía (no hace falta "absorber todo el archivo" por una razón técnica de este tipo)** — a diferencia de `clients` en Tanda 3d, acá SÍ sería seguro, en términos de este mecanismo puntual, decidir qué funciones se mueven y cuáles no sin romper nada por referencia compartida.

### D2. Funciones existentes, migradas vs. no

| Función | Línea | ¿Ya migrada a `usePagedQuery`/DTO? |
|---|---|---|
| `fetchProducts` | `products.service.ts:33-40` | Parcial — pasa por `httpClient` (Tanda 2.5) y por `useCachedQuery` en el consumidor, pero sin DTO/mapper (sigue devolviendo `InventoryItem` tal cual). |
| `createProduct` | `products.service.ts:42-59` | Igual que arriba — sin DTO. |
| `updateProduct` | `products.service.ts:61-83` | Igual que arriba — sin DTO. |
| `deleteProduct` | `products.service.ts:85-96` | Igual que arriba — sin DTO. |
| `getStockForBranch` | `products.service.ts:109-123` | Igual que arriba — sin DTO. |
| `getStockedProductsForBranch` | `products.service.ts:132-162` | Pasa por `httpClient`, pero **sin paginación** (comentario propio lo dice: "No esta paginada... queda fuera de su alcance", `products.service.ts:130-131`) y sin DTO. |
| `getLowStockPage` | `products.service.ts:231-259` | **Sí**, completo: `PageQuery`/`PageResult`, filtro+orden+paginación server-side. Sin DTO (pero eso es consistente con el resto del proyecto — el DTO es una capa de Tanda 3, no de la paginación de Tanda 2). |
| `exportLowStock` | `products.service.ts:263-279` | Sí, reusa `filterAndSortLowStock`. |

Nada de `INVENTORY_MOCK_DATA.suggestions`/`.movements`/`.history` pasa hoy por ninguna función de `products.service.ts` — esas 3 tablas nunca tuvieron ningún service, ni siquiera el nivel "Tanda 2.5" (httpClient sin DTO) que ya tienen productos/stock.

### D3. ¿Quién más consume `products.service.ts`? — Hallazgo central de esta tanda

`products.service.ts` **NO es de uso exclusivo de `inventory`** — es el primer service de los que quedan por migrar que ya tiene consumidores reales en OTROS módulos:

| Consumidor | Archivo | Qué importa | Línea |
|---|---|---|---|
| `Compras` | `src/modules/compras/ComprasPage.tsx` | `fetchProducts`, `getStockForBranch` | `ComprasPage.tsx:19` |
| `Pedidos` | `src/modules/orders/components/create-order/CreateOrderModal.tsx` | `fetchProducts` | `CreateOrderModal.tsx:8` |
| `Pedidos` | `src/modules/orders/components/create-order/OrderProductsSection.tsx` | `getStockForBranch` | `OrderProductsSection.tsx:6` |
| `Inventario` (dueño "natural") | `src/modules/inventory/InventoryPage.tsx`, `TabLowStock.tsx`, `StockAdjustmentModal.tsx` (huérfano) | todas las funciones | ya listado en D2 |

`ComprasPage.tsx` documenta esto explícitamente en su propio comentario (`ComprasPage.tsx:49-52`): *"Compras ya carga el catalogo (fetchProducts) — Inventario nunca importa PurchaseOrderFormModal"* — es decir, el proyecto YA tiene un precedente consciente de que Compras lee el catálogo de productos directo, y evita el acoplamiento inverso (Inventario no importa código de Compras) resolviendo todo por deep-link + query params (mismo patrón que "Generar OC" de `TabLowStock`).

**Por qué esto es distinto a todas las tandas anteriores:** `suppliers`/`orders`/`cash`/`settings`/`clients` (Tandas 1, 3a-3d) tenían todos sus consumidores DENTRO del propio módulo — mover el service a `modules/<módulo>/api/` nunca cruzaba una frontera de módulo. Acá, si el nuevo `api/` de productos se crea en `modules/inventory/api/products.service.ts` siguiendo el patrón de siempre, **`modules/compras/` y `modules/orders/` pasarían a importar directo de `modules/inventory/api/`** — una dependencia cross-módulo nueva y explícita, justo lo que R2 busca evitar. Hoy no es una violación de R2 porque `src/services/mock/products.service.ts` vive FUERA de cualquier carpeta de módulo (zona neutral, como documenta `FrontEnd/CLAUDE.md` sobre `src/services/mock/`). Esto es una decisión de arquitectura que esta tanda de reconocimiento no debe resolver por su cuenta — ver preguntas abiertas.

### D4. Lógica que no debe tocarse al mover el archivo

- El join de `getStockedProductsForBranch` vía `Map` indexado por `productId` (`products.service.ts:147-159`) — comentario propio explica que es una optimización deliberada O(n+m) en vez de O(n×m), no tocar el algoritmo al moverlo.
- `filterAndSortLowStock` (`products.service.ts:202-224`) — compartida entre `getLowStockPage` y `exportLowStock`, con desempate estable por `id` (comentario `3.4`) — no duplicar esta lógica entre las dos funciones si se reorganiza el archivo.
- Las validaciones de unicidad de SKU/código de barras en `createProduct`/`updateProduct` (`products.service.ts:48-52,70-76`) — replican la regla de negocio de RF-PRD-001, ya probada.
- E5 (producto sin registro de stock en una sucursal = 0, no error) y E6 (bajo mínimo es `<=`, no `<` estricto) — ambas reglas de negocio ya cerradas y comentadas en el propio código, no reabrir la discusión al migrar.

---

## E. Agregados y KPIs

### E1. Búsqueda de KPIs/agregados calculados sobre un array completo

**Un solo caso encontrado**, en `TabStockCurrent.tsx:35-38`:
```ts
const totalProducts = data.length;
const lowStock = data.filter((item) => item.stock > 0 && item.stock <= item.minStock).length;
const outOfStock = data.filter((item) => item.stock === 0).length;
const totalValue = data.reduce((acc, item) => acc + (item.stock * item.cost), 0);
```
Los 4 KPIs de las tarjetas de "Stock Actual" (Total Productos, Stock Bajo, Sin Stock, Valor Inventario) se calculan sobre `data`, que hoy es el array COMPLETO ya filtrado por búsqueda (no paginado) — correcto hoy, porque `data` nunca es "solo una página".

No se encontró ningún otro cálculo agregado en memoria en el resto de las tabs (`TabLowStock` ya usa `totalItems` de la respuesta paginada, no `data.length` — correcto, `TabLowStock.tsx:117-119`; `TabMovements`/`TabProductHistory`/`TabPurchases` no calculan ningún total).

### E2. ¿Se rompería al paginar?

**Sí, los 4 KPIs de Stock Actual se romperían** en cuanto `TabStockCurrent` se autoconsulte con `usePagedQuery`: `data` pasaría a ser solo la página visible (10-20 filas), y los 4 números mostrarían solo lo de esa página, no el total real del catálogo — el mismo problema exacto que ya se resolvió para `OrderKpis` en Tanda 3a (aprendizaje 2 de la guía). Va a hacer falta un `StockAggregates` (o nombre similar) en el `PageResult` de la función que reemplace a `getStockedProductsForBranch`, calculado sobre TODO lo que matchea el filtro de búsqueda vigente, no sobre `items`.

---

## F. Propuesta de partición

*(Esto es un insumo para decidir, no una implementación — no se escribió ningún código.)*

### F1. Partición propuesta — 3 tandas, en este orden

**Tanda 3e — Fundación: `products.service` → capa `api/` + migración de Stock Actual**
- Resuelve primero la pregunta abierta de dónde vive el `api/` de productos (bloqueante, ver preguntas abiertas) — esto determina si `Compras`/`Pedidos` necesitan repunteo de imports o no.
- Crea `dto.ts`/`mapper.ts`/`products.service.ts` nuevo (ubicación según la decisión), absorbiendo TODAS las funciones ya existentes (`fetchProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `getStockForBranch`, `getStockedProductsForBranch`, `getLowStockPage`, `exportLowStock`) — no hay problema de estado compartido por referencia (D1), así que absorber todo es solo una cuestión de mantener un único archivo prolijo, no una necesidad técnica como en `clients` (Tanda 3d).
- Migra `TabStockCurrent` a `usePagedQuery` (autoconsulta, con `StockAggregates` para los 4 KPIs — E2).
- Repuntea el import de `TabLowStock` (ya migrada, sin tocar su lógica) a la nueva ubicación.
- Repuntea (o no, según la decisión de arquitectura) los imports de `ComprasPage.tsx`/`CreateOrderModal.tsx`/`OrderProductsSection.tsx`.
- **Debe ir primero** porque establece la convención de carpeta/DTO que las tandas siguientes van a reusar, y porque toca el archivo de service que TODAS las demás tabs de este módulo (y 2 módulos externos) ya importan — cualquier tanda posterior que toque `products.service.ts` de nuevo pisaría este trabajo si se hiciera en otro orden.

**Tanda 3f — Reposición (`TabPurchases`) + servicio de sugerencias**
- Crea una función paginada/autoconsultable para `PurchaseSuggestion` (ya tiene `branchId` propio, sin ambigüedad de scope) dentro de la misma carpeta `api/` de inventory establecida en 3e.
- Migra `TabPurchases` a autoconsulta para `data` (las sugerencias) — `products`/`suppliers` siguen viniendo del padre igual que hoy (B2).
- Preserva sin tocar: la resolución de proveedor real vía `supplierId` (O9), el rechazo cuando no hay proveedor válido, y la invalidación cruzada hacia Compras (ya funciona por key de TanStack Query, no requiere cambios).
- Depende de 3e solo por convención de carpeta, no por código compartido — podría en principio ir en paralelo, pero mantenerlo después evita decidir la estructura de `api/` dos veces.

**Tanda 3g — Movimientos + Historial del Producto (listados chicos, sin mutación)**
- Requiere ANTES una decisión sobre si `InventoryMovement`/`ProductHistoryEvent` llevan `branchId` o quedan de empresa (pregunta abierta) — de eso depende el `QueryFilters` de cada una.
- Migra ambas tabs, cada una decidiendo independientemente `usePagedQuery` vs. `useCachedQuery` según tamaño/forma (mismo criterio que Tanda 3c en `settings`) — probablemente `usePagedQuery` para ambas, porque son tablas reales con columnas, no un feed chico de sidebar.
- Sin mutaciones que conectar, sin invalidación cruzada que evaluar (ninguna otra pantalla del proyecto lee `InventoryMovement`/`ProductHistoryEvent`, confirmado por grep — ningún resultado fuera de `inventory`).
- Es la tanda de menor riesgo — puede hacerse en cualquier momento después de que exista la carpeta `api/` de 3e, independiente de 3f.

**Fuera de las 3 tandas — documentar como decorativas, no migrar:**
Ajustes de Stock, Categorías, Listas de Precios, Importar/Exportar (A2) — mismo tratamiento que las 4 tabs decorativas de `settings` en Tanda 3c: quedan señaladas en `DECISIONES_TECNICAS.md` con la evidencia de `grep`, no se les inventa un service.

**No requiere ninguna tanda de migración, pero sí una decisión eventual:** `ProductLotsPanel` (B4) — funciona bien tal cual, la única deuda es conceptual (lotes debería quizás ser por sucursal) y no bloquea nada de lo anterior.

### F2. Tamaño relativo

| Tanda | Tamaño estimado | Por qué |
|---|---|---|
| 3e | **L** | Toca el service más usado del módulo (y usado fuera de él), migra la tab más compleja (KPIs + join + estado compartido con 2 modales), y resuelve una decisión de arquitectura cross-módulo antes de escribir nada. |
| 3f | **M** | Una sola tab, pero con lógica de negocio real (O9) y cache cruzada a preservar sin tocar — más grande que un CRUD simple, más chica que 3e. |
| 3g | **S** (o M si se cuentan las dos tabs juntas, como hizo Tanda 3c con 3 vistas de settings) | Dos tablas de solo lectura, sin mutación, sin invalidación cruzada — el trabajo real es la decisión de scope de `branchId`, no la implementación en sí. |

### F3. La parte más riesgosa

**La ubicación de `api/products` (D3) es, con diferencia, el punto más riesgoso de las 3 tandas.** No es un riesgo de lógica de negocio (como el FIFO de `clients` en Tanda 3d) — es un riesgo de **arquitectura de imports entre módulos**: es la primera vez en todo el proyecto que migrar el service de un módulo obliga a decidir si otros 2 módulos (`compras`, `orders`) van a importar directo de `modules/inventory/api/`, algo que R2 (aislamiento de módulos) viene evitando activamente en cada tanda anterior. Una decisión apurada acá (mover el archivo sin pensar en los 3 consumidores externos) puede:
- Romper `ComprasPage.tsx`/`CreateOrderModal.tsx`/`OrderProductsSection.tsx` si no se repuntean los 3 imports (`tsc -b` lo va a agarrar, pero es más superficie de la que tuvo cualquier tanda anterior).
- O, si se repuntean sin más análisis, dejar fijado un precedente de acoplamiento cross-módulo que después sea difícil de deshacer, justo cuando el resto del proyecto viene evitándolo con cuidado (ver el patrón de deep-link + query params que ya usan `TabLowStock`→Compras y Proveedores→Compras).

El segundo riesgo, más chico pero real, es el KPI de Stock Actual (E2): si el `StockAggregates` nuevo no replica exactamente el criterio E6 (`stock <= minStock`, no `<`) usado en `TabLowStock`, los 4 números de la tarjeta y el listado de "bajo stock" podrían mostrar conteos distintos para el mismo dato — una inconsistencia visible para cualquier usuario que tenga ambas tabs abiertas.

---

## Tabla maestra

| Tab/Vista | Archivo | Estado actual | Entidad | Scope (empresa/sucursal) | Necesita migración | Complejidad (S/M/L) | Tanda propuesta |
|---|---|---|---|---|---|---|---|
| Stock Actual | `TabStockCurrent.tsx` | Recibe por props, sin paginar, con 4 KPIs en memoria | `StockedInventoryItem` (join) | Catálogo=empresa / Stock=sucursal | Sí | L | 3e |
| Bajo Stock Mínimo | `TabLowStock.tsx` | Ya migrada (`usePagedQuery`) | `StockedInventoryItem` | Sucursal | No (ya hecho) | — | — |
| Movimientos | `TabMovements.tsx` | Recibe por props, sin paginar, sin `onClick` | `InventoryMovement` | **No modelado** (sin `branchId`) | Sí | S | 3g |
| Reposición | `TabPurchases.tsx` | Recibe por props (filtrado en el padre), con mutación real | `PurchaseSuggestion` | Sucursal | Sí | M | 3f |
| Ajustes de Stock | `TabAdjustments.tsx` | Decorativa (cero `onClick`, formulario sin submit) | N/A | N/A | No | — | — |
| Categorías | `TabCategories.tsx` | Decorativa (mock local hardcodeado, cero `onClick`) | N/A (no modelado) | N/A | No | — | — |
| Listas de Precios | `TabPriceLists.tsx` | Decorativa (mock local hardcodeado, cero `onClick`) | N/A (no modelado) | N/A | No | — | — |
| Historial del Producto | `TabProductHistory.tsx` | Recibe por props, búsqueda en memoria local, sin `onClick` | `ProductHistoryEvent` | **No modelado** (sin `branchId`) | Sí | S | 3g |
| Importar / Exportar | `TabImportExport.tsx` | Decorativa (cero dato, cero `onClick`) | N/A | N/A | No | — | — |
| *(no es tab)* Panel de Lotes | `ProductLotsPanel.tsx` | Lee `product.lots` directo, sin service propio | `ProductLot` (embebido en `InventoryItem`) | Ambiguo — vive en empresa, conceptualmente físico/sucursal | No (funciona bien tal cual) | — | — |
| *(huérfano)* Ajuste de Stock (modal) | `StockAdjustmentModal.tsx` | No montado en ningún lado | `ProductStock` | Sucursal | No (código muerto) | — | — |
| *(decorativo)* Ingreso por Compra (modal) | `PurchaseEntryModal.tsx` | Montado pero sin ninguna acción real | N/A | N/A | No | — | — |
| — | `src/services/mock/products.service.ts` | Parcial: `httpClient` sí, DTO no, paginación solo en `getLowStockPage` | `InventoryItem` + `ProductStock` | Mixto (ver arriba) | Sí (base de 3e) | L | 3e |

---

## Preguntas abiertas

1. **[BLOQUEANTE para 3e] ¿Dónde vive el `api/` nuevo de productos, dado que `Compras` y `Pedidos` ya importan `products.service.ts` hoy?** (D3). Opciones que se me ocurren para que la decisión sea tuya, no mía:
   - (a) Moverlo a `modules/inventory/api/products.service.ts` y aceptar que `modules/compras/`/`modules/orders/` importen directo de ahí — precedente nuevo de acoplamiento cross-módulo.
   - (b) Dejarlo en una ubicación neutral (por ejemplo, seguir en `src/services/mock/` o mover a algo tipo `shared/api/products/`) para no romper el aislamiento de módulos, aunque el resto de las tandas migradas sí muevan su service a `modules/<módulo>/api/`.
   - (c) Alguna partición intermedia (ej.: las funciones de solo lectura del catálogo quedan neutrales, las mutaciones/paginación específicas de Inventario se mueven a `modules/inventory/api/`).
   No implementé ninguna — es la primera decisión que bloquea empezar 3e.

2. **¿`InventoryMovement` y `ProductHistoryEvent` deberían llevar `branchId`?** (sección C). Hoy ninguno de los dos tipos lo tiene, y conceptualmente un movimiento de stock (ingreso/egreso físico) sí ocurre en una sucursal concreta. Si la respuesta es "sí, hay que agregarlo", es un cambio de tipo (y de mock) antes de escribir el DTO de la Tanda 3g — si es "no, quedan de empresa" (por ejemplo, si se los piensa como un log centralizado), no hace falta tocar el tipo.

3. **¿`ProductLot` debería pasar a ser por sucursal (como `ProductStock`), en vez de vivir embebido en el catálogo (`InventoryItem.lots`)?** (B4, C). Hoy es inconsistente con el criterio ya cerrado de "catálogo=empresa, stock=sucursal": un lote es físicamente stock, pero vive en la entidad de empresa. No es bloqueante para ninguna de las 3 tandas propuestas (`ProductLotsPanel` funciona igual sin importar esto), pero sí es una decisión de modelado pendiente si en algún momento se quiere que los lotes reflejen sucursales distintas.

4. **¿El orden 3e→3f→3g es el que preferís, o preferís adelantar 3g (bajo riesgo, sin dependencias reales) antes que 3f?** F1 explica por qué propongo ese orden (consistencia de carpeta `api/`), pero 3g no depende técnicamente de 3f — si preferís cerrar rápido algo de bajo riesgo primero, el orden podría ser 3e→3g→3f sin ningún costo real.

5. **¿"Ajustes de Stock" y "Categorías"/"Listas de Precios" quedan permanentemente fuera de esta serie de tandas, o hay intención de convertirlos en features reales más adelante?** No es necesario decidirlo ahora (no bloquea 3e/3f/3g), pero si la respuesta es "sí, en algún momento", valdría la pena que quede anotado en `docs/PENDIENTES.md` en vez de perderse — hoy no hay ningún registro de que estas 4 tabs sean intencionalmente placeholders a futuro vs. simplemente incompletas.
