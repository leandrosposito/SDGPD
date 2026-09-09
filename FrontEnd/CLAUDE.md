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

An `@/` import alias (mapped to `src/`) is configured in `vite.config.ts` and `tsconfig.app.json` and is the project-wide convention: use `@/shared/...`, `@/modules/...`, etc. instead of relative paths that go up more than one level (`../../shared/...`). All existing imports were migrated to this convention. A same-folder or one-level-up relative import (`./Foo`, `../Foo`) is still fine and does not need the alias. ESLint enforces this as a warning via `no-restricted-imports` (flags `../../**`).

### Mandatory tooling (do not duplicate)

Per `docs/DECISIONES_TECNICAS.md`, these are locked in; introducing an alternative for something already covered here requires documenting why in that file:
- **Forms/validation** — `zod` schema in a `*.schema.ts` file per module, wired to `react-hook-form` via `@hookform/resolvers/zod`.
- **Shared state** — `zustand`, store files named `use<Nombre>Store.ts`. Convention actually in use: a per-module `state/` folder, not a single global `src/shared/state/` — but verified 2026-09-08 (`grep -rln "= create<" src`) there are only **2 stores total today**: `src/modules/inventory/state/useReplenishmentStore.ts` (the real per-module example) and `src/shared/state/useSessionStore.ts` (session/branch, global by nature). A third one, `useDeliveriesStore` (logistics), existed at some point but was removed when `logistics` migrated to server-side pagination — a change of sucursal now just refetches with the new `branchId` in the query, no store reset needed (see the comment in `src/shared/state/resettableStores.ts`). Don't assume `logistics` has its own store.
- **Icons** — `lucide-react` exclusively.
- **User feedback** (success/error/warning) — `sonner` exclusively; never native `alert()` or a custom toast.

### Module structure

`src/modules/` has one folder per business domain, each with a `<Name>Page.tsx` + matching `.css` + a `components/` subfolder. Verified 2026-09-08 (`find src/modules -maxdepth 1 -type d`) — **10 modules**, not 9: `dashboard`, `orders`, `clients`, `suppliers`, `compras`, `inventory`, `logistics`, `cash`, `analytics`, `settings` (`compras` is real and easy to miss since it's not alphabetically next to the others). There is no `_template/` to copy — if you need a pattern for a new module, use `src/modules/suppliers/` (has the plainest `api/`+`components/` split). Route paths are mostly Spanish (`/pedidos`, `/inventario`, `/clientes`, `/proveedores`, `/compras`, `/logistica`, `/caja`, `/analitica`) except `/settings` — this inconsistency is pre-existing, not a bug to silently "fix" unless asked. Full structural map, verified against the filesystem: `docs/ARQUITECTURA.md`.

Routes are wired in `src/shared/routes/AppRoutes.tsx` (imported by `App.tsx`), all nested under the shared `AppShell` layout — this is the single, only place routes are declared. To add a new route: import the page component in `AppRoutes.tsx` and add a `<Route path="..." element={<Component />} />` inside the `<Routes>` block.

Shared/preexisting UI layer — treat as stable, don't restructure without being asked. Everything here lives under `src/shared/`: `layouts/` (5 real: `AppShell`, `Header`, `Sidebar`, `BranchSelector`, `AlertsBell`), `components/ui/` (15 real, from `Badge` to `Tabs` — do NOT assume the list is short, count it or check `docs/ARQUITECTURA.md` before adding a duplicate), `hooks/` (8 real, e.g. `usePagedQuery.ts` — **not** `usePagination.ts`, that name doesn't exist). Current, verified lists: `docs/ARQUITECTURA.md`.

Convention for new shared elements: a component used in 2+ places belongs in `src/shared/components/`, never duplicated per-module; a new layout goes in `src/shared/layouts/`. Check these folders before adding something that might already exist there.

### Mock data / service pattern

