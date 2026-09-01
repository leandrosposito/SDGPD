# Componentes Reutilizables y Layouts — SDGPD Frontend

## [25/08/2026] — Convenciones de Componentes Reutilizables y Layouts

### 1. Ubicación oficial de componentes reutilizables
Todos los componentes de UI reutilizables y atómicos viven en `src/shared/components/`. Esta es la única ubicación válida para este tipo de archivo en todo el proyecto.

**Organización interna actual:**
- `ui/` — Componentes atómicos de interfaz: Badge, Modal, SidePanel, SkeletonLoader, StatCard, Table, Tabs (cada uno con su archivo `.css` co-ubicado).

### 2. Ubicación oficial de layouts
Todos los layouts de la aplicación viven en `src/shared/layouts/`.

**Layouts actualmente identificados:**

| Layout | Páginas que lo usan | Función estructural |
|---|---|---|
| `AppShell.tsx` | Todas las rutas del ERP (vía `AppRouter.tsx`) | Wrapper raíz que compone Sidebar + Header + área de contenido (`<Outlet />`) |
| `Header.tsx` | Consumido por `AppShell` | Barra superior de navegación y controles globales (tema, búsqueda) |
| `Sidebar.tsx` | Consumido por `AppShell` | Menú lateral de navegación principal con estado colapsable |

### 3. Convención para integrar nuevos elementos a futuro
- Todo componente que se use en 2 o más lugares distintos del proyecto debe vivir en `src/shared/components/`, nunca duplicarse ni declararse localmente en cada módulo que lo usa.
- Todo layout nuevo debe crearse en `src/shared/layouts/`, siguiendo la convención de nombres `[Nombre]Layout.tsx`.
- Los imports de estos elementos deben hacerse con rutas relativas consistentes apuntando a `shared/components/ui/...` o `shared/layouts/...`.
- Antes de crear un componente o layout nuevo, se debe verificar si ya existe algo equivalente en estas carpetas para evitar duplicación.

### 4. Reubicaciones realizadas en esta etapa

**Componentes UI (src/components/ui/ → src/shared/components/ui/):**
- `Badge.tsx` + `.css` — Uso verificado: 15 módulos importadores
- `Modal.tsx` + `.css` — Uso verificado: 9 módulos importadores
- `SidePanel.tsx` + `.css` — Uso verificado: 3 módulos importadores
- `SkeletonLoader.tsx` + `.css` — Uso verificado: 3 módulos importadores
- `StatCard.tsx` + `.css` — Uso verificado: 1 módulo importador (componente atómico UI co-ubicado con los demás)
- `Table.tsx` + `.css` — Uso verificado: 14 módulos importadores
- `Tabs.tsx` + `.css` — Uso verificado: 2 módulos importadores

**Layouts (src/components/layout/ → src/shared/layouts/):**
- `AppShell.tsx` + `.css` — Layout raíz, referenciado por `AppRouter.tsx`
- `Header.tsx` + `.css` — Componente de la barra superior, consumido por `AppShell`
- `Sidebar.tsx` + `.css` — Navegación lateral, consumido por `AppShell`

**No reubicados:**
- `PlaceholderPage.tsx` + `.css` — Permanece en `src/components/layout/`. Motivo: 0 referencias externas confirmadas; candidato a eliminación futura por el usuario.

### 5. Norma de no duplicación de ubicaciones
Ninguna categoría de componente puede tener más de una ubicación válida en el proyecto:
- Componentes reutilizables de UI: únicamente `src/shared/components/`
- Layouts: únicamente `src/shared/layouts/`
- Componentes de dominio/módulo: dentro de `src/modules/[módulo]/components/`

## [28/08/2026] — Patrón Estándar para Listas de Datos

### 1. Contexto
El proyecto no tenía, hasta ahora, un patrón visual de referencia único para listas de datos (pedidos, stock, entregas, clientes, etc.). Se define acá el estándar, evaluado contra el caso de referencia "lista de entregas con 3 estados y escalabilidad a miles de filas".

### 2. Patrón elegido
**Tabla paginada con filtros**: barra de filtros arriba + tabla paginada + `Badge` de estado por fila. Toda lista de datos nueva del proyecto debe seguir esta composición salvo excepción justificada y registrada en este archivo (ver punto 5).

