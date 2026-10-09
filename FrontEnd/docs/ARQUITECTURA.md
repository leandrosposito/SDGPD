# Arquitectura — SDGPD Frontend

**Verificado contra el filesystem real el 2026-09-08** (rama `sesion-docs-verificadas`, derivada de `lean` en `b5d1ea4`); **conteos de `data/mock/`, `shared/types/` y `shared/api/` re-verificados el 2026-09-09 tras Tanda 9** (rama `sesion-tanda9-logistica`, ver gate de arquitectura de esa tanda). **`shared/`, `modules/settings/` y los conteos de `data/mock/` y `shared/types/` re-verificados el 2026-10-09 (BE-1b, rama `sesion-be1b-2026-10-09`, `ls` de cada carpeta).** Reemplaza a `ESTRUCTURA_Y_ARQUITECTURA.md`, `RUTAS_Y_MODULOS.md` y `COMPONENTES_Y_LAYOUTS.md` (borrados, describían una estructura aspiracional que nunca se construyó). Es un mapa, no un tratado — si algo de acá no coincide con lo que ves en disco, confiá en el disco y corregí este archivo.

## Árbol real de `src/` (2 niveles)

```
src/
├── App.tsx, main.tsx
├── data/mock/          17 archivos (*.data.ts por dominio + session.mock.ts), reverificado 2026-10-09. BE-1b: la empresa demo y sus 4 sucursales usan los UUID fijos del seed del backend (scripts/verificacion/v18-ids-demo.mjs lo compara)
├── modules/             9 módulos de negocio (ver abajo)
├── services/mock/       3 services que TODAVÍA no migraron a modules/<x>/api/
├── shared/
│   ├── api/             httpClient (+ httpClientCore), serviceModes (BE-1b), ApiError, queryClient/queryKeys + api/ de dominios transversales (alerts, auth, drivers, exports, motivos, products, uploads, vehicles)
│   ├── auth/            BE-1b: LoginPage (+ login.schema, .css), RequireSession (guard de rutas), tokenStore (access token en memoria), usePermission + permissions (la UI oculta por permiso)
│   ├── components/ui/   15 componentes atómicos reutilizables
│   ├── hooks/            8 hooks (usePagedQuery, useCachedQuery, etc.)
│   ├── layouts/          5 layouts (AppShell, Header, Sidebar, BranchSelector, AlertsBell)
│   ├── routes/           AppRoutes.tsx — ÚNICO lugar donde se declaran rutas
│   ├── state/            2 stores de Zustand (useSessionStore, resettableStores)
│   ├── types/           22 archivos *.types.ts, uno por dominio + pagination/session/ids (reverificado 2026-10-09). BE-1b: usuarios y roles ya no se tipan aca, son los de @sdgpd/contracts
│   └── utils/            13 utilidades, reverificado 2026-10-07 con `ls src/shared/utils` (date, idempotency, logError, lotExpiration, money, orderEligibility, orderFulfillment, orderLogistics, orderNumber, patente, resolveOrderClient, stopVisitEligibility, tripCapacity). Este renglón decía 6: las Tandas 10B-13 sumaron 6 sin actualizarlo, y la Tanda 17 sumó orderEligibility (ADR-015)
└── styles/              variables.css, reset.css, global.css, typography.css
```

## Módulos — el patrón real, no el ideal

`src/modules/` tiene un folder por dominio: `analytics`, `cash`, `clients`, `compras`, `dashboard`, `inventory`, `logistics`, `orders`, `settings`, `suppliers`. Todos siguen `<Nombre>Page.tsx` + `.css` co-ubicado en la raíz del módulo, más un `components/` con los componentes exclusivos de ese módulo. Ejemplo real (`suppliers`, `clients`):

```
modules/suppliers/
├── SuppliersPage.tsx, SuppliersPage.css
├── api/            dto.ts + mapper.ts + suppliers.service.ts
└── components/      SuppliersTable.tsx, SupplierDetailPanel.tsx, SupplierFormModal.tsx, ...
```

**No todos tienen `api/` — verificado módulo por módulo, no asumido:**

