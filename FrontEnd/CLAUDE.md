# CLAUDE.md (FrontEnd)

This file provides guidance to Claude Code (claude.ai/code) when working with code in `FrontEnd/`.

The frontend currently runs entirely on mock data (`src/data/mock/`) since there is no backend to call.

## Commands

All commands run from this directory (`FrontEnd/`):

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — ESLint over the whole project
- `npm run preview` — preview a production build

There is **no test script and no test infrastructure** (no vitest/jest/playwright config, no `*.test.ts` files anywhere). Don't assume tests exist or try to run `npm test`.

Package manager is npm (`package-lock.json` present). Note: `package.json`'s `name` field is `distribuidoragestion` (legacy, pre-rebrand) — harmless but don't be confused by it.

## Architecture

Stack: React 19 + Vite 8, TypeScript 6, react-router-dom v7, recharts, zustand, zod + react-hook-form, plain CSS per module (no Tailwind, no CSS-in-JS). Prettier is configured (`.prettierrc.json`: no semicolons, single quotes, 100 print width, `avoid` arrow parens) but **not yet applied to existing code** — don't assume current files are Prettier-formatted, and don't do a blanket reformat as a side effect of unrelated changes.

An `@/` import alias (mapped to `src/`) is configured in `vite.config.ts` and `tsconfig.app.json`. New imports should use `@/shared/...`, `@/modules/...`, etc. instead of deep relative paths (`../../../shared/...`); existing relative imports were left as-is and haven't been migrated.

### Module structure

`src/modules/` has one folder per business domain, each with a `<Name>Page.tsx` + matching `.css` + a `components/` subfolder of `.tsx`/`.css` pairs: `dashboard`, `orders`, `clients`, `suppliers`, `inventory`, `logistics`, `cash`, `analytics`, `settings`. There is no `_template/` to copy — if you need a pattern for a new module, use `src/modules/dashboard/`. Route paths are mostly Spanish (`/pedidos`, `/inventario`, `/clientes`, `/proveedores`, `/logistica`, `/caja`, `/analitica`) except `/settings` — this inconsistency is pre-existing, not a bug to silently "fix" unless asked.

Routes are wired in `src/shared/routes/AppRoutes.tsx` (imported by `App.tsx`), all nested under the shared `AppShell` layout — this is the single, only place routes are declared. To add a new route: import the page component in `AppRoutes.tsx` and add a `<Route path="..." element={<Component />} />` inside the `<Routes>` block.

Shared/preexisting UI layer — treat as stable, don't restructure without being asked. Everything here lives under `src/shared/`:
- `src/shared/layouts/` — `AppShell` (`AppShell.tsx`), `Header`, `Sidebar` (each with matching `.css`)
- `src/shared/components/ui/` — `Badge`, `Modal`, `SidePanel`, `SkeletonLoader`, `StatCard`, `Table`, `Tabs` (each with matching `.css`)
- `src/shared/hooks/` — `useDashboard.ts` (data-fetching state for the dashboard module); the only hook so far, and the only file in that folder
- `src/styles/` (variables.css, reset.css, global.css, typography.css — design tokens and global styles)

Convention for new shared elements: a component used in 2+ places belongs in `src/shared/components/`, never duplicated per-module; a new layout goes in `src/shared/layouts/`. Check these folders before adding something that might already exist there.

### Mock data / service pattern

`src/data/mock/*.data.ts` holds one mock dataset per module (9 files, one per module listed above). `src/services/mock/` currently has service wrappers for `dashboard`, `clients`, `suppliers`, and `products` (the last one wraps `InventoryItem`/`inventory.data.ts`, not a separate `products.data.ts` — there is no data file per service, only per module). The other modules (`orders`, `inventory`-the-page, `logistics`, `cash`, `analytics`, `settings`) still have no service wrapper and read `data/mock/*` directly. Each existing service follows this shape, set by `dashboard.service.ts`:

```ts
async function fetchX(): Promise<X> {
  await delay(MS)              // simulated network latency
  return structuredClone(MOCK_DATA)
}
```

with a comment noting these get replaced by real HTTP calls once a backend exists. When adding a service for another module, follow this same shape rather than reading `data/mock/*` directly from components.

### Types

Per-module type files live in `src/shared/types/` (the only location — `analytics.types.ts`, `cash.types.ts`, `client.types.ts`, `dashboard.types.ts`, `inventory.types.ts`, `logistics.types.ts`, `order.types.ts`, `settings.types.ts`, `supplier.types.ts`), alongside `src/shared/routes/` (`AppRoutes.tsx`) — both real and in active use.

### Removed placeholder folders (historical note)

A 2026-08-28 cleanup pass removed everything below — each was either `.gitkeep`-only scaffolding or completely empty, with zero real usage anywhere in the codebase (verified via grep before removal). If any of these are needed again (e.g. adopting a DDD-style domain layer), recreate them then rather than scaffolding in advance:
- `src/core/` (entities/, use-cases/, repositories/, value-objects/) and `src/infrastructure/` (api/, config/) — aspirational DDD layer, never adopted
- `src/shared/utils/` and `src/shared/services/` — the real equivalent of the latter is `src/services/mock/` (see above), which was kept as-is
- `src/router/` and `src/types/` — superseded by `src/shared/routes/` and `src/shared/types/` respectively
- `src/components/layout/` (only had an orphaned, unimported `PlaceholderPage`) and `src/components/ui/` (empty) — the real equivalents are `src/shared/layouts/` and `src/shared/components/ui/`
- `src/assets/icons/` and `src/assets/images/` — unused; the project uses `lucide-react` for icons, not local asset files
- `src/modules/_template/` — described a module convention (`views/`, per-module `services/`/`types/`, barrel `index.ts`) that no real module ever followed

`FrontEnd/ARCHITECTURE.md` (stale, pre-dated this cleanup) was also removed in the same pass — its accurate content is now folded into this file. `docs/ESTRUCTURA_Y_ARQUITECTURA.md`, `docs/COMPONENTES_Y_LAYOUTS.md` and `docs/RUTAS_Y_MODULOS.md` were kept: they hold module-level decision history and UI-pattern detail (dated entries, per-decision context) that doesn't belong in this file — this file stays the general-architecture summary, those stay the module-level decision log. `docs/DECISIONES_TECNICAS.md` is also kept and referenced directly from code comments (`App.tsx`, `ProductFormModal.tsx`/`.schema.ts`).