### 3. Justificación
Una tabla paginada solo mantiene en el DOM las filas de la página visible en lugar del dataset completo, siendo la única opción evaluada que escala a miles de filas sin sumar una librería nueva de virtualización (lo cual violaría la norma de no-duplicación de `DECISIONES_TECNICAS.md`). Es además el patrón de menor fricción de adopción: `Table` (14 módulos importadores) y `Badge` (15 módulos importadores) ya son, por lejos, los componentes de UI más reutilizados del proyecto, y la combinación filtros + tabla + badge ya existe de facto en `modules/orders/OrdersPage.tsx` junto a `modules/orders/components/OrderFilters.tsx`. Se descartó como estándar general el patrón de tablero Kanban con tarjetas (usado hoy en `LogisticsPage`), porque al no ser paginable por columna no escala a miles de registros.

### 4. Componentes involucrados

| Componente | Rol | Estado |
|---|---|---|
| `shared/components/ui/Table.tsx` | Render de filas/columnas | Existente |
| `shared/components/ui/Badge.tsx` | Indicador de estado por fila | Existente |
| Barra de filtros (búsqueda + selects + rango de fechas), según el patrón de `modules/orders/components/OrderFilters.tsx` | Filtrado | Existente como patrón por módulo (no es un componente compartido; cada módulo arma su propia barra siguiendo esta forma) |
| `shared/components/ui/Pagination.tsx` | Control de paginación | **Creado** el 28/08/2026 junto con `shared/hooks/usePagination.ts`, como parte de la primera implementación real del patrón en `logistics` — ver la entrada de más abajo `[28/08/2026] — Primera Tabla Paginada Real` |

### 5. Excepción documentada — REVERTIDA
`modules/logistics/LogisticsPage.tsx` usaba un tablero Kanban (`LogisticsCard` en 3 columnas) en vez de este patrón, y esta sección lo dejaba registrado como excepción justificada. Esa excepción **ya no aplica**: el Kanban fue reemplazado por la tabla paginada oficial (ver `[28/08/2026] — Primera Tabla Paginada Real` más abajo y `DECISIONES_TECNICAS.md`). Se deja esta nota en vez de borrar el historial para que quede claro que la decisión cambió y por qué.

### 6. Norma de aplicación
Todo módulo nuevo que muestre un listado de datos debe usar el patrón de este documento salvo que se registre acá una excepción justificada, en línea con la norma de no-duplicación ya vigente en `DECISIONES_TECNICAS.md`.

## [28/08/2026] — Relevamiento: Catálogo Real de Componentes y Adopción del Patrón de Listas

### 1. Catálogo de `src/shared/components/ui/` (7 componentes, todos los que existen hoy)

| Componente | Props (alto nivel) | ¿Pagina o virtualiza? |
|---|---|---|
| `Table<T>` | `columns` (`header`, `accessor: keyof T \| (row: T) => ReactNode`, `align?`, `width?`), `data: T[]`, `keyExtractor`, `emptyMessage?`, `rowClassName?` | **No.** Renderiza `data` completo en el DOM, sin límite de filas ni virtualización. |
| `Badge` | `label: string`, `variant: 'success'\|'warning'\|'danger'\|'info'\|'neutral'\|'accent'` | N/A |
| `Modal` | `isOpen`, `onClose`, `title`, `children`, `footer?`, `size?: 'sm'\|'md'\|'lg'\|'xl'` — se monta vía `createPortal` en `document.body` | N/A |
| `SidePanel` | `isOpen`, `onClose`, `title`, `subtitle?`, `children`, `headerActions?` — panel deslizante desde la derecha, también por `createPortal` | N/A |
| `SkeletonLoader` (+ `SkeletonCard`, `SkeletonTable`) | Base: `width?`, `height?`, `borderRadius?`, `style?`. `SkeletonCard`: `rows?`. `SkeletonTable`: `rows?`, `cols?` | N/A — son placeholders de carga, no controlan paginación |
| `StatCard` (+ `StatCardSkeleton`) | `metric: KpiMetric` — **acoplado al tipo `KpiMetric` de `dashboard.types.ts`**, no es un componente de KPI genérico pese a vivir en `shared/` | N/A |
| `Tabs` | `tabs: TabItem[]` (`id`, `label`, `content?`), `activeTabId`, `onChange` | N/A |

