## [25/08/2026] — Organización de Carpetas y Separación de Responsabilidades

### 1. Principio general
Todo el código fuente de la aplicación vive exclusivamente dentro de "src/". La raíz del proyecto contiene únicamente archivos de configuración ("package.json", "tsconfig.json", configuración de framework, linters y estilos globales de build). Ningún componente de negocio o vista se ubica fuera de "src/".

### 2. Mapa de carpetas

| Carpeta | Propósito |
|---|---|
| "src/app" (o "pages") | Rutas de la aplicación (según framework) |
| "src/core/entities" | Entidades de dominio |
| "src/core/use-cases" | Casos de uso / lógica de aplicación |
| "src/core/repositories" | Contratos de acceso a datos |
| "src/core/value-objects" | Objetos de valor inmutables |
| "src/modules" | Módulos de negocio (uno por dominio funcional del ERP) |
| "src/infrastructure/api" | Clientes de API concretos |
| "src/infrastructure/config" | Configuración de infraestructura |
| "src/shared/components" | Componentes de UI reutilizables (ubicación respetada de lo ya existente del usuario) |
| "src/shared/hooks" | Hooks reutilizables |
| "src/shared/utils" | Utilidades transversales |
| "src/shared/types" | Tipos e interfaces compartidos (ubicación única, no duplicada) |
| "src/shared/state" | Stores de estado global (zustand) |
| "src/assets/icons", "src/assets/images" | Recursos estáticos globales |
| "src/styles" | Estilos globales adicionales a los ya definidos por el usuario |

### 3. Reubicaciones realizadas en esta etapa
- **Origen:** "src/types/*" → **Destino:** "src/shared/types/"
  - **Motivo:** Consolidar todos los tipos bajo el dominio de "shared", resolviendo la existencia previa simultánea de "src/types" y "src/shared/types", en estricto cumplimiento de la norma de ubicación única para código compartido. Se actualizaron exitosamente las rutas relativas de import en los 50 archivos referenciantes.

### 4. Norma de ubicación única
Ninguna categoría de archivo (tipos, assets, estilos globales, lógica de dominio) puede tener más de una ubicación válida en el proyecto. Si en el futuro parece necesaria una carpeta nueva para algo que ya tiene ubicación definida en esta tabla, se debe reutilizar la existente, no crear una alternativa.

## [28/08/2026] — Relevamiento de Estado Real de Módulos

### 1. Contexto
Relevamiento de lectura pura del código existente (sin modificar lógica) para tener un mapa actualizado antes de sumar features nuevas. Cubre los 9 módulos de negocio de `src/modules/` más el scaffold `_template/`. `BackEnd/` sigue vacío — todo lo relevado acá es frontend con datos mock.

### 2. Vigencia de la documentación existente
- Este archivo y `RUTAS_Y_MODULOS.md` describen correctamente la ubicación real de carpetas (`shared/routes`, `shared/layouts`, `shared/components/ui`, `shared/types`).
- La estructura de módulo "objetivo" descripta en `RUTAS_Y_MODULOS.md` (`views/`, `components/`, `services/`, `types/`, `index.ts`) **no está implementada en ningún módulo real** — es solo el scaffold vacío de `src/modules/_template/` (4 carpetas sin archivos + `index.ts` vacío). Los 9 módulos reales son planos: `<Nombre>Page.tsx` + `components/`.
- `ARCHITECTURE.md` (raíz de `FrontEnd/`) — **eliminado el 28/08/2026**, ver `[28/08/2026] — Eliminación de ARCHITECTURE.md` al final de este archivo.
- `src/hooks/useDashboard.ts` y `src/services/mock/dashboard.service.ts` siguen sin migrarse a `shared/hooks/`/`shared/services/` o al módulo `dashboard/services/`.

### 3. Mapa de módulos existentes

