# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev       # start Vite dev server
npm run build     # tsc -b && vite build (type-checks, then builds — build fails on type errors)
npm run lint      # eslint .
npm run preview   # preview the production build
```

No test runner is configured (no `test` script, no test framework installed). There is no single-test command to run.

Formatting: Prettier is configured (`.prettierrc.json`: no semicolons, single quotes, 100 col width, trailing commas `es5`) but is **not yet applied globally** — don't reformat whole files as a side effect of an edit.

## Architecture

React 19 + Vite 8 + TypeScript 6 SPA, `react-router-dom` v7, `recharts` for charts, plain CSS per component/module (no Tailwind, no CSS-in-JS). All imports are plain relative paths — no TS path aliases.

### Mandatory tooling (do not duplicate)

Per `docs/DECISIONES_TECNICAS.md`, these are locked in; introducing an alternative for something already covered here requires documenting why in that file:
- **Forms/validation** — `zod` schema in a `*.schema.ts` file per module, wired to `react-hook-form` via `@hookform/resolvers/zod`.
- **Shared state** — `zustand`, store files named `use<Nombre>Store.ts` in `src/shared/state/` (or the owning module for domain-specific state).
- **Icons** — `lucide-react` exclusively.
- **User feedback** (success/error/warning) — `sonner` exclusively; never native `alert()` or a custom toast.

### Bootstrap and routing

- `src/main.tsx` imports global CSS in a fixed order — `styles/variables.css` → `reset.css` → `typography.css` → `global.css` — then mounts `App.tsx`. Order matters (cascade).
- `App.tsx` only renders `<AppRoutes />`.
- `src/shared/routes/AppRoutes.tsx` is the **single** place routes are declared. To add a screen: build the page component, import it in `AppRoutes.tsx`, add a `<Route path="..." element={<Page />} />`.

### Modules

Business modules live in `src/modules/<name>/`: `analytics`, `cash`, `clients`, `dashboard`, `inventory`, `logistics`, `orders`, `settings`, `suppliers`.

- Current real shape (what exists today): `<Name>Page.tsx` + `<Name>Page.css` at the module root, plus a `components/` folder for module-local components.
- Target shape (defined by the scaffold at `src/modules/_template/`, not yet retrofitted onto existing modules): `views/`, `components/`, `services/`, `types/`, and an `index.ts` barrel that exports only what other modules/routes need.
- **Never import across module internals** (`modules/orders` reaching into `modules/inventory/components/...` is not allowed). Anything needed by 2+ modules gets promoted to `src/shared/`.
- Data is mocked per module in `src/data/mock/<name>.data.ts`. Only `dashboard` currently has a service wrapper (`src/services/mock/dashboard.service.ts`); other modules consume mock data more directly — check the module before assuming a service layer exists.

### Shared code (`src/shared/`)

- `components/ui/` — reusable UI atoms: `Badge`, `Modal`, `SidePanel`, `SkeletonLoader`, `StatCard`, `Table`, `Tabs`, each co-located with its `.css`. This is the **only** valid location for cross-module UI components — before adding a new one, check here first.
- `layouts/` — app chrome: `AppShell` (composes Sidebar + Header + `<Outlet />`), `Header`, `Sidebar`. New layouts go here as `[Nombre]Layout.tsx`.
- `types/` — domain types per module (`*.types.ts`), the single home for shared types (superseded `src/types/`, which is now empty — don't resurrect it).
- `routes/` — `AppRoutes.tsx` (see above).
- `hooks/`, `services/`, `utils/`, `state/` — currently placeholders (`.gitkeep` only, or not yet created for `state/`); this is where new cross-module hooks/services/utils/zustand stores belong once written.

### Legacy / not-yet-migrated locations

- `src/components/layout/PlaceholderPage.tsx` — old location, 0 confirmed external references, candidate for deletion. Don't add anything new here.
- `src/hooks/useDashboard.ts` — pre-existing hook not yet moved into `shared/hooks/`.
- `src/services/mock/dashboard.service.ts` — pre-existing, not yet moved into `shared/services/` or `modules/dashboard/services/`.

### Future DDD layer (empty scaffolding — don't build against it yet)

`src/core/{entities,use-cases,repositories,value-objects}/` and `src/infrastructure/{api,config}/` contain only `.gitkeep` files. This is reserved structure for a later architectural pass, not something currently wired into the app.

### Decision log

`docs/*.md` is the authoritative, dated record of conventions — read it before introducing a new folder/pattern, since most categories of file (types, shared components, layouts, state, tooling) are declared to have exactly one valid location:
- `docs/ESTRUCTURA_Y_ARQUITECTURA.md` — folder map and single-location rule.
- `docs/RUTAS_Y_MODULOS.md` — routing setup and module structure/creation steps.
- `docs/COMPONENTES_Y_LAYOUTS.md` — where reusable components/layouts live, what's been relocated.
- `docs/DECISIONES_TECNICAS.md` — mandatory-tooling table above, in full.

`ARCHITECTURE.md` (repo root of this package) is a **stale** snapshot from 2026-08-24 — it still describes a `src/router/` folder and a pre-move `src/components/ui/` location that no longer exist. Where it conflicts with `docs/*.md`, trust `docs/*.md`.