No existe ningún componente de paginación (`Pagination`) ni de virtualización en el proyecto todavía.

> **Actualización 28/08/2026 (mismo día, después de este relevamiento):** se agregaron `shared/components/ui/Pagination.tsx` (8vo componente) y `shared/components/ui/ErrorBoundary.tsx` (9no componente — primer Error Boundary del proyecto; `children`, `fallbackTitle?`, `fallbackMessage?`; clase de React, no hook, porque `getDerivedStateFromError`/`componentDidCatch` no tienen equivalente en hooks). Ver `[28/08/2026] — Primera Tabla Paginada Real` al final de este archivo.

### 2. Estado real de adopción del patrón de listas (relevamiento, no una nueva decisión)
La sección `[28/08/2026] — Patrón Estándar para Listas de Datos` de más arriba define el **objetivo**: tabla paginada + filtros + `Badge`. Relevando el código existente, ese patrón **no está consolidado hoy** — conviven tres implementaciones distintas para listar datos, y ninguna pagina:

| Implementación | Dónde se usa |
|---|---|
| `Table` compartido (sin paginar) | `cash` (`CashTransactionsTable`), `inventory` (6 tabs), `orders` (`OrdersPage`), `settings` (`TabUsersRoles`, `TabSubscription`), `suppliers` (`SuppliersTable`) |
| Tabla HTML propia (`<table>` local, no reutiliza `Table`) | `dashboard` (`RecentOrdersTable`), `analytics` (`TopDebtorsTable`), `clients` (`ClientDirectoryTable`, `ClientAccountsTable`), `suppliers` (`OrderItemsTable`), `settings` (matriz de permisos en `TabUsersRoles`) |
| Tablero Kanban de tarjetas | `logistics` (`LogisticsCard`, excepción ya documentada arriba) |

De los 9 módulos, solo `orders` combina tabla + barra de filtros completa (más cerca del objetivo), y ninguno implementa paginación. **La consolidación real del patrón queda pendiente** — esta sección deja el registro del estado actual para que la migración se priorice como tarea explícita, no se da por hecha.

> **Actualización 28/08/2026 (mismo día, después de este relevamiento):** `logistics` dejó de ser Kanban y pasó a ser la primera tabla paginada real del proyecto. Después, la tab nueva `low-stock` de `inventory` (`TabLowStock`) fue la segunda en adoptar el patrón completo (2 de 9 módulos con al menos una vista paginada). El resto de esta tabla (`cash`, `orders`, `settings`, `suppliers`, `dashboard`, `analytics`, `clients`, y el resto de las tabs de `inventory`) sigue exactamente como se relevó acá — no fueron tocados. Ver `[28/08/2026] — Primera Tabla Paginada Real` al final de este archivo.

### 3. Otras duplicaciones de componentes detectadas (relevamiento)
- **Tarjeta de KPI reimplementada 5 veces**: `shared/components/ui/StatCard.tsx` (solo usado por `dashboard`), `modules/analytics/components/KpiCard.tsx`, `modules/orders/components/OrderKpis.tsx`, `modules/logistics/components/LogisticsKPIs.tsx` y `modules/cash/components/CashKPIs.tsx` tienen cada uno su propio markup/CSS para lo mismo (una tarjeta de métrica con label + valor + variación).
- **Navegación por tabs reimplementada**: `inventory` y `suppliers` (`SupplierDetailPanel`) usan el `Tabs` compartido; `settings` y `clients` reimplementan su propia navegación de tabs con botones y estado local.

Ver `DECISIONES_TECNICAS.md` (`[28/08/2026] — Inconsistencias Encontradas Entre Módulos`) para el registro consolidado de estos hallazgos.

## [28/08/2026] — Primera Tabla Paginada Real

### 1. Contexto
`logistics` reemplaza su tablero Kanban por "Entregas del Día": una tabla paginada, filtrable por estado (`pending` / `in_transit` / `delivered`). Es la primera vez que se implementa de punta a punta el patrón definido en `[28/08/2026] — Patrón Estándar para Listas de Datos` (más arriba en este archivo), así que esta entrada documenta la implementación como referencia oficial para el resto de los módulos (`cash`, `inventory`, `orders`, `settings`, `suppliers`, `dashboard`, `analytics`, `clients` — todos siguen sin paginar, ver relevamiento arriba).

