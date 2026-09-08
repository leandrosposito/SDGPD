# AUDIT 2026-09-07 — Conexión de huérfanas, export faltante, cierre 3f/3g

Auditoría de entrada (Fase A del `PROTOCOLO.md`), acotada a las 4 tareas de esta sesión. No re-audita el proyecto entero — solo lo que estas tareas tocan.

## Tarea 1 — Conectar las 3 funciones huérfanas

| Función | Dónde vive | Quién debería llamarla | Por qué hoy no lo hace |
|---|---|---|---|
| `deriveOrderFulfillmentStatus` | `shared/utils/orderFulfillment.ts` | `OrderDetailPanel.tsx` (badge de estado de cumplimiento) y `OrdersPage.tsx` (columna en el listado) | Se escribió en Tanda 8 solo para el smoke test del caso guía de ADR-001. Ningún componente de Pedidos la importa — confirmado, `grep -rln "deriveOrderFulfillmentStatus" src` da 2 resultados: el propio archivo y `scripts/smoke/tanda-8.smoke.mjs`. |
| `resolveOrderClient` | `shared/utils/resolveOrderClient.ts` | `OrderDetailPanel.tsx` (resolver el `ClientAccount` real detrás de `order.clientId` y mostrar su estado de cuenta vivo) | Se escribió en Tanda 5 solo para el smoke test de la relación tipada. `Order.clientId` se fija al crear el pedido (`CreateOrderModal`) y nunca se vuelve a leer — confirmado, `grep -rln "resolveOrderClient" src` da 2 resultados: el propio archivo y `scripts/smoke/tanda-5.smoke.mjs`. |
| `isRechazoTotal` | `shared/types/deliveryNote.types.ts` | `DeliveryHistoryModal.tsx` (badge "Rechazo total" en la sección "Remitos", que ya lista cada `DeliveryNote` pero no distingue este caso) | Se escribió en Tanda 8 solo para el smoke test. `grep -rln "isRechazoTotal" src` da 2 resultados: el propio archivo y `scripts/smoke/tanda-8.smoke.mjs`. |

Confirmado con `derivePendingQuantity` (vecina de `deriveOrderFulfillmentStatus`, misma tanda) que SÍ tiene un call-site real (`RegistrarEntregaModal.tsx`) — la brecha no es "nadie mira `shared/utils/orderFulfillment.ts`", es específicamente estas 3 funciones.

**Consecuencia concreta que cita la tarea:** si `deriveOrderFulfillmentStatus` no se conecta, ADR-001 ("el estado del pedido se deriva de sus líneas") queda escrito pero no implementado — el mecanismo de derivación existe y es correcto (smoke-verificado), pero ningún usuario lo ve nunca.

## Tarea 2 — ExportButton en los listados sin él

V5 de `VERIFICACION_CORRIDA_COMPLETA.md` confirmó 7/16 con `<ExportButton>`. Re-confirmado ahora mismo (`grep -rln "<ExportButton" src/modules` → mismos 7: `ClientAccountsTable`, `ClientOverdueTable`, `TabPendingReceipt`, `ComprasPage`, `TabLowStock`, `LogisticsPage`, `SuppliersPage`). Los 9 restantes, con su service y función `get*Page` ya confirmados:

| Listado | Archivo | Service / `get*Page` |
|---|---|---|
| Caja | `modules/cash/CashPage.tsx` | `getCashTransactionsPage` |
| Directorio de Clientes | `modules/clients/ClientsPage.tsx` | `getClientsPage` |
| Movimientos (Inventario) | `modules/inventory/components/TabMovements.tsx` | `getMovementsPage` |
| Historial de Producto | `modules/inventory/components/TabProductHistory.tsx` | `getProductHistoryPage` |
| Stock Actual | `modules/inventory/components/TabStockCurrent.tsx` | `getStockedProductsPage` |
| Pedidos | `modules/orders/OrdersPage.tsx` | `getOrdersPage` |
| Suscripción/Facturas | `modules/settings/components/tabs/TabSubscription.tsx` | `getInvoicesPage` |
| Usuarios | `modules/settings/components/tabs/TabUsersRoles.tsx` | `getUsersPage` |
| Reposición (Tanda 3f) | `modules/inventory/components/TabPurchases.tsx` | **no existe todavía** — depende de la Tarea 4 |

Cada uno necesita: una función `export<Dominio>(filters, sort?)` nueva en su service (mismo patrón que los 6 `export*` ya existentes — recorta a `MAX_EXPORT_ROWS`, devuelve `{items, truncated}`), columnas para `ExportButton`, y el wiring `fetchRows={() => exportX(filters)}` usando la MISMA `filters` que ya alimenta `usePagedQuery` (no una copia — V5 ya verificó que este es el patrón correcto a seguir).