| Módulo | Página(s) / vistas | Mock data (forma) | Store zustand | Validación zod | Patrón de lista usado | Relación con otros módulos (por convención de nombres, no por import) |
|---|---|---|---|---|---|---|
| `dashboard` | `DashboardPage.tsx` (única vista) | `dashboard.data.ts` → objeto único `DASHBOARD_MOCK_DATA: DashboardData` (`kpis[]`, `salesSeries[]`, `topProducts[]`, `recentOrders[]`) | Ninguno | Ninguna | Tabla HTML propia sin paginar (`RecentOrdersTable`, no usa `Table` compartido) | `orders` (campos de `recentOrders` calcan `Order`); duplica el concepto de KPI/top-productos de `analytics`, `logistics`, `cash` |
| `analytics` | `AnalyticsPage.tsx` (única vista) | `analytics.data.ts` → objeto `ANALYTICS_DATA` indexado por `TimePeriod` (`today`\|`week`\|`month`\|`year`), cada entrada un `AnalyticsPeriodData` | Ninguno | Ninguna | Tabla HTML propia sin paginar (`TopDebtorsTable`) | `clients` (`TopDebtor` ≈ `ClientAccount` con deuda), `cash` (`cashFlow` ≈ `CashRegister`) |
| `cash` | `CashPage.tsx` (única vista) | `cash.data.ts` → objeto único `CASH_MOCK_DATA: CashRegister` con `transactions[]` anidado | Ninguno | Ninguna | Tabla compartida (`Table`, vía `CashTransactionsTable`) | `orders`/`suppliers` (campos libres `entity`/`linkedVoucher`, referencia informal, no FK) |
| `clients` | `ClientsPage.tsx`, 3 tabs (`directorio`/`cuentas`/`morosos` desde `[01/09/2026]`), sin ruta propia | `clients.data.ts` → array `CLIENTS_MOCK_DATA: ClientAccount[]` con `transactions[]` anidado (29 cuentas desde `[01/09/2026]`) | Ninguno | Ninguna | `ClientDirectoryTable`: HTML propia sin paginar (fuera de alcance). `ClientAccountsTable`/`ClientOverdueTable` (nueva): `Table`/`Pagination`/`usePagedQuery` — paginadas server-side, con búsqueda debounced (`useDebouncedValue`) compartida desde `ClientsPage` | `orders`/`logistics` (`clientName`/`zone`/`sellerName`), `analytics` (`topDebtors`) |
| `inventory` | `InventoryPage.tsx` con 9 tabs (stock, **bajo stock mínimo**, movimientos, reposición, ajustes, categorías, precios, historial, import/export) — stock filtrado por sucursal activa desde `[01/09/2026]`; `TabLowStock` paginada server-side desde `[01/09/2026]` (contrato de paginación); `TabPurchases` ("Reposición") con "Generar OC" conectado desde `[01/09/2026]` (ver `compras`) | `inventory.data.ts` → objeto único `INVENTORY_MOCK_DATA: InventoryData` (`items[]` — 19 productos desde `[01/09/2026]`, sin stock; `movements[]`, `suggestions[]` con `branchId`+`productId` desde `[01/09/2026]`, `history[]`) + `productStock.data.ts` → array `PRODUCT_STOCK_MOCK_DATA: ProductStock[]` (stock/mínimo por producto x sucursal, entidad aparte) | **`useReplenishmentStore`** (`modules/inventory/state/`) — segundo store real del proyecto; ver `DECISIONES_TECNICAS.md` `[28/08/2026] — Productos Bajo Stock Mínimo`. Distinto del flujo de "Generar OC" de `TabPurchases` (ese no usa store, llama directo a `purchaseOrders.service`). Sin store nuevo para el stock por sucursal ni para la paginación | Ninguna (sin formulario en esta tab) | Tabla compartida (`Table`) — 7 de los 9 tabs. `TabLowStock` se autoconsulta con `Pagination`/`usePagedQuery` (paginación server-side, ver `COMPONENTES_Y_LAYOUTS.md`) | `suppliers` (`supplierId: Supplier['id']` tipado desde `[01/09/2026]`, antes informal por nombre), `orders` (`sku`, y `OrderProductsSection` lee stock de la sucursal activa vía `products.service`), `compras` (`TabPurchases` resuelve `PurchaseSuggestion.productId` → `InventoryItem.supplierId` y llama a `generatePurchaseOrderFromSuggestion`, nunca por `supplierName`), `session`/`shared` (`activeBranchId`, filtrado de stock) |
| `logistics` | `LogisticsPage.tsx` ("Entregas del Día") — paginado server-side desde `[01/09/2026]` (contrato de paginación) | `logistics.data.ts` → array `LOGISTICS_MOCK_DATA: Delivery[]` (18 entregas, fechas relativas a `new Date()`), consumido por `deliveries.service.ts` (mock backend: filtra/ordena/cuenta/corta el, no un store) | Ninguno — `useDeliveriesStore` se eliminó al migrar a paginación server-side; `advanceDeliveryStatus` pasó a ser una función async de `deliveries.service.ts` (muta una variable de módulo, mismo patrón que `productsStore` de `products.service.ts`), ver `DECISIONES_TECNICAS.md` `[01/09/2026] — Contrato de datos paginado server-side`, P10 | Ninguna (sin formulario en este módulo) | **Tabla paginada server-side** (`DeliveriesTable` + `Pagination`/`usePagedQuery`) + filtro por estado (`DeliveryFilters`); KPIs y contadores del filtro desde agregados del servicio, nunca del array de la página (P3). *(Actualizado 28/08/2026: reemplazó al Kanban `LogisticsCard`, que se eliminó del proyecto)* | `orders` — `orderId: Order['id']` es ahora una referencia de tipo real, no solo convención de nombre |
| `orders` | `OrdersPage.tsx` (única vista) | `orders.data.ts` → array `ORDERS_MOCK_DATA: Order[]`, con `items[]`/`history[]` anidados | Ninguno | Ninguna | Tabla compartida (`Table`) + la barra de filtros más completa del proyecto (`OrderFilters`: búsqueda + estado + forma de pago + vendedor + rango de fechas) — implementación más cercana al patrón estándar definido en `COMPONENTES_Y_LAYOUTS.md`, pero sin paginar | `clients`, `logistics`, `suppliers`, `inventory`, `cash` (múltiples campos compartidos por convención) |
| `settings` | `SettingsPage.tsx` con 5 tabs (perfil, usuarios, comercial, preferencias, suscripción) + 2 widgets (backup, auditoría) | `settings.data.ts` → varios exports sueltos (`SETTINGS_MOCK_USERS`, `SETTINGS_MOCK_PERMISSIONS`, etc.), no un objeto único | Ninguno | Ninguna | Mixto: tabla compartida (`Table`) para usuarios/facturación **+** tabla HTML propia para la matriz de permisos (grid de checkboxes, no un listado tradicional) — ambas conviven en `TabUsersRoles.tsx` | Referencia cruzada a **todos** los módulos vía `PermissionMatrix.modules` (`dashboard`, `pedidos`, `inventario`, `clientes`, `proveedores`, `logistica`, `caja`, `analitica`) |
| `suppliers` | `SuppliersPage.tsx` (única vista) | `suppliers.data.ts` → array `SUPPLIERS_MOCK_DATA: Supplier[]` con `products[]` anidado (`purchaseOrders[]` eliminado desde `[01/09/2026]`, ver `compras`) | Ninguno | Ninguna | Tabla compartida (`Table`, `SuppliersTable`) + filtros (búsqueda + categoría). El modal de alta de OC (antes local, `PurchaseOrderModal`) se migró a `compras` desde `[01/09/2026]` — "Nueva Orden de Compra"/"Nueva OC" navegan a `/compras` en vez de abrir un modal propio | `inventory` (`sku`/`category`/`cost` calca `InventoryItem`), `compras` (lee OC por `supplierId` vía `services/mock/purchaseOrders.service#getPurchaseOrdersBySupplierId`, nunca del campo embebido eliminado) |
| `compras` | `ComprasPage.tsx` (única vista), ruta `/compras` — nombre de carpeta en **español**, excepción deliberada a la convención de nombres en inglés del resto de los módulos (ver `DECISIONES_TECNICAS.md`, `[01/09/2026] — Módulo Compras`, O1, para el porqué); los tipos sí siguen la convención en inglés (`PurchaseOrder`, no `OrdenDeCompra`) | `purchaseOrders.data.ts` → array `PURCHASE_ORDERS_MOCK_DATA: PurchaseOrder[]` (33+ órdenes, con `lines[]` anidadas — sin campo `amount`/`total` propio, siempre derivado) | Ninguno | Sí — `PurchaseOrderFormModal` (react-hook-form + zod, `useFieldArray` para las líneas) | Tabla paginada server-side (`PurchaseOrdersTable` + `Pagination`/`usePagedQuery`/`FetchingOverlay`) + filtros tipados (proveedor/estado/sucursal) + búsqueda debounced (`useDebouncedValue`) + resumen por estado (`PurchaseOrderStatusSummary`, agregados por `status:currency`, mismo patrón que `AgingBucketAggregate`) + detalle en `SidePanel` (`PurchaseOrderDetailPanel`) | `suppliers` (`supplierId: Supplier['id']`), `inventory` (`branchId: Branch['id']`, `productId: InventoryItem['id']` en cada línea; "Generar OC" de `TabPurchases` la crea), `session`/`shared` (`activeBranchId` como default de sucursal al crear, nunca como filtro del listado) |
| `_template` | Sin páginas — 4 carpetas vacías (`components/`, `services/`, `types/`, `views/`) + `index.ts` vacío | — | — | — | — | Es el scaffold "objetivo" declarado en `RUTAS_Y_MODULOS.md`; ningún módulo real lo sigue todavía |