### 2. Componente nuevo: `shared/components/ui/Pagination.tsx`
Control de paginación genérico, sin estado propio (lo maneja quien lo usa).

| Prop | Tipo | Rol |
|---|---|---|
| `currentPage` | `number` | Página actual (1-indexed) |
| `totalPages` | `number` | Total de páginas |
| `totalItems` | `number` | Total de items sin paginar, para el resumen "Mostrando X-Y de Z" |
| `pageSize` | `number` | Items por página, para calcular el resumen |
| `onPageChange` | `(page: number) => void` | Callback al navegar |

Usa `ChevronLeft`/`ChevronRight` de `lucide-react` (primer uso real de esa librería en el proyecto — ver `DECISIONES_TECNICAS.md`). No pagina por sí solo: es solo la UI de navegación.

### 3. Hook nuevo: `shared/hooks/usePagination.ts` (primer archivo real en `shared/hooks/`, antes solo tenía `.gitkeep`)
`usePagination<T>(items: T[], pageSize: number, resetKey?: unknown)` corta en memoria el array ya filtrado/ordenado que le pasan y devuelve `{ pageItems, currentPage, totalPages, totalItems, setPage }`. El parámetro `resetKey` es opcional: si se pasa (por ejemplo, el filtro de estado activo), el hook vuelve a la página 1 cuando ese valor cambia, para no quedar en una página vacía después de filtrar.

Es paginación en memoria porque hoy los datos son mock. El día que haya una API paginada real, `items` puede pasar a ser la página ya traída del backend y `onPageChange`/`setPage` puede disparar el fetch de la página siguiente — ni `Pagination` ni el componente de tabla que lo usa necesitan cambiar.

### 4. Cómo se compone el patrón completo en `logistics` (referencia para copiar)
`LogisticsPage.tsx` arma el patrón así — este es el orden/composición de referencia para el resto de los módulos:
1. Filtrar los datos ya cargados según los criterios del módulo (en este caso, `getDeliveriesForDate` + el filtro de estado activo).
2. Pasar el resultado filtrado a `usePagination(filtrados, PAGE_SIZE, filtroActivo)`.
3. Renderizar `Table` (o el componente de tabla del módulo que lo envuelve, acá `DeliveriesTable`) con `pageItems`, no con el array completo.
4. Renderizar `Pagination` debajo, pasándole `currentPage`/`totalPages`/`totalItems`/`pageSize`/`onPageChange={setPage}`.

### 5. Norma de aplicación
Cuando otro módulo migre su listado a este patrón, debe reusar `Pagination` y `usePagination` tal cual existen — no crear una copia local. Si algo de esta API no alcanza para un caso nuevo, se extiende acá (o se registra la excepción), no se duplica.

### 6. Segundo caso real: `inventory` (tab "Bajo Stock Mínimo")
`TabLowStock.tsx` sigue exactamente los mismos 4 pasos del punto 4, sin necesitar tocar `Pagination` ni `usePagination`: filtra `InventoryItem[]` con `useMemo` (`stock < minStock`), pasa el resultado a `usePagination`, renderiza `Table` con `pageItems`, y `Pagination` debajo. Confirma que el patrón (y la API de `Pagination`/`usePagination`) ya es reutilizable tal cual entre módulos distintos, no solo dentro de `logistics`. Ver `DECISIONES_TECNICAS.md` `[28/08/2026] — Productos Bajo Stock Mínimo`.

### 7. Tercer caso real: `resetKey` compuesto (sucursal + filtro) en `LogisticsPage`
`[01/09/2026]` (ver `DECISIONES_TECNICAS.md` y `ESTRUCTURA_Y_ARQUITECTURA.md`) agrega el cambio de sucursal activa como segundo criterio que debe volver la paginación a la página 1, junto al filtro de estado ya existente. `usePagination` no cambió: su `resetKey` acepta cualquier valor comparable con `!==`, así que `LogisticsPage` le pasa un string compuesto (`` `${activeBranchId}:${statusFilter}` ``) en vez de agregar un segundo parámetro al hook. Se descartó pasar un objeto/tupla nueva en cada render porque `usePagination` compara el `resetKey` por referencia (`!==`) — un objeto literal nuevo en cada render dispararía el reset todo el tiempo, no solo cuando cambia el valor real.

