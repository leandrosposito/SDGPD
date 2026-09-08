# AUDIT 2026-09-07b — Alcance del dashboard (implementación de ADR-009)

Auditoría de entrada (Fase A del `PROTOCOLO.md`), acotada a esta tarea.

## Qué existe hoy

- `src/modules/dashboard/api/dashboardAggregates.service.ts`: `getDashboardAggregates(empresaId, query, signal)` sin `branchId`; `getOverdueTotalsInMoney(signal)` sin filtros de ningún tipo.
- `src/modules/dashboard/api/dashboardAggregates.ts`: funciones puras `groupSalesByZone`/`groupOrdersByStatusInRange`, reciben una proyección mínima de `Order` (`OrderProjectionForAggregation`: `status`, `date`, `zone`, `totalAmount` — **sin `id`**, así que hoy no se puede cruzar con `Delivery`).
- `src/modules/orders/api/orders.service.ts#getOrdersSnapshotForAggregation()`: arma esa proyección desde `ordersDTOStore`, llamada servidor-a-servidor (nunca cruza a un componente).
- `src/modules/logistics/services/deliveries.service.ts`: `deliveriesStore: Delivery[]` (con `orderId: OrderId` y `branchId: BranchId`, ambos tipados) — **no expone ninguna función de snapshot** para que otro service lo use, a diferencia de `orders.service.ts` que sí tiene `getOrdersSnapshotForAggregation` para este propósito exacto.
- `src/modules/dashboard/hooks/useDashboardAggregates.ts`: `useCachedQuery('dashboard-aggregates', undefined, ...)` — `keyParams` siempre `undefined`, no hay ningún filtro que pueda entrar a la key hoy.
- `src/modules/dashboard/components/DashboardAggregatesSection.tsx`: sin ningún selector de sucursal, sin ningún rótulo de alcance. Las 3 tarjetas (Ventas por zona, Pedidos por estado, Cuentas por cobrar) no distinguen su alcance real.
- `src/modules/dashboard/DashboardPage.tsx`: compone `DashboardAggregatesSection` sin pasarle ningún estado de URL — la página no usa `useUrlListState` ni ningún otro mecanismo de URL hoy.
- `src/shared/state/useSessionStore.ts#activeBranchId`: ya existe, es lo que el dashboard debe seguir por default cuando la URL no especifica nada (ADR-009).

## Qué se rompe si se cambia

- `getOrdersSnapshotForAggregation` la usa SOLO `dashboardAggregates.service.ts` (confirmado por grep) — agregarle `id: dto.id` a la proyección no afecta a nadie más.
- `useDashboardAggregates`/`DashboardAggregatesSection` no tienen otros consumidores fuera de `DashboardPage.tsx` — cambiar su firma interna es seguro.
- `deliveriesStore` es privado al módulo de logistics — hay que agregar una función exportada nueva, mismo criterio que `getOrdersSnapshotForAggregation` (servidor-a-servidor, sin pasar por `httpClient`).

## Plan de tanda (una sola, todo el cambio es cohesivo)

1. `orders.service.ts`: agregar `id` a `OrderProjectionForAggregation`/`getOrdersSnapshotForAggregation`.
2. `deliveries.service.ts`: nueva función `getOrderBranchLinksForAggregation(): {orderId: OrderId; branchId: BranchId}[]`.
3. `dashboardAggregates.ts` (puro): nueva función `filterOrdersForBranch(orders, links, branchId)` — filtra la proyección de pedidos a los que tengan al menos un link con ese `branchId`. Se aplica ANTES de `groupSalesByZone`/`groupOrdersByStatusInRange` cuando `branchId` está presente.
4. `dashboardAggregates.service.ts`: `DashboardAggregatesQuery` gana `branchId?: BranchId`. `getOverdueTotalsInMoney` gana un parámetro `branchId?: BranchId` que se ignora en el cálculo (documentado, no un olvido).
5. `useDashboardAggregates.ts`: lee el filtro (URL vía `useUrlListState`, con fallback a `activeBranchId` del selector global) y lo pasa a ambas llamadas; lo incluye en `keyParams` del `useCachedQuery`.
6. `DashboardAggregatesSection.tsx`/`DashboardPage.tsx`: selector de alcance (dropdown "Toda la empresa" + sucursales reales) que escribe en la URL; rótulo de alcance por tarjeta (fijo "Toda la empresa" en Cuentas por Cobrar, dinámico en las otras 2).
7. Smoke script para `filterOrdersForBranch` y el join.

Ningún archivo fuera de esta lista debería necesitar tocarse.