### 4. Hallazgos transversales
- **Ningún módulo usa `zustand`** (0 archivos en `src/` importan `'zustand'`); `src/shared/state/` ni siquiera existe como carpeta todavía, pese a estar declarado en el mapa de carpetas (punto 2) y en `DECISIONES_TECNICAS.md`. Todo el estado es local por página (`useState`/`useMemo`). *(Actualizado 28/08/2026: ya no es cierto para `logistics`, que ahora tiene `useDeliveriesStore` en `modules/logistics/state/` — sigue siendo cierto para los otros 8 módulos y para `shared/state/`, que sigue sin existir)*
- **Ningún módulo usa `zod`** (0 archivos importan `'zod'`, 0 archivos usan `react-hook-form`). Ningún formulario (`CreateOrderModal`, `CreateClientModal`, `ProductFormModal`, `SupplierFormModal`, etc.) tiene validación declarativa. *(Sigue vigente al 28/08/2026 — la feature de entregas de `logistics` no agregó ningún formulario, así que tampoco usó `zod`)*
- Ver `DECISIONES_TECNICAS.md` (entradas `[28/08/2026] — Inconsistencias Encontradas Entre Módulos` y `[28/08/2026] — Primer Uso Real de zustand, lucide-react y sonner...`) para el detalle completo de estos y otros hallazgos.