## [01/09/2026] — `BranchSelector`: selector de sucursal activa en `Header`

### 1. Contexto
Parte de la infraestructura de sesión/sucursal (ver `DECISIONES_TECNICAS.md`, sección "Contexto de sesión y sucursal activa"). Necesitaba un componente nuevo de layout que muestre la empresa (solo lectura) y la sucursal activa (elegible), en formato dropdown.

### 2. Ubicación: `Header`, no `Sidebar`
Se evaluaron ambos layouts antes de elegir. `Sidebar.__brand` ya muestra una marca fija ("DistGestion / Panel de Control") pero es el nombre del **producto**, no de la empresa/inquilino — mezclar ambos conceptos en el mismo bloque visual habría sido confuso (dos identidades distintas: la del software y la del cliente que lo usa). `Header` ya aloja el otro elemento de identidad de sesión existente (el enlace de usuario "Admin / Configuración" a la derecha), así que `BranchSelector` se agrega en `header__actions`, como primer ítem de ese grupo, antes de refresco/tema/notificaciones/usuario — mismo criterio de "cluster de sesión" a la derecha del header.

### 3. Componente nuevo, no una variante de `Tabs`
Se evaluó reusar algo existente antes de escribir código nuevo (`Tabs`, `Modal`) — ninguno encaja: `Tabs` es navegación con `role="tablist"`, no un selector de una opción entre varias con menú desplegable; `Modal`/`SidePanel` son overlays de pantalla completa/lateral, demasiado pesados para elegir una sucursal. Se construyó `BranchSelector.tsx` (+ `.css`) en `shared/layouts/`, junto a `Header`/`Sidebar`/`AppShell` (no en `shared/components/ui/`, porque no es un átomo genérico reutilizable fuera de este layout — consume `useSessionStore` directamente).

### 4. Accesibilidad del dropdown propio
- Trigger: `<button>` nativo (foco y activación por teclado gratis) con `aria-haspopup="listbox"`, `aria-expanded` (refleja el estado real de apertura) y `aria-label` describiendo la sucursal activa y la acción ("Sucursal activa: X. Abrir selector de sucursal.") — un solo atributo, sin duplicar con un `<label>` separado, ya que el trigger no es un campo de formulario.
- Menú: `role="listbox"` con opciones `role="option"` + `aria-selected` en la sucursal activa; una sucursal `status: 'inactive'` se deshabilita (`disabled`) en vez de ocultarse, para que el usuario vea que existe pero no se puede elegir.
- Cierre: click afuera (listener en `mousedown` sobre `document`, comparando contra el contenedor) y tecla `Escape`, que además devuelve el foco al botón trigger (sin esto, al cerrar con teclado el foco quedaría "perdido" en un elemento ya desmontado).
- Foco visible: no se define ningún estilo de focus propio — se apoya en el anillo global `:focus-visible` de `src/styles/global.css`, igual que el resto de los controles interactivos del proyecto.
- Contraste: toda la paleta del componente sale de `src/styles/variables.css` (`--color-bg-*`, `--color-border*`, `--color-text-*`, `--color-accent*`), sin ningún color hardcodeado — funciona en ambos temas (claro/oscuro) sin CSS adicional por tema.

### 5. Estado de carga inicial de la sesión
Mientras `useSessionStore` está cargando (o todavía no cargó), `BranchSelector` renderiza un `SkeletonLoader` del mismo tamaño aproximado que el trigger real, en vez de dejar un hueco vacío o un layout que salta cuando la sesión llega. `LogisticsPage` sigue el mismo criterio para su tabla: si `activeBranchId` todavía es `null`, muestra `SkeletonTable` en vez de `DeliveriesTable`/`Pagination` (ver `DECISIONES_TECNICAS.md` para la limitación conocida: KPIs y filtros de esa misma pantalla no tienen su propio skeleton y pueden mostrar "0" un instante antes de que la sesión cargue).
