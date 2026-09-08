# AUDIT 2026-09-08 — Barrido completo de `empresaId` en todos los services

Auditoría de entrada (Fase A del `PROTOCOLO.md`), acotada a esta tarea: confirmar el alcance real del hallazgo MEDIO de `REPORTE_2026-09-07b.md` (`getOverdueTotalsInMoney` sin `empresaId`) barriendo **los 17 archivos `*.service.ts` del proyecto**, no solo los 2 ya mencionados.

## Por qué el MEDIO original era un error de clasificación — ajuste de criterio

`REPORTE_2026-09-07b.md` clasificó la falta de `empresaId` en `getOverdueTotalsInMoney`/`getOverdueClientsPage` como **MEDIO**, razonando que "no es un riesgo nuevo introducido... mismo patrón ya aceptado en el resto del proyecto (AUDIT_5, hallazgo #2)". Esa referencia está mal aplicada: **AUDIT_5 hallazgo #2 es un problema distinto** — ahí `empresaId` SÍ se recibe como parámetro explícito en cada función, y lo que se discute es si el backend real debería confiar en ese valor o derivarlo del token de sesión. Acá el problema es anterior y más grave: `empresaId` **no está ni siquiera en la firma de la función** — no hay nada que un futuro backend pueda "confiar o no confiar", porque el cliente nunca lo envía.

El protocolo es explícito y no da margen a esta clasificación:

- **Regla 3.5:** "Toda función de service lleva `empresaId` explícito, aunque no pase por el caché. La garantía de los hooks no cubre las llamadas directas."
- **Sección 9, condición de parada #1:** "Una query key **o un service de datos de negocio sin `empresaId`**."

Un service de datos de negocio sin `empresaId` es, por la letra del propio protocolo, una **condición de parada** — el equivalente en severidad a lo que en la corrida completa se trató como ALTO (mismo tipo de hallazgo que `getOrderById` en `VERIFICACION_CORRIDA_COMPLETA.md` V6b, que sí se corrigió como ALTO). Clasificarlo como MEDIO fue inconsistente con el propio criterio del proyecto — el error no fue de hecho (el hallazgo estaba bien descrito), fue de severidad. **Criterio ajustado desde esta sesión en adelante: cualquier función de service de datos de negocio sin `empresaId` explícito es ALTO como mínimo, nunca MEDIO, sin importar si hay o no una explotación activa hoy** (el mock de una sola empresa nunca va a mostrar el síntoma, pero el protocolo no condiciona la severidad a "hoy se nota o no" — condiciona a si la garantía arquitectónica existe).

## Barrido completo — los 17 `*.service.ts`

| Archivo | Funciones exportadas | `empresaId` explícito |
|---|---|---|
| `cash/api/cash.service.ts` | 3 | Las 3 — OK |
| `clients/api/clients.service.ts` | 9 | 5 de 9 — **4 faltan** (ver detalle) |
| `dashboard/api/dashboardAggregates.service.ts` | 2 | 1 de 2 — **1 falta** (ya conocido) |
| `inventory/api/movements/movements.service.ts` | 2 | Las 2 — OK |
| `inventory/api/product-history/product-history.service.ts` | 2 | Las 2 — OK |
| `inventory/api/purchase-suggestions/purchase-suggestions.service.ts` | 2 | Las 2 — OK |
| `logistics/services/deliveries.service.ts` | 6 públicas + 2 internas | **0 de 6 — TODO el módulo falta** |
| `orders/api/orders.service.ts` | 8 | 6 de 8 — **2 faltan** |
| `settings/api/audit/audit.service.ts` | 1 | 1 — OK |
| `settings/api/subscription/subscription.service.ts` | 2 | Las 2 — OK |
| `settings/api/users-roles/users-roles.service.ts` | 4 | Las 4 — OK |
| `suppliers/api/suppliers.service.ts` | 5 | Las 5 — OK |
| `services/mock/dashboard.service.ts` (viejo) | 5 | **0 de 5** (4 son código muerto, ver abajo) |
| `services/mock/purchaseOrders.service.ts` | 6 + 1 pura | **0 de 6 — TODO el módulo falta** |
| `services/mock/session.service.ts` | 1 | Exento, ver razón abajo |
| `shared/api/alerts/alerts.service.ts` | 3 | Las 3 — OK |
| `shared/api/products/products.service.ts` | 9 | Las 9 — OK |
| `shared/api/uploads/uploads.service.ts` | 2 | Exentas, ver razón abajo |

**Total: 20 funciones reales de negocio sin `empresaId`, en 6 archivos.** Mucho más que los 2 originalmente reportados.

## Detalle — las 20 a corregir

### `orders/api/orders.service.ts` (2)
- `advanceOrderStatus(orderId: string)` — mutación, busca en `ordersDTOStore` global sin ningún filtro de empresa.
- `cancelOrder(orderId: string)` — ídem.