| Módulo | `api/` | Detalle real |
|---|---|---|
| `clients`, `dashboard`, `orders`, `settings`, `suppliers` | sí | `dto.ts`/`mapper.ts`/`<módulo>.service.ts` en `modules/<x>/api/`. **Excepción desde BE-1b:** `settings/api/users-roles/` tiene solo `users-roles.service.ts`: el wire es el contrato de `@sdgpd/contracts` (`User`, `Role`, `Branch`), sin dto/mapper propios. Sus componentes están en `settings/components/users-roles/` (`UserFormModal`, `RolePermissionsEditor`, `settingsErrors`, `userForm.schema`, `UsersRoles.css`) |
| `cash` | sí | igual patrón, sin sub-carpetas |
| `inventory` | sí, con sub-dominios | `api/movements/`, `api/product-history/`, `api/purchase-suggestions/` — 3 sub-carpetas independientes, sin relación modelada entre sí |
| `logistics` | **no** — usa `services/`, no `api/` | `modules/logistics/services/deliveries.service.ts`, sin `dto.ts`/`mapper.ts` separados. Desviación real del nombre de carpeta, no un error de este documento. |
| `compras` | **no existe ninguna** | su service vive en `src/services/mock/purchaseOrders.service.ts` (fuera del módulo) |
| `analytics` | **no existe ninguna** | lee `data/mock/analytics.data.ts` directo, sin capa de service |

`inventory` y `logistics` además tienen `state/` propio (zustand: `useReplenishmentStore.ts`, y el store de logística respectivamente) — un módulo usa `state/` solo si tiene estado compartido propio, no es obligatorio.

**No existe ningún `views/` ni ningún `index.ts` barrel en ningún módulo** (`find src/modules -iname index.ts` → 0 resultados) — cada componente se importa por su ruta completa con el alias `@/`.

**Llamada cross-módulo directa (Tanda 9):** `orders/components/CreateDeliveryModal.tsx` (abierto desde `OrderDetailPanel.tsx`) llama directo a `logistics/services/deliveries.service.ts#createDelivery`/`#getDeliveriesForOrder` — regla ya vigente del protocolo: un módulo puede llamar la función de **servicio** pública de otro módulo, lo que no puede es importar un **componente** interno ajeno. `logistics` no importa nada de `orders/components` (la dirección ya existente `deliveries.service.ts -> orders.service.ts`, ver `applyDeliveryToOrderLines`/`getOrderById`, sigue siendo de un solo sentido) — no hay ciclo.

## Componentes compartidos y layouts

- **Componentes de UI reutilizables:** `src/shared/components/ui/` — únicamente acá, ninguna otra ubicación es válida. Lista real (15): `Badge`, `DateRangeFilter`, `ErrorBoundary`, `ErrorState`, `EvidenceUploader`, `ExportButton`, `FetchingOverlay`, `LoadingState`, `Modal`, `Pagination`, `SidePanel`, `SkeletonLoader`, `StatCard`, `Table`, `Tabs` — cada uno con su `.css` co-ubicado.
- **Layouts:** `src/shared/layouts/` — `AppShell` (wrapper raíz), `Header`, `Sidebar`, `BranchSelector`, `AlertsBell`.
- Regla real (no cambiada, sigue vigente): un componente usado en 2+ módulos vive en `shared/components/`, nunca duplicado.

## Rutas

Se declaran en un único archivo: **`src/shared/routes/AppRoutes.tsx`** (no `AppRouter.tsx`, ese nombre nunca existió en el código). Importa cada `<Módulo>Page` con el alias `@/modules/<módulo>/<Módulo>Page` y arma un `<Route>` por módulo dentro de `<AppShell>`. Para agregar una ruta: importar el componente ahí y agregar el `<Route>`.

**Code-splitting (Tanda 10A, ADR-012, verificado 2026-09-09):** los 10 imports de `<Módulo>Page` en `AppRoutes.tsx` son `React.lazy(() => import(...))`, no imports estáticos — cada módulo pesa su propio chunk. El `<Suspense>` que cubre la carga NO está en `AppRoutes.tsx`: vive en `src/shared/layouts/AppShell.tsx`, envolviendo `<Outlet/>`, adentro del `ErrorBoundary` por-ruta existente (para que Sidebar/Header no se desmonten al navegar entre rutas lazy — ver ADR-012 para el porqué). Al agregar una ruta nueva, seguir el mismo patrón `lazy(() => import('@/modules/<módulo>/<Módulo>Page').then(m => ({ default: m.<Módulo>Page })))` en vez de un import estático directo.