## [28/08/2026] — Eliminación de ARCHITECTURE.md

### 1. Diagnóstico: por qué existía
Se verificó el archivo en el filesystem antes de tocarlo: existía, con fecha propia "Generado: 2026-08-24" en su encabezado — un día antes de que empezara el registro de decisiones en `docs/` (25/08/2026 en adelante). Es un **resabio de una limpieza anterior que no se completó**, no un archivo recreado por error: fue la foto de arquitectura tomada justo después de la primera reestructuración DDD, y las reestructuraciones posteriores (25/08/2026: mudanza de `src/router/` a `src/shared/routes/`, de `src/components/ui/` y `src/components/layout/` a `src/shared/components/ui/` y `src/shared/layouts/`, de `src/types/` a `src/shared/types/`, documentadas en este archivo y en `RUTAS_Y_MODULOS.md`/`COMPONENTES_Y_LAYOUTS.md`) nunca volvieron a actualizarlo ni lo eliminaron.

### 2. Qué contenido era obsoleto/duplicado (no se migró)
- La sección "Estructura de Carpetas Real" describía `src/components/ui`, `src/components/layout`, `src/router/` y `src/types/` como ubicaciones vigentes — las cuatro están **desactualizadas**: ya se movieron a `src/shared/components/ui/`, `src/shared/layouts/`, `src/shared/routes/` y `src/shared/types/` respectivamente (ver punto 3 de la entrada `[25/08/2026]` de este mismo archivo). Contenido incorrecto, no se preserva.
- La descripción de `src/modules/` (9 módulos, Page + components/) y de `src/data/mock/` (mock por módulo) ya está cubierta, con más detalle y al día, en la sección 3 "Mapa de módulos existentes" de este archivo.
- La descripción de `src/core/` y `src/infrastructure/` (capa DDD futura, vacía) ya estaba duplicada tal cual en la tabla "Mapa de carpetas" de la sección 2 de este archivo.
- Las notas sobre `src/hooks/useDashboard.ts` y `src/services/` (preexistentes, sin migrar) ya están cubiertas en la sección 2 "Vigencia de la documentación existente" de este archivo.

### 3. Qué contenido no estaba cubierto en ningún otro doc (migrado antes de borrar)
La sección "Stack Tecnológico" (versiones de framework, routing, gráficos, estilos, linting/formateo, gestor de paquetes) no aparecía en ningún archivo de `docs/`. Se migra acá:

| Categoría | Elección |
|---|---|
| Framework | React 19 + Vite 8 |
| Lenguaje | TypeScript 6 |
| Routing | react-router-dom v7 |
| Gráficos | recharts |
| Estilos | CSS puro por módulo/componente (sin Tailwind, sin CSS-in-JS) |
| Linting | ESLint 10 (flat config) + typescript-eslint + eslint-plugin-react-hooks |
| Formateo | Prettier 3 (configurado en `.prettierrc.json`, **no aplicado globalmente todavía** — no reformatear archivos enteros como efecto secundario de un cambio) |
| Gestor de paquetes | npm |

También se preserva, porque tampoco estaba en ningún otro doc, el detalle de `src/styles/` (carpeta preexistente, no se debe reestructurar sin necesidad concreta): `variables.css` (design tokens), `reset.css` (normalización base), `global.css` (estilos globales) y `typography.css` (sistema tipográfico) — importados en ese orden exacto desde `src/main.tsx` (el orden importa por cascada CSS).

