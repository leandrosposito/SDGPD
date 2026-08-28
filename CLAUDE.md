# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SDGPD is an ERP built around business domains (Core, Comercial, Inventario, Logística, Caja, Analítica). It is organized as:

- `FrontEnd/` — React app, actively developed. All code today lives here.
- `BackEnd/` — completely empty, not started. No backend exists yet.
- `Documentacion/` — business/domain specs (Product Vision, Arquitectura Funcional del Negocio, Modelo Funcional del Dominio) as .docx/.pdf, plus some derived .md/.txt extracts. Consult these for business rules and domain vocabulary (in Spanish) before inventing behavior for a module.

The frontend currently runs entirely on mock data (`src/data/mock/`) since there is no backend to call.

## Commands

All commands run from `FrontEnd/`:

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — ESLint over the whole project
- `npm run preview` — preview a production build

There is **no test script and no test infrastructure** (no vitest/jest/playwright config, no `*.test.ts` files anywhere). Don't assume tests exist or try to run `npm test`.

Package manager is npm (`package-lock.json` present). Note: `package.json`'s `name` field is `distribuidoragestion` (legacy, pre-rebrand) — harmless but don't be confused by it.

## Architecture

Stack: React 19 + Vite 8, TypeScript 6, react-router-dom v7, recharts, zustand, zod + react-hook-form, plain CSS per module (no Tailwind, no CSS-in-JS). Prettier is configured (`.prettierrc.json`: no semicolons, single quotes, 100 print width, `avoid` arrow parens) but **not yet applied to existing code** — don't assume current files are Prettier-formatted, and don't do a blanket reformat as a side effect of unrelated changes.

### Module structure

`src/modules/` has one folder per business domain, each with a `<Name>Page.tsx` + matching `.css` + a `components/` subfolder of `.tsx`/`.css` pairs: `dashboard`, `orders`, `clients`, `suppliers`, `inventory`, `logistics`, `cash`, `analytics`, `settings`. Routes are wired in `src/shared/routes/AppRoutes.tsx` (imported by `App.tsx`), all nested under the shared `AppShell` layout (`src/shared/layouts/AppShell.tsx`). Route paths are mostly Spanish (`/pedidos`, `/inventario`, `/clientes`, `/proveedores`, `/logistica`, `/caja`, `/analitica`) except `/settings` — this inconsistency is pre-existing, not a bug to silently "fix" unless asked.

Shared/preexisting UI layer — treat as stable, don't restructure without being asked. Note these live under `src/shared/`, **not** under `src/components/` (see discrepancies below):
- `src/shared/layouts/` — `AppShell`, `Header`, `Sidebar` (each with matching `.css`)
- `src/shared/components/ui/` — `Badge`, `Modal`, `SidePanel`, `SkeletonLoader`, `StatCard`, `Table`, `Tabs` (each with matching `.css`)
- `src/styles/` (variables.css, reset.css, global.css, typography.css — design tokens and global styles)
- `src/hooks/useDashboard.ts` — a top-level custom hook (data-fetching state for the dashboard module). Distinct from `src/shared/hooks/`, which is an empty placeholder (see below).

`src/components/layout/` and `src/components/ui/` also exist but are **not** where the above components live:
- `src/components/layout/` contains only `PlaceholderPage.tsx`/`.css`, and nothing currently imports it — it's orphaned, not wired into any route.
- `src/components/ui/` is completely empty (no files at all).

### Mock data / service pattern

`src/data/mock/*.data.ts` holds one mock dataset per module (9 files, one per module listed above). `src/services/mock/` currently has service wrappers for `dashboard`, `clients`, `suppliers`, and `products` (the last one wraps `InventoryItem`/`inventory.data.ts`, not a separate `products.data.ts` — there is no data file per service, only per module). The other modules (`orders`, `inventory`-the-page, `logistics`, `cash`, `analytics`, `settings`) still have no service wrapper and read `data/mock/*` directly. Each existing service follows this shape, set by `dashboard.service.ts`:

```ts
async function fetchX(): Promise<X> {
  await delay(MS)              // simulated network latency
  return structuredClone(MOCK_DATA)
}
```

with a comment noting these get replaced by real HTTP calls once a backend exists. When adding a service for another module, follow this same shape rather than reading `data/mock/*` directly from components.

### DDD layers (aspirational, mostly empty)

Real/active: `src/shared/types/` (per-module type files, listed below) and `src/shared/routes/` (`AppRoutes.tsx`).

Placeholder only, no use anywhere in the codebase — each of these contains nothing but a `.gitkeep` file:
- `src/core/entities/`, `src/core/use-cases/`, `src/core/repositories/`, `src/core/value-objects/`
- `src/infrastructure/api/`, `src/infrastructure/config/`
- `src/shared/hooks/`, `src/shared/utils/`, `src/shared/services/`

Also completely empty (no `.gitkeep`, no files, not scaffolded for DDD — just unused): `src/router/`, `src/types/`, `src/components/ui/`, `src/assets/icons/`, `src/assets/images/`.

### Known discrepancies vs. FrontEnd/ARCHITECTURE.md

`ARCHITECTURE.md` (generated 2026-08-24) is stale — trust the actual filesystem over it:
- It claims `src/components/layout/` holds `AppShell, Header, Sidebar, PlaceholderPage`. In reality that folder holds only `PlaceholderPage` (orphaned/unused); `AppShell`/`Header`/`Sidebar` live in `src/shared/layouts/`.
- It claims `src/components/ui/` holds `Badge, Modal, SidePanel, SkeletonLoader, StatCard, Table, Tabs`. In reality that folder is empty; those components live in `src/shared/components/ui/`.
- It claims `src/router/AppRouter.tsx` is "PREEXISTENTE"; that folder is actually empty. The real router is `src/shared/routes/AppRoutes.tsx`.
- It claims `src/types/` holds 9 preexisting type files; that folder is empty. The real per-module type files (`analytics.types.ts`, `cash.types.ts`, `client.types.ts`, `dashboard.types.ts`, `inventory.types.ts`, `logistics.types.ts`, `order.types.ts`, `settings.types.ts`, `supplier.types.ts`) live in `src/shared/types/`.
- It claims `src/shared/types/` merely "complementa src/types/ existente"; since `src/types/` is empty, `src/shared/types/` is the only real type layer, not a complement to anything.

Also: `src/modules/_template/` is empty scaffolding (0-byte `index.ts`; `components/`, `services/`, `types/`, `views/` subfolders all empty, no `.gitkeep`), not a working example — if you need a pattern to copy for a new module, use `src/modules/dashboard/` instead.
