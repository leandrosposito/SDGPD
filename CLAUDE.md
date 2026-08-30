# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is the SDGPD ERP project, split into three top-level directories:

- `FrontEnd/` — React/Vite/TypeScript SPA. **This is the only directory with implemented code.**
- `BackEnd/` — empty; no backend exists yet.
- `Documentacion/` — product/business specs (Product Vision, Arquitectura Funcional del Negocio, Plan Maestro de Requerimientos) as `.docx`/`.pdf`/`.md`. Not code — reference material only.

All commands below run from `FrontEnd/`.

## Commands

```
cd FrontEnd
npm run dev       # start Vite dev server
npm run build     # tsc -b && vite build (type-check then production build)
npm run lint      # eslint .
npm run preview   # preview the production build
```

No test runner is configured (no `test` script, no test framework in `package.json`).

## Architecture (FrontEnd)

**Stack:** React 19 + Vite 8 + TypeScript 6, `react-router-dom` v7 for routing, `recharts` for charts, plain CSS per component/module (no Tailwind, no CSS-in-JS). Imports use plain relative paths — no TS path aliases are configured.

**Mandatory tooling** (see `FrontEnd/docs/DECISIONES_TECNICAS.md` for the full rationale table) — do not introduce an alternative library for anything already covered here without documenting why in that file:
- Forms/validation: `zod` schemas (`*.schema.ts` per module) wired to `react-hook-form` via `@hookform/resolvers/zod`.
- Shared state: `zustand` stores named `use<Nombre>Store.ts`, living in `src/shared/state/` or the owning module.
- Icons: `lucide-react` only — never mix in another icon set or ad-hoc SVGs for cases it already covers.
- User feedback (success/error/warning): `sonner` only — never native `alert()` or a bespoke toast.

**Bootstrap:** `src/main.tsx` imports global CSS in a fixed order (`variables.css` → `reset.css` → `typography.css` → `global.css`), then mounts `App.tsx`, which just renders `<AppRoutes />`.

**Routing:** the single source of truth is `src/shared/routes/AppRoutes.tsx` — the only place routes are declared. To add a screen: build the page component, import it there, add a `<Route>`.

**Business modules** live in `src/modules/<name>/` — `analytics`, `cash`, `clients`, `dashboard`, `inventory`, `logistics`, `orders`, `settings`, `suppliers`. Existing modules are currently flat (`<Name>Page.tsx` + `components/`); the target structure (`views/`, `components/`, `services/`, `types/`, `index.ts` barrel) is defined by the template at `src/modules/_template/` but not yet retrofitted onto existing modules. Modules must never import each other's internals (`modules/A` importing from inside `modules/B` is not allowed) — anything needed by more than one module gets promoted to `src/shared/`.

**Shared UI:** reusable atoms (`Badge`, `Modal`, `SidePanel`, `SkeletonLoader`, `StatCard`, `Table`, `Tabs`) live in `src/shared/components/ui/`, each co-located with its `.css`. App chrome (`AppShell`, `Header`, `Sidebar`) lives in `src/shared/layouts/`. `src/components/layout/` still holds only the unused `PlaceholderPage.tsx` (0 external references, candidate for deletion — do not add anything new there).

**Future DDD layer (currently empty scaffolding):** `src/core/{entities,use-cases,repositories,value-objects}` and `src/infrastructure/{api,config}` contain only `.gitkeep` files. Data today is mocked per module under `src/data/mock/*.data.ts` and read through `src/services/` (also mock implementations).

**Decision log:** `FrontEnd/docs/*.md` (`ESTRUCTURA_Y_ARQUITECTURA.md`, `RUTAS_Y_MODULOS.md`, `COMPONENTES_Y_LAYOUTS.md`, `DECISIONES_TECNICAS.md`) is the authoritative, dated record of folder layout and conventions — each enforces a "single valid location per category of file" rule (types, shared components, layouts, state, etc.), so check there before creating a new home for something that likely already has one. `FrontEnd/ARCHITECTURE.md` is a stale snapshot from 2026-08-24 (still describes the removed `src/router/` and the pre-move `src/components/ui` location) — prefer `docs/*.md` when the two disagree.