### 4. Resultado
`FrontEnd/ARCHITECTURE.md` fue eliminado. Su contenido vigente y no duplicado quedó migrado en el punto 3 de esta entrada; el resto ya estaba (más actualizado) en las demás secciones de este archivo.

## [01/09/2026] — Contexto de sesión y sucursal activa: primer store en `shared/state/`

### 1. Contexto
Infraestructura para el modelo SaaS multi-sucursal: una empresa (inquilino) puede tener varias sucursales, y el usuario opera cambiando la sucursal activa durante la sesión. Tarea de infraestructura pura — no agrega ninguna pantalla de negocio nueva. Cubre tipos, mock/servicio de sesión, el store de sesión, el mecanismo de reset entre stores y la integración de filtrado en `logistics` (único módulo integrado en esta etapa).

### 2. `shared/state/` deja de ser una carpeta solo declarada — primer store real ahí
Desde `[25/08/2026]` el mapa de carpetas de este archivo declara `src/shared/state/` como "Stores de estado global (zustand)", pero hasta esta tarea la carpeta no existía: los dos stores reales del proyecto (`useDeliveriesStore`, `useReplenishmentStore`) viven en `modules/<modulo>/state/`, siguiendo la convención fijada en `[28/08/2026] — Primer `services/` real de un módulo, y carpeta `state/` para stores de zustand` de `RUTAS_Y_MODULOS.md`: un store vive en su módulo mientras sea específico de un dominio, y se promueve a `shared/state/` (mismo nombre de subcarpeta, para que promoverlo sea mover el archivo) cuando deja de serlo.

`useSessionStore` (`shared/state/useSessionStore.ts`) es la primera vez que ese trigger de promoción se activa de entrada, no como migración posterior: la sesión y la sucursal activa no son de un dominio de negocio particular — las consume el layout (selector de sucursal en `Header`) y cualquier módulo que necesite filtrar por sucursal (hoy, `logistics`; a futuro, otros). No tenía sentido crearlo dentro de `modules/logistics/` para después promoverlo.

### 3. `shared/state/resettableStores.ts` — registro central de reset, no importar stores de módulo desde `shared/`
Cuando el usuario cambia de sucursal activa, todo store con datos de negocio debe volver a su estado inicial (si no, se ve stock/estado de la sucursal anterior bajo el rótulo de la nueva — ver `DECISIONES_TECNICAS.md`, D5). La alternativa obvia — que `useSessionStore` importe `useDeliveriesStore` y `useReplenishmentStore` directamente y llame a sus `reset()` — se descartó porque invierte la dirección de dependencia del proyecto: `modules/` depende de `shared/`, nunca al revés (ver `RUTAS_Y_MODULOS.md`, "no importar directamente entre módulos"; el mismo principio aplica a que `shared/` no debería depender de `modules/`).

En su lugar, `shared/state/resettableStores.ts` expone `registerResettableStore(reset)`/`resetAllStores()`: cada store de módulo se auto-registra con una sola línea, junto a su propio `create(...)`, inmediatamente después de definirse (ver `useDeliveriesStore.ts`/`useReplenishmentStore.ts`). `useSessionStore.setActiveBranch` solo conoce `resetAllStores()`, nunca los stores concretos. Se eligió este mecanismo (en vez de que `useSessionStore` importe cada store) precisamente para que quede evidente dónde registrar un store nuevo: la convención está escrita en el propio `resettableStores.ts`, y el patrón a copiar es literal (una línea `registerResettableStore(...)` justo debajo del `export const use...Store = create(...)`).

### 4. `services/mock/session.service.ts` y `data/mock/session.mock.ts` — mismo patrón que el resto
Siguen el patrón ya fijado por `dashboard.service.ts` (`delay` + `structuredClone`), sin ninguna variación nueva. `session.types.ts` se agrega a `shared/types/` junto a los 9 archivos de dominio existentes (ver catálogo en la sección "Types" de `FrontEnd/CLAUDE.md`).

## [01/09/2026] — Inventario multi-sucursal integrado a `inventory` (segundo módulo con filtrado por sucursal)

### 1. Contexto
`inventory` pasa a filtrar por sucursal activa (`useSessionStore`), segundo módulo integrado después de `logistics`. Ver el razonamiento completo (E1-E7) en `DECISIONES_TECNICAS.md`, entrada `[01/09/2026] — Inventario multi-depósito...`. Esta entrada solo registra los cambios de estructura/ubicación de archivos.