## Capa `api/` — el patrón dto/mapper/service

Donde existe (ver tabla arriba), son 3 archivos: `dto.ts` (forma de datos "del backend"), `mapper.ts` (dto↔dominio) y `<módulo>.service.ts` (llama a `httpClient`, con un `mock:` que resuelve contra `data/mock/`). El único dominio **transversal** (consumido por más de un módulo) es **productos**, y por eso NO vive dentro de ningún módulo: **`src/shared/api/products/`** (`dto.ts`, `mapper.ts`, `products.service.ts`, y desde 2026-09-30 `productUpdate.ts` — función pura `mergeProductUpdate` que arma el registro editado conservando los lotes, extraída para poder testearla con `node`, mismo criterio que `purchase-suggestions/filterSort.ts`). `shared/api/` también aloja: `httpClient.ts`/`ApiError.ts` (infraestructura de fetch mock; desde BE-0b, verificado 2026-10-09, la lógica de `httpClient.ts` vive en `httpClientCore.ts` — `createHttpClient`, sin `import.meta.env`, para correrla con `node` en `scripts/smoke/be-0b.smoke.mjs` — y `httpClient.ts` solo lee la configuración de Vite), `queryClient.ts`/`queryKeys.ts` (TanStack Query), y 4 sub-dominios más chicos sin módulo propio (sin `dto.ts`/`mapper.ts`, solo un `.service.ts`): `alerts/`, `exports/`, `uploads/`, y `motivos/` (Tanda 9, ADR-010 sección 5 — catálogo de motivos de rechazo, hoy consumido solo por `logistics`, transversal por diseño para cuando otro módulo lo necesite).

## BE-1b: modo por service, auth y contrato (verificado 2026-10-09)

- **Qué va por http:** lo decide UN solo lugar, `VITE_HTTP_SERVICES` (`shared/api/serviceModes.ts`, leído en `httpClient.ts`). Cada request declara su `service`; si está en la lista va por `fetch` contra `VITE_API_BASE_URL` (por defecto `/api`, mismo origen), si no, al `mock` como siempre. En BE-1b se pueden declarar `auth`, `session`, `users`, `roles` y `branches`. Sin la variable, todo sigue en mock (sesión mock, sin login).
- **Auth:** `shared/api/auth/auth.service.ts` (login, sesión, logout contra `/api/auth/*`). El access token vive en memoria (`shared/auth/tokenStore.ts`), nunca en storage. `httpClientCore` agrega el `Bearer` y, ante un 401, hace UN refresh a la vez (single-flight) y UN reintento; si el refresh falla, avisa `onSessionExpired` y `useSessionStore` cierra la sesión.
- **Rutas:** `/login` es la única fuera de `RequireSession`, que envuelve a `AppShell` (y con él, a todas las rutas). Con auth en mock, `RequireSession` no hace nada.
- **Contrato:** `@sdgpd/contracts` es un workspace; el frontend lo consume desde sus fuentes por la condición `sdgpd-source` (`tsconfig.app.json` y `vite.config.ts`). Las respuestas http de auth, usuarios, roles y sucursales se validan con sus schemas.
- **Desarrollo:** `npm run dev` hace proxy de `/api` al backend (`VITE_DEV_PROXY_TARGET`, por defecto `http://localhost:3000`) sin reescribir la ruta.

## Qué NO existe — no lo busques, no lo inventes

Verificado con `find` el 2026-09-08, cero resultados para todos:

- `src/core/` (`entities/`, `use-cases/`, `repositories/`, `value-objects/`) — capa DDD aspiracional, nunca adoptada.
- `src/infrastructure/` (`api/`, `config/`) — idem.
- `src/app/`, `src/pages/`, `src/router/`, `src/types/`, `src/components/` — reemplazados hace tiempo por `src/modules/`, `src/shared/routes/`, `src/shared/types/`, `src/shared/components/`.
- `src/assets/icons/`, `src/assets/images/` — el proyecto usa `lucide-react`, no assets locales de ícono.
- `src/modules/_template/` — nunca existió; para un módulo nuevo, copiar el patrón de `suppliers` (el más simple y completo).
- `AppRouter.tsx` — el archivo real se llama `AppRoutes.tsx` (ver arriba).