### `clients/api/clients.service.ts` (4, vía 2 interfaces de filtros sin `empresaId`)
- `ClientAccountsQueryFilters` (usada por `getClientAccountsPage`/`exportClientAccounts`) — sin `empresaId`.
- `OverdueClientsQueryFilters` (usada por `getOverdueClientsPage`/`exportOverdueClients`) — sin `empresaId`. Esta es la raíz del hallazgo original: `dashboardAggregates.service.ts#getOverdueTotalsInMoney` no podía tener `empresaId` real porque la función que envuelve (`getOverdueClientsPage`) tampoco lo tiene.

### `dashboard/api/dashboardAggregates.service.ts` (1)
- `getOverdueTotalsInMoney` — se corrige de raíz junto con `clients.service.ts` (no alcanza con agregarle el parámetro si `getOverdueClientsPage` sigue sin poder usarlo).

### `logistics/services/deliveries.service.ts` (6 — el módulo entero)
- `getDeliveriesPage`/`exportDeliveries` (vía `DeliveryQueryFilters`, sin `empresaId`).
- `transitionDelivery(deliveryId, hasta, quien)` — mutación de estado del viaje.
- `reprogramDelivery(deliveryId, input)` — mutación.
- `registrarEntrega(deliveryId, lines, evidenciaIds, creadoPor)` — mutación (crea un remito).
- `getDeliveryNotesForDelivery(deliveryId)` — lectura, consumida directo por `DeliveryHistoryModal.tsx` (comentario del propio código: "usado por el panel de historial de la UI" — no es una llamada interna servidor-a-servidor, es un punto de entrada real).

### `services/mock/purchaseOrders.service.ts` (6 — el módulo entero)
- `getPurchaseOrdersPage`/`exportPurchaseOrders` (filtros sin `empresaId`).
- `getPurchaseOrdersBySupplierId`.
- `createPurchaseOrder`.
- `updatePurchaseOrderStatus`.
- `generatePurchaseOrderFromSuggestion`.

### `services/mock/dashboard.service.ts` (1 de 5 — ver nota)
- `fetchDashboardData` — consumida por `useDashboard.ts` (real, no muerta).
- `fetchKpis`/`fetchSalesSeries`/`fetchTopProducts`/`fetchRecentOrders` — **código muerto, 0 consumidores** (`grep -rln` fuera del propio archivo → 0 resultados). No se corrigen (arreglarles la firma a código que nadie llama no tiene sentido) ni se borran (regla del protocolo: "no borrar código aparentemente muerto, listarlo y esperar decisión") — quedan listadas acá para que Leandro decida.

## Exentas — con la razón escrita, no un olvido

- **`services/mock/session.service.ts#fetchSession()`** — es la función que RESUELVE `empresaId` (via `session.company.id`); pedirle `empresaId` como parámetro sería circular. Exenta por diseño.
- **`shared/api/uploads/uploads.service.ts#signUpload`/`confirmUpload`** — no leen ni mutan ningún store compartido por id (no hay `.find()`/`.filter()` sobre una colección de otra empresa que pudiera filtrarse mal). Son generadores de `fileId` + simulación de latencia/fallo, sin ningún dato de negocio que puedan servir cruzado entre empresas. El riesgo que la regla 3.5 previene (una función que busca/muta un registro compartido sin filtrar por empresa) no aplica estructuralmente acá.
- **`orders.service.ts#getOrdersSnapshotForAggregation()`, `orders.service.ts#applyDeliveryToOrderLines()`, `deliveries.service.ts#getOrderBranchLinksForAggregation()`** — llamadas "servidor a servidor" ya documentadas como tales en el propio código (un service de este mock invocando a otro directamente, nunca cruzando a un componente vía `httpClient`). Se mantienen exentas SIEMPRE QUE la función pública que las envuelve (`getDashboardAggregates`, `registrarEntrega` una vez corregida) sí reciba `empresaId` — la garantía se sostiene en el punto de entrada real, no en cada función interna.

## Plan de tandas (5 lotes, sin solapamiento de archivos — paralelizables)

1. **Lote 1** — `orders.service.ts` (`advanceOrderStatus`/`cancelOrder`) + `OrdersPage.tsx`.
2. **Lote 2** — `clients.service.ts` (2 interfaces) + `ClientAccountsTable.tsx` + `ClientOverdueTable.tsx` + `dashboardAggregates.service.ts` (cierra el hallazgo original de raíz).
3. **Lote 3** — `deliveries.service.ts` (módulo entero) + `LogisticsPage.tsx` + `DeliveriesTable.tsx` + `ReprogramarModal.tsx` + `RegistrarEntregaModal.tsx` + `DeliveryHistoryModal.tsx`.
4. **Lote 4** — `purchaseOrders.service.ts` (módulo entero) + `ComprasPage.tsx` + `TabPendingReceipt.tsx` + `SupplierDetailPanel.tsx` + `PurchaseOrderFormModal.tsx` + `TabPurchases.tsx`.
5. **Lote 5** — `dashboard.service.ts` (`fetchDashboardData`) + `useDashboard.ts`. Documentar, no tocar, las 4 funciones muertas del mismo archivo.

Además, tarea aparte (sin código, ya hecha en esta sesión antes del barrido): actualización de `ADR-009` con la reconciliación de los agregados por sucursal (verificado contra `ord-004`/`ord-003` reales del mock) y una nota de UI cuando hay un filtro de sucursal activo.