### 2. `ProductStock` — entidad nueva, mock y tipo en su propio archivo
`shared/types/inventory.types.ts` suma `ProductStock` (`productId`/`branchId`/`stock`/`minStock`) y el tipo compuesto `StockedInventoryItem = InventoryItem & ProductStock` para las vistas que muestran producto+stock. `InventoryItem` pierde `stock`/`minStock` y `supplier: string` pasa a `supplierId: Supplier['id']` (import de solo tipo).

Mock nuevo: `data/mock/productStock.data.ts` (`PRODUCT_STOCK_MOCK_DATA: ProductStock[]`) — archivo aparte de `inventory.data.ts`, no otra forma más de mock (sigue estando documentado como inconsistencia entre módulos en `DECISIONES_TECNICAS.md`, `[28/08/2026] — Inconsistencias...`, punto 7; esta entidad simplemente no encaja en la forma "objeto único con arrays anidados" que ya usa `INVENTORY_MOCK_DATA`, porque tiene su propio ciclo de vida — ver E1).

### 3. `services/mock/products.service.ts` — mismo archivo, sin promover a módulo
Las funciones de stock (`getStockForBranch`/`getStockedProductsForBranch`/`getLowStockForBranch`, esta última renombrada a `getLowStockPage` en `[01/09/2026] — Contrato de datos paginado server-side` al migrarla al contrato de paginación) se agregaron al servicio de productos ya existente, no a un archivo nuevo `stock.service.ts`: son parte del mismo dominio (RF-INV-001, "stock y reposición", ya documentado como parte de `InventoryItem` en el propio tipo) y ya había precedente de que este archivo mezclara ABM de catálogo con datos de inventario. `stockStore` (módulo, en memoria) sigue el mismo patrón que `productsStore`/`suppliersStore` — clonado del mock al cargar el archivo, sin mutadores en esta tarea.

### 4. Sin store de zustand nuevo en `modules/inventory/state/`
A diferencia de `logistics`/`useReplenishmentStore`, esta tarea no agrega un store: el stock de la sucursal activa se pide de nuevo (`useEffect` keyed por `activeBranchId`) en vez de guardarse en un store con `reset()`. Justificación completa en `DECISIONES_TECNICAS.md` (no hay ninguna mutación de stock en esta tarea, así que no hay nada que resetear que el refetch no resuelva ya).

## [01/09/2026] — Contrato de datos paginado server-side: nuevos archivos y `useDeliveriesStore` eliminado

### 1. Contexto
Infraestructura de paginación/filtrado/orden server-side para los 2 consumidores que ya usaban el patrón de tabla paginada (`LogisticsPage`, `TabLowStock`). Ver el razonamiento completo (P1-P10) en `DECISIONES_TECNICAS.md`, entrada `[01/09/2026] — Contrato de datos paginado server-side`. Esta entrada registra solo los cambios de estructura/ubicación de archivos.

### 2. `shared/types/pagination.types.ts` — tipos genéricos del contrato, ubicación nueva
`PageQuery`/`PageResult`/`PageSort` se agregan como archivo propio en `shared/types/`, junto a los 10 archivos de dominio existentes — es el primer archivo de `shared/types/` que no es específico de un dominio de negocio (`inventory`, `logistics`, etc.), sino un contrato transversal. Cumple igual la norma de ubicación única de tipos (no se creó una carpeta `shared/contracts/` ni similar sin necesidad).

### 3. `shared/hooks/usePagedQuery.ts` reemplaza a `usePagination.ts` (eliminado)
Mismo directorio (`shared/hooks/`), nombre distinto porque la responsabilidad cambió de fondo (ver `DECISIONES_TECNICAS.md`, P4). `usePagination.ts` se borró — cero consumidores fuera de los 2 migrados, no quedó como código muerto.

### 4. `shared/components/ui/FetchingOverlay.tsx` (+ `.css`) — componente nuevo
Junto a `Pagination.tsx`/`Table.tsx`/etc. en `shared/components/ui/`, mismo criterio de ubicación. `shared/components/ui/paginationDefaults.ts` (sin `.tsx`, no es un componente) suma `PAGE_SIZE_OPTIONS` — separado de `Pagination.tsx` porque un archivo de componente solo puede exportar componentes (`react-refresh/only-export-components`), mismo patrón ya usado por `deliveryStatusLabels.ts` respecto de `DeliveriesTable.tsx`.

