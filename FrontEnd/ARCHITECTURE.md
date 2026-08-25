# ARCHITECTURE.md - SDGPD FrontEnd

Arquitectura real resultante post-estructuracion DDD no destructiva.
Generado: 2026-08-24

## Stack Tecnologico

- Framework: React 19 + Vite 8
- Lenguaje: TypeScript 6
- Routing: react-router-dom v7
- Graficos: recharts
- Estilos: CSS puro por modulo (sin Tailwind, sin CSS-in-JS)
- Linting: ESLint 10 flat config + typescript-eslint + react-hooks
- Formateo: Prettier 3 (configurado, NO aplicado globalmente aun)
- Gestor de paquetes: npm

## Estructura de Carpetas Real

### Capa UI / Presentacion (PREEXISTENTE - NO MODIFICAR)

src/components/
  layout/   - AppShell, Header, Sidebar, PlaceholderPage
  ui/       - Badge, Modal, SidePanel, SkeletonLoader, StatCard, Table, Tabs

src/modules/ (9 modulos de negocio, cada uno con Page + components/)
  analytics/  - Analisis y reportes
  cash/       - Gestion de caja y tesoreria
  clients/    - Directorio y cuentas de clientes
  dashboard/  - Vista principal / KPIs
  inventory/  - Stock, movimientos, lotes, categorias, precios
  logistics/  - Logistica y entregas
  orders/     - Pedidos y seguimiento
  settings/   - Configuracion de empresa y sistema
  suppliers/  - Proveedores y ordenes de compra

src/styles/ (PREEXISTENTE - NO MODIFICAR)
  variables.css  - Design tokens CSS (colores, tipografia, espaciado)
  reset.css      - Normalizacion de estilos base
  global.css     - Estilos globales de la aplicacion
  typography.css - Sistema tipografico

src/assets/   - Recursos estaticos (imagenes, SVG)
src/router/   - AppRouter.tsx (react-router-dom)
src/data/mock/- Datos mock por modulo (9 archivos .ts)
src/services/ - Servicios (actualmente mock)
src/hooks/    - Custom hooks (useDashboard.ts) [PREEXISTENTE]
src/types/    - Tipos TypeScript por modulo (9 archivos) [PREEXISTENTE]

### Capa DDD / Dominio (AGREGADA - arquitectura futura)

src/core/
  entities/      - Entidades de dominio (modelo de negocio puro)
  use-cases/     - Casos de uso / logica de aplicacion
  repositories/  - Interfaces de repositorio (contratos)
  value-objects/ - Value objects inmutables

src/infrastructure/
  api/    - Clientes HTTP, adapters de API REST
  config/ - Variables de entorno, configuracion de infraestructura

src/shared/
  hooks/    - Hooks utilitarios compartidos (futuros)
  utils/    - Funciones utilitarias puras
  types/    - Tipos compartidos (complementa src/types/ existente)
  services/ - Servicios compartidos de aplicacion
