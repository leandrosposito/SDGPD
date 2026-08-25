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