### 5. `modules/logistics/state/` eliminado por completo
`useDeliveriesStore.ts` era el único archivo de esa carpeta; al eliminarse (ver `DECISIONES_TECNICAS.md`, P10, para el razonamiento completo de por qué se elimina en vez de conservarse con un rol nuevo) la carpeta `modules/logistics/state/` queda sin archivos y se elimina también — `logistics` pasa a no tener ningún store de zustand propio. La mutación de estado de una entrega (`advanceDeliveryStatus`) vive ahora en `modules/logistics/services/deliveries.service.ts`, junto a `getDeliveriesPage` y la variable de módulo `deliveriesStore` (mismo patrón que `productsStore`/`stockStore` de `services/mock/products.service.ts`).

### 6. `shared/state/resettableStores.ts` — un registro menos, sin cambiar la convención
`useDeliveriesStore` era una de las dos referencias de ejemplo en el comentario de convención de ese archivo; se actualizó para no apuntar a un archivo eliminado, dejando `useReplenishmentStore.ts` como referencia y una nota explicando por qué `logistics` ya no necesita registrarse (branchId viaja en los filtros de la consulta — P9 — así que un cambio de sucursal ya dispara un refetch por sí solo, sin necesitar un reset explícito).

## [01/09/2026] — Clientes morosos: nuevos archivos y ampliación de `client.types.ts`/`clients.service.ts`

### 1. Contexto
Primera feature de negocio sobre el contrato de paginación (ver `DECISIONES_TECNICAS.md`, entrada de esta tarea, para M1-M10). Esta entrada registra solo estructura/ubicación de archivos.

### 2. `shared/types/client.types.ts` — filtros y agregados en el archivo de tipos, no en el servicio
A diferencia de `logistics`/`inventory` (donde `DeliveryQueryFilters`/`LowStockQueryFilters` viven directamente en el archivo de servicio), acá `OverdueClientsQueryFilters`/`OverdueClientsSortField`/`OverdueClientsAggregates`/`AgingBucketAggregate`/`OpenInvoice`/`AgingBucket` viven en `client.types.ts` — así lo pedía explícitamente el enunciado de la tarea (3.1). `ClientAccountsQueryFilters`/`ClientAccountsSortField` (la migración de Cuentas Corrientes) sí siguen el patrón anterior y viven en `clients.service.ts`, porque no fueron pedidos en `client.types.ts`. Se deja anotada la inconsistencia entre ambos criterios dentro del mismo módulo — no es un error, son dos decisiones tomadas en momentos distintos con instrucciones distintas.

### 3. `shared/hooks/useDebouncedValue.ts` — hook genérico nuevo
Junto a `usePagedQuery.ts` en `shared/hooks/`. Sin conocimiento de dominio (M6): cualquier búsqueda futura que dispare un fetch server-side lo puede reusar tal cual, sin reimplementar su propio `setTimeout`.

### 4. `modules/clients/agingLabels.ts` — etiquetas y variantes de `AgingBucket`
Mismo criterio que `modules/logistics/deliveryStatusLabels.ts`: separado de `ClientOverdueTable.tsx` porque un archivo de componente solo puede exportar componentes (`react-refresh/only-export-components`).

### 5. `modules/clients/components/ClientOverdueTable.tsx` — componente nuevo
Sigue la convención de nombres ya establecida en el propio módulo (`<Dominio>Table.tsx`, como `ClientAccountsTable`/`ClientDirectoryTable`), no la de `inventory` (`Tab<Nombre>.tsx`) — cada módulo mantiene su propia convención local ya fijada, no se importa la de otro módulo a mitad de camino.

### 6. Estilos: se agregó a `ClientsPage.css`, no un archivo nuevo
`clients` centraliza todo su CSS en un único archivo (`ClientsPage.css`, "Clients Module Centralized Styles") a diferencia de `inventory`/`logistics` (CSS co-ubicado por componente) — convención propia del módulo, ya vigente antes de esta tarea. Las clases nuevas (`.client-aging-summary*`, `.client-overdue*`, `.client-table-wrapper-container`) se agregaron ahí, no en un `ClientOverdueTable.css` nuevo, para no introducir una segunda convención dentro del mismo módulo.

## [01/09/2026] — Módulo Compras: archivos nuevos, ubicación del servicio, y limpieza en `suppliers`

### 1. Contexto
Ver `DECISIONES_TECNICAS.md`, entrada `[01/09/2026] — Módulo Compras: OrdenDeCompra como entidad top-level (O1-O10)`, para el razonamiento completo. Esta entrada registra solo estructura y ubicación de archivos.