`src/data/mock/*.data.ts` holds the mock datasets (13 files today, verified `ls src/data/mock/` — not 1:1 with the 10 modules: some modules have more than one, e.g. `inventory` also has `productStock.data.ts`, `compras` has `purchaseOrders.data.ts`; `alerts.data.ts` and `session.mock.ts` are cross-cutting, not module-owned). `src/services/mock/` today only has **3** flat services that haven't migrated into their module yet: `dashboard.service.ts`, `purchaseOrders.service.ts`, `session.service.ts` — `clients`, `suppliers` and `products` (the ones this file used to list here) already moved to `modules/clients/api/`, `modules/suppliers/api/` and the transversal `shared/api/products/` respectively. `logistics` has its own service under `modules/logistics/services/` (not `api/` — a naming deviation, not a typo). `compras` has no service of its own; it reads `services/mock/purchaseOrders.service.ts`. `analytics` still reads `data/mock/analytics.data.ts` directly, no service layer. Each service follows this shape, set by `dashboard.service.ts`:

```ts
async function fetchX(): Promise<X> {
  await delay(MS)              // simulated network latency
  return structuredClone(MOCK_DATA)
}
```

with a comment noting these get replaced by real HTTP calls once a backend exists. When adding a service for another module, follow this same shape rather than reading `data/mock/*` directly from components. Current, verified per-module breakdown: `docs/ARQUITECTURA.md`.

### Types

Per-module type files live in `src/shared/types/` (the only location — 16 files today, verified `ls src/shared/types/`, one per domain plus `ids.types.ts`/`pagination.types.ts`/`session.types.ts`), alongside `src/shared/routes/` (`AppRoutes.tsx`) — both real and in active use.

### Removed placeholder folders (historical note — verify before trusting, some came back)

A 2026-08-28 cleanup pass removed everything below — each was either `.gitkeep`-only scaffolding or completely empty, with zero real usage anywhere in the codebase at that time (verified via grep before removal). **Confirmed still absent today (2026-09-08, `find` from `src/`):**
- `src/core/` (entities/, use-cases/, repositories/, value-objects/) and `src/infrastructure/` (api/, config/) — aspirational DDD layer, never adopted.
- `src/router/` and `src/types/` — superseded by `src/shared/routes/` and `src/shared/types/` respectively.
- `src/components/` (both `layout/` and `ui/`) — the real equivalents are `src/shared/layouts/` and `src/shared/components/ui/`.
- `src/assets/icons/` and `src/assets/images/` — unused; the project uses `lucide-react` for icons, not local asset files.
- `src/modules/_template/` — described a module convention (`views/`, per-module `services/`/`types/`, barrel `index.ts`) that no real module ever followed.

**Correction, verified 2026-09-08 (`ls src/shared/utils/`, `git log -- src/shared/utils/`): `src/shared/utils/` is back**, with 5 real files in active use (`date.ts`, `logError.ts`, `money.ts`, `orderFulfillment.ts`, `resolveOrderClient.ts`, each with 1-4 real consumers outside itself, confirmed by grep) — it was empty when removed in this cleanup, but got recreated with real content afterward (last touched 2026-09-07) and this file was never updated to say so. `src/shared/services/` is still absent — only `utils/` came back.

`FrontEnd/ARCHITECTURE.md` (stale, pre-dated this cleanup) was removed in the same pass. `docs/ESTRUCTURA_Y_ARQUITECTURA.md`, `docs/COMPONENTES_Y_LAYOUTS.md` and `docs/RUTAS_Y_MODULOS.md` were kept at the time, but by 2026-09-08 they had drifted into describing this same removed/aspirational structure as if current — all three were replaced by **`docs/ARQUITECTURA.md`** (verified against the filesystem on the date at the top of that file; re-verify before trusting it if you're reading this much later). `docs/DECISIONES_TECNICAS.md` is kept and referenced directly from code comments (`App.tsx`, `ProductFormModal.tsx`/`.schema.ts`, confirmed by grep).