## Tarea 3 — Tanda 3g (Movimientos/Historial)

**Ya está cerrada a nivel de código.** Verificado ahora, no asumido:
- `modules/inventory/api/movements/{dto,mapper,movements.service}.ts` y `modules/inventory/api/product-history/` existen, con DTO↔dominio, `branchId` tipado (`asBranchId`), `usePagedQuery`.
- `TabMovements.tsx`/`TabProductHistory.tsx` se autoconsultan, con `useUrlListState` (prefijos `mov_`/`hist_`), sin `data` por prop.
- `TabMovements` sin buscador es una decisión documentada explícitamente en el propio código (`movements.service.ts:19-20`: "SIN BÚSQUEDA a propósito... no se le inventa uno que no fue pedido"), no un gap.

Esta tanda se completó en el commit `cef6e15`, antes de la corrida completa — el prompt que originó las tareas de hoy tenía información desactualizada. Lo único pendiente para estos dos listados es exactamente la Tarea 2 (ExportButton), ya contemplada arriba. No hay trabajo de migración adicional que hacer bajo el nombre "Tanda 3g" — se documenta esto en vez de reabrir código que ya funciona.

## Tarea 4 — Tanda 3f (Reposición)

**Genuinamente sin migrar**, confirmado: `TabPurchases.tsx` recibe `data: PurchaseSuggestion[]` por prop desde `InventoryPage.tsx`, que arma el array con `INVENTORY_MOCK_DATA.suggestions.filter((s) => s.branchId === activeBranchId)` — colección completa filtrada en cliente, sin paginar, sin service, sin `usePagedQuery`, sin URL state.

Lo que YA existe y hace esto viable con poco riesgo:
- `PurchaseSuggestion` (`inventory.types.ts:101-119`) ya tiene `productId: InventoryItem['id']` y `branchId: Branch['id']` tipados — no hace falta ningún cambio de modelo de datos.
- El patrón a copiar es exactamente `modules/inventory/api/movements/` (mismo tipo de dominio: exclusivo de `inventory`, alcance SUCURSAL, sin necesidad de compartir con otro módulo).

Plan: `modules/inventory/api/purchase-suggestions/{dto,mapper,purchase-suggestions.service}.ts` con `getPurchaseSuggestionsPage` (paginado, `branchId`+`empresaId` en filtros, sort por stock/déficit/costo). `TabPurchases.tsx` pasa a autoconsultarse (`usePagedQuery` + `useUrlListState`, prefijo `rep_`), dejando de recibir `data` por prop. `InventoryPage.tsx` deja de armar `purchaseSuggestions` con el `.filter` en memoria. `handleGenerateOrder` (resolución de proveedor real, invalidación cruzada a Compras) no cambia — no toca ese flujo, ya está bien.

## Qué NO se rompe si se hace esto (a preservar)

- El mecanismo de invalidación cruzada de `TabPurchases` hacia Compras (`queryClient.invalidateQueries` con la key jerárquica `['paged', 'getPurchaseOrdersPage', empresaId]`) no depende de cómo se traen las sugerencias — no se toca.
- `products`/`suppliers` que hoy recibe `TabPurchases` por prop (para resolver el proveedor real al generar la OC) siguen viniendo de `InventoryPage` vía `useCachedQuery` — no se duplica ese fetch dentro de la tab.
- Los 7 `ExportButton` ya migrados a la arquitectura de job asíncrono (Tanda 6) no se tocan — los 9 nuevos siguen el mismo patrón (`fetchRows` → `export*` del service → `MAX_EXPORT_ROWS` truncado).

## Plan de tandas (Fase C)

1. **Tanda A — Reposición a la capa `api/` (cierra Tanda 3f).** Transversal respecto de la Tarea 2 (el export de Reposición depende de que exista un service paginado) — va primero.
2. **Tanda B — Conectar las 3 funciones huérfanas.** Independiente de A, sin solapamiento de archivos.
3. **Tanda C — ExportButton en los 9 listados**, incluida Reposición (depende de A). Va después de A.

Tanda 3g (Tarea 3) no genera una tanda de código propia — ya cerrada, documentado arriba.

## Fase B — Decisiones

Ningún ADR nuevo hace falta. Las 4 tareas están cubiertas por decisiones ya tomadas: ADR-001 (estado derivado de líneas — Tarea 1 lo implementa, no lo reabre), ADR-004 (exportación server-side — Tarea 2 aplica el mismo patrón), y el patrón ya establecido de `modules/<x>/api/` con DTO/mapper/`usePagedQuery` (Tareas 3/4). Nada de esto exige una decisión de diseño nueva.