### 2. `services/mock/purchaseOrders.service.ts` — convención mayoritaria, no la de `deliveries.service.ts`
La 3.3 de la tarea pedía decidir explícitamente entre `modules/compras/services/` y `services/mock/`, "según la convención vigente" — señal de que esa convención está, de hecho, dividida en el proyecto: `clients.service.ts`, `dashboard.service.ts`, `products.service.ts`, `session.service.ts` y `suppliers.service.ts` (5 servicios) viven en `services/mock/`; solo `deliveries.service.ts` vive en `modules/logistics/services/` (preexistente desde antes de que empezara este registro de decisiones, no introducido por ninguna tarea de esta serie — ver `[01/09/2026] — Contrato de datos paginado server-side`, punto 5, y `[01/09/2026] — Inventario multi-sucursal`, punto 3, que ya notaban "mismo archivo, sin promover a módulo" para `products.service.ts`). Se eligió `services/mock/purchaseOrders.service.ts`, siguiendo la convención mayoritaria y más reciente (el último servicio agregado, `clients.service.ts`, fue ahí) — la excepción de `deliveries.service.ts` queda sin reconciliar, fuera de alcance de esta tarea (O11).

### 3. `shared/types/purchaseOrder.types.ts` — tipos en inglés, carpeta de módulo en español
`PurchaseOrder`/`PurchaseOrderLine`/`PurchaseOrderStatus`/etc., no `OrdenDeCompra`/etc. — sigue la convención en inglés de todos los demás archivos de `shared/types/` (`ClientAccount`, `InventoryItem`, `Delivery`, `Order`...), pese a que la carpeta del módulo que los consume principalmente (`modules/compras/`) está en español por instrucción explícita de la tarea (O1). Ver el detalle completo de por qué la carpeta queda en español en `DECISIONES_TECNICAS.md`, punto 2 de esa entrada.

### 4. `modules/compras/` — mapa de archivos nuevos
```
modules/compras/
  ComprasPage.tsx              — pagina, dueña de usePagedQuery/filtros/estado del deep-link
  ComprasPage.css              — estilos centralizados del modulo (mismo criterio que ClientsPage.css)
  purchaseOrderLabels.ts       — labels/variant de PurchaseOrderStatus (react-refresh/only-export-components)
  components/
    PurchaseOrdersTable.tsx        — tabla "tonta" del listado paginado
    PurchaseOrderFilters.tsx       — barra de filtros (busqueda + 3 selects)
    PurchaseOrderStatusSummary.tsx — resumen por estado, tambien filtro (clickeable)
    PurchaseOrderDetailPanel.tsx   — detalle en SidePanel, lineas + total + transiciones
    PurchaseOrderFormModal.tsx     — alta (migrado desde suppliers, ver DECISIONES_TECNICAS.md O4)
    PurchaseOrderFormModal.schema.ts — schema zod + defaults
    PurchaseOrderFormModal.css     — estilos propios (copiados/adaptados de SupplierModals.css)
```
Sin `state/` (sin store de zustand — no hace falta, mismo patrón que `clients`). Sin `services/` (ver punto 2).

### 5. Ruta y navegación
`shared/routes/AppRoutes.tsx`: `<Route path="compras" element={<ComprasPage />} />`, entre Proveedores y Logística. `shared/layouts/Sidebar.tsx`: `NAV_ITEMS` gana `{ id: 'nav-purchases', label: 'Compras', path: '/compras', icon: IconPurchases }`, mismo lugar (entre Proveedores y Logística) — nuevo ícono SVG inline (`IconPurchases`, un carrito de compras), siguiendo el estilo de los íconos ya existentes (sin librería de íconos para el sidebar, a diferencia del resto del proyecto que sí usa `lucide-react`; se mantiene esa inconsistencia preexistente sin tocarla).

### 6. `modules/suppliers/` — archivos eliminados
`components/PurchaseOrderModal.tsx`, `components/OrderItemsTable.tsx`, `components/OrderFinancialSummary.tsx` — los tres se eliminaron por completo (migrados a `modules/compras/`, no quedó código muerto). `SuppliersPage.tsx`/`SupplierDetailPanel.tsx` se editaron para navegar a `/compras` en vez de abrir esos modales.

### 7. `shared/types/inventory.types.ts` / `data/mock/inventory.data.ts` — `PurchaseSuggestion.productId`
Campo nuevo, tipado (`InventoryItem['id']`), agregado a las 3 sugerencias existentes del mock más una cuarta (`sug-004`, caso de borde de O9 — producto sin proveedor válido) y un producto nuevo (`inv-019`) para poder probarla. Ver `DECISIONES_TECNICAS.md`, punto 11 de la entrada de esta tarea.
