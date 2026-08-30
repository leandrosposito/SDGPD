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
| `clients` | `ClientsPage.tsx`, con 2 vistas por tab (`directorio`/`cuentas`), sin ruta propia | `clients.data.ts` → array `CLIENTS_MOCK_DATA: ClientAccount[]` con `transactions[]` anidado | Ninguno | Ninguna | Tabla HTML propia sin paginar, x2 (`ClientDirectoryTable`, `ClientAccountsTable`) | `orders`/`logistics` (`clientName`/`zone`/`sellerName`), `analytics` (`topDebtors`) |
| `inventory` | `InventoryPage.tsx` con 9 tabs (stock, **bajo stock mínimo**, movimientos, reposición, ajustes, categorías, precios, historial, import/export) | `inventory.data.ts` → objeto único `INVENTORY_MOCK_DATA: InventoryData` (`items[]` — 18 productos, `movements[]`, `suggestions[]`, `history[]`) | **`useReplenishmentStore`** (`modules/inventory/state/`) — segundo store real del proyecto, mismo contrato que `useDeliveriesStore`; ver `DECISIONES_TECNICAS.md` `[28/08/2026] — Productos Bajo Stock Mínimo` | Ninguna (sin formulario en esta tab) | Tabla compartida (`Table`) — 7 de los 9 tabs. La tab nueva `low-stock` (`TabLowStock`) es la **segunda implementación real** del patrón de tabla paginada (`Pagination`/`usePagination`), después de `logistics` | `suppliers` (`supplierName` en `PurchaseSuggestion`, informal — ver opciones propuestas y no implementadas en `DECISIONES_TECNICAS.md`), `orders` (`sku`) |
| `logistics` | `LogisticsPage.tsx` ("Entregas del Día") | `logistics.data.ts` → array `LOGISTICS_MOCK_DATA: Delivery[]` (18 entregas, fechas relativas a `new Date()`) | **`useDeliveriesStore`** (`modules/logistics/state/`) — primer store real del proyecto, ver `DECISIONES_TECNICAS.md` `[28/08/2026]` | Ninguna (sin formulario en este módulo) | **Tabla paginada** (`DeliveriesTable` + `Pagination`/`usePagination` compartidos) + filtro por estado (`DeliveryFilters`) — primera implementación real del patrón oficial, ver `COMPONENTES_Y_LAYOUTS.md`. *(Actualizado 28/08/2026: reemplazó al Kanban `LogisticsCard`, que se eliminó del proyecto)* | `orders` — `orderId: Order['id']` es ahora una referencia de tipo real, no solo convención de nombre |
| `orders` | `OrdersPage.tsx` (única vista) | `orders.data.ts` → array `ORDERS_MOCK_DATA: Order[]`, con `items[]`/`history[]` anidados | Ninguno | Ninguna | Tabla compartida (`Table`) + la barra de filtros más completa del proyecto (`OrderFilters`: búsqueda + estado + forma de pago + vendedor + rango de fechas) — implementación más cercana al patrón estándar definido en `COMPONENTES_Y_LAYOUTS.md`, pero sin paginar | `clients`, `logistics`, `suppliers`, `inventory`, `cash` (múltiples campos compartidos por convención) |
| `settings` | `SettingsPage.tsx` con 5 tabs (perfil, usuarios, comercial, preferencias, suscripción) + 2 widgets (backup, auditoría) | `settings.data.ts` → varios exports sueltos (`SETTINGS_MOCK_USERS`, `SETTINGS_MOCK_PERMISSIONS`, etc.), no un objeto único | Ninguno | Ninguna | Mixto: tabla compartida (`Table`) para usuarios/facturación **+** tabla HTML propia para la matriz de permisos (grid de checkboxes, no un listado tradicional) — ambas conviven en `TabUsersRoles.tsx` | Referencia cruzada a **todos** los módulos vía `PermissionMatrix.modules` (`dashboard`, `pedidos`, `inventario`, `clientes`, `proveedores`, `logistica`, `caja`, `analitica`) |
| `suppliers` | `SuppliersPage.tsx` (única vista) | `suppliers.data.ts` → array `SUPPLIERS_MOCK_DATA: Supplier[]` con `products[]`/`purchaseOrders[]` anidados | Ninguno | Ninguna | Tabla compartida (`Table`, `SuppliersTable`) + filtros (búsqueda + categoría) + tabla HTML propia adicional en `OrderItemsTable` (dentro del modal de orden de compra) | `inventory` (`sku`/`category`/`cost` calca `InventoryItem`), `orders` (concepto de orden de compra replicado) |
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
