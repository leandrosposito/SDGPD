# 01 — Endpoints: todo lo que el frontend le pide hoy al "servidor"

**Verificado contra el código el 2026-10-07**, rama `sesion-auditoria-backend-2026-10-07` (base `lean` = `159517e`). Regla 2.10: si leés esto después, reverificá los archivo:línea antes de confiar en ellos. Auditoría de **solo lectura**: no se tocó código.

## Cómo se obtuvo la tabla (y por qué el número es 91, no 88)

Las filas se generaron con un extractor que lee cada llamada a `httpClient.request` del código real. No se transcribieron a mano. Hay dos formas de escribir la llamada:

- En una línea: `httpClient.request<T>({` (88 llamadas, sin contar las 2 menciones en comentarios: `shared/api/httpClient.ts:11` y `shared/api/types.ts:26`).
- **Partida en dos líneas** (`return httpClient` / `.request<T>({`): **3 llamadas más**, que un `grep "httpClient.request"` no ve: `purchase-suggestions.service.ts:89` (`exportPurchaseSuggestions`), `subscription.service.ts:89` (`exportInvoices`) y `users-roles.service.ts:95` (`exportUsers`).

**Total: 91 llamadas reales.** Es el control de V1 (comando y salida en `00_RESUMEN.md`).

**Lo que no pasa por `httpClient`** (llamadas a "servidor" sin contrato HTTP, ver sección al final): `session.service.ts`, los jobs de exportación (`shared/api/exports/exportJobs.ts`), las subidas (`shared/api/uploads/uploads.service.ts`), la analítica (`AnalyticsPage.tsx` lee el mock directo) y 11 funciones exportadas de services que leen o escriben stores en memoria sin request (una de ellas la llama un componente). La consigna citaba `shared/api/exports/` como ejemplo de llamadas fuera de `*.service.ts`, pero **ahí no hay ninguna llamada a `httpClient`**. Justamente ese es el hallazgo: la exportación de ADR-004 no tiene contrato HTTP (ver C-1).

## Resumen

| Métrica | Valor |
|---|---|
| Llamadas `httpClient.request` | **91** (59 GET, 16 PUT, 15 POST, 1 DELETE) |
| Mutaciones | 32 |
| Mutaciones con clave de idempotencia | 15 (todas en logística, vehículos y choferes) |
| Mutaciones con control de concurrencia **verificado** | **1** (`assignDeliveriesToStop`, `trips.service.ts:331`) |
| Listados paginados `page/pageSize` | 19 (11 con wire `{data, meta}` vía DTO, 8 con `PageResult` de dominio directo) |
| Listados paginados por cursor | 1 (`getAlertsPage`) |
| Exportaciones (`GET …/export` que devuelven filas) | 15 |
| Listas sin paginar | 13 (ver C-6) |
| Respuesta tipada como DTO (wire definido) | 28 |
| Respuesta tipada como **dominio** (wire = forma interna del front) | 59 |
| Respuesta sin tipo | 4 (`dashboard.service.ts:39,47,55,63`, sin consumidores) |
| Alcance sucursal | 27 (en **14** el `branchId` no viaja en el request: recurso de sucursal accedido solo por id) |
| Sin `empresaId` | 4 (`dashboard.service.ts:39-68`, código muerto, **ALTO** por la condición de parada) |

## Inconsistencias del contrato

**C-1 — BLOQUEANTE. La exportación de ADR-004 no tiene contrato HTTP.**
- **Qué pide ADR-004:** `POST /{recurso}/export` → `202 {jobId}`, después `GET /exports/{jobId}`.
- **Qué pasa hoy:** `createExportJob`/`getExportJobStatus` (`exportJobs.ts:85,131`) corren **en el navegador**, con un `Map` en memoria (`:82`) y `setTimeout`. El "servidor" es el propio cliente.
- **Lo que el cliente pide de verdad:** los 15 `GET …/export` devuelven las filas (`ExportResult<T>` = `{items, truncated}`, hasta `MAX_EXPORT_ROWS` = 10.000, `pagination.types.ts:74`), y el archivo se arma en el navegador con `xlsx` (`buildExportFile.ts`, inyectado vía `useExportJob.ts:71`).
- **Por qué bloquea:** las columnas son `ExportColumn<T>` con `accessor: (row) => …`, **funciones del cliente** (`exportTypes.ts:9-12`, por ejemplo `ClientsPage.tsx:59-74`). El servidor no puede generar el archivo sin que antes se decida **quién define las columnas**. Ver la decisión abierta 08#5.

**C-2 — `exportSuppliers` recorta en el cliente.** `suppliers.service.ts:144-153` pide `GET /suppliers/export`, recibe `SupplierDTO[]` **sin tope** y aplica `slice(0, MAX_EXPORT_ROWS)` en el cliente. Es el único export que no devuelve `ExportResult`. Viola la regla 3.11.

**C-3 — El orden no viaja en 17 exports/listados.** Lo aplica el mock, pero no está en `params`, así que en modo `http` se pierde:
- Exports: `exportClients`, `exportClientAccounts`, `exportOverdueClients`, `exportMovements`, `exportProductHistory`, `exportPurchaseSuggestions`, `exportDeliveries`, `exportOrders`, `exportInvoices`, `exportUsers`, `exportPurchaseOrders`, `exportStockedProducts`, `exportLowStock`, `exportSuppliers`.
- Listados: `getClientsPage` (`clients.service.ts:93-95` ordena por `query.sort`; `:116-125` no lo envía), `getUsersPage` (`users-roles.service.ts:50-52`), `getInvoicesPage`.

ADR-004 exige que el export use "exactamente los mismos filtros del listado". El orden no está incluido.

**C-4 — Dos formas de wire para la paginación.**
- 11 listados devuelven `{data, meta:{total, page, page_size}}` en snake_case (`orders/api/dto.ts:81-94`, `clients/api/dto.ts:62`, etc.) y lo mapean a `PageResult`.
- 8 devuelven `PageResult` (`{items, total, page, pageSize}`) directo: `getDeliveriesPage`, `getTripsPage`, `getTripPosition`, `getDriversPage`, `getVehiclesPage`, `getPurchaseOrdersPage`, `getClientAccountsPage`, `getOverdueClientsPage`.
- Las alertas usan `{items, nextCursor}` (`alerts.service.ts:60-70`).

**C-5 — 59 de 91 respuestas no tienen DTO.** El "contrato" de logística, viajes, vehículos, choferes, alertas, motivos, compras, dashboard, productos (`fetchProducts` → `InventoryItem[]`, aunque existe `shared/api/products/dto.ts`) y cuentas corrientes es **el tipo de dominio del frontend**: camelCase, con campos calculados en el cliente (`allowedTransitions`, `capacidadUsada`). No hay forma de wire acordada para el backend. Los 28 con DTO usan snake_case en español (`numero_pedido`, `estado_comercial`). Ver 08#4.

**C-6 — Listas sin paginar ni límite (regla 3.1/3.11):**
- Catálogos completos: `fetchProducts` (`products.service.ts:88`), `fetchClientsCatalog` (`clients.service.ts:165`), `fetchSuppliers` (`suppliers.service.ts:165`), `fetchActiveDrivers`, `fetchActiveVehicles`.
- Colecciones de un padre, sin tope: `getPurchaseOrdersBySupplierId` (`purchaseOrders.service.ts:238`), `getDeliveriesForOrder` (`deliveries.service.ts:765`).
- Acotadas por naturaleza: `getMotivoCatalog`, `getPermissionsMatrix` (4 roles), `getTripRoute` (`MAX_ROUTE_POINTS`), `getDeliveriesByIds` (acotada por los ids que se piden), `getRecentAuditLog` (sin `limit` en el request).
- La deuda de ADR-016 (`fetchProducts` llamado **server→server** desde 4 mocks) se suma a esto.

**C-7 — Verbos en el path y mezcla de idiomas.**
- Verbos: `/orders/{id}/advance`, `/orders/{id}/cancel`, `/deliveries/{id}/transition`, `/deliveries/{id}/reprogram`, `/trips/{id}/transition`, `/trips/{id}/stops/{sid}/assign`, `/drivers/{id}/toggle-activo`, `/vehicles/{id}/toggle-activo`, `/alerts/{id}/read`, `/purchase-orders/from-suggestion`.
- Español mezclado con inglés: `/trips/{id}/posicion`, `/trips/{id}/recorrido`, `/stops/{sid}/no-visitada`, `/motivos`.
- Sub-recursos de consulta: `/deliveries/by-ids`, `/purchase-orders/by-supplier/{id}`.
- Para cambiar de estado conviven `PUT …/transition` (entrega, viaje), `PUT …/status` (OC, `purchaseOrders.service.ts:317`), `PUT …/advance` + `PUT …/cancel` (pedido) y `POST …/no-visitada` (parada).

**C-8 — `branchId` en el path en unos, en la query en otros, y en ninguno en los demás.**
- `getStockedProductsPage` lo pone en el **path** (`/products/stock-by-branch/{branchId}`, `products.service.ts:376`), pero su export lo manda en la **query** (`/products/stock-by-branch/export`, `:426`). `getStockForBranch` lo pone en el path (`/products/{productId}/stock/{branchId}`, `:193`).
- El resto lo manda en la query.
- 14 endpoints de recursos de sucursal (`/trips/{id}`, `/deliveries/{id}/…`) no lo mandan. El servidor tendría que validar la pertenencia del recurso a la sucursal y a la empresa solo a partir del id.

**C-9 — Mismo path, dos contratos.** `GET /suppliers` es `fetchSuppliersPage` (paginado, `{data, meta}`, `suppliers.service.ts:116`) y también `fetchSuppliers` (catálogo completo, `SupplierDTO[]`, `:165`). En modo `http` las dos llamadas son indistinguibles por path.

**C-10 — `empresaId` viaja en las 87 llamadas que tienen consumidor**: 53 como parámetro de la función, 34 dentro de los filtros. Va en query o body según el caso, y contradice la decisión D1 (`DECISIONES_TECNICAS_LOG.md:219-220`). Ver `04_TRANSVERSALES.md` §Tenancy y 08#1.

**C-11 — La identidad del actor viaja en el body.** `quien`, `creadoPor` y `responsable` se mandan desde el cliente en `transitionDelivery` (`deliveries.service.ts:359`), `registrarEntrega` (`:538`), `reprogramDelivery` (`ReprogramDeliveryInput.responsable`, `:399`), `createTrip`, `transitionTrip` (`trips.service.ts:431`), `registerPod` (`:529`), `createDelivery` y `assignDeliveriesToStop`. El servidor no debería tomar del body quién hizo algo.

## Tabla completa (91 filas, orden alfabético de archivo)

Abreviaturas: `m/` = `src/modules/`, `s/` = `src/shared/`, `svc/` = `src/services/mock/`. "Concurr." = el mock **chequea** `expectedVersion` (no basta con que incremente `version`). "Consumidor UI" = archivos `.tsx` o hooks que nombran la función en código (no en comentarios). "server→server" = otro service que la llama desde adentro de su resolver mock.

| # | Método | Path | Función — archivo:línea | Params (path/query) | Body | Respuesta | Alcance | Paginado | Mut. | Idempot. | Concurr. | Consumidor UI (y server→server) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/cash/transactions` | `getCashTransactionsPage` — m/cash/api/cash.service.ts:150 | empresaId, page, pageSize | — | CashPageDTO | empresa | page/pageSize | no | — | — | m/cash/CashPage.tsx |
| 2 | GET | `/cash/transactions/export` | `exportCashTransactions` — m/cash/api/cash.service.ts:194 | empresaId | — | ExportResult<CashTransaction> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/cash/CashPage.tsx |
| 3 | POST | `/cash/transactions` | `createCashTransaction` — m/cash/api/cash.service.ts:217 | — | { empresaId, ...cashTransactionFormInputToDTO(input) } | CashTransactionDTO | empresa | no | si | — | — | m/cash/CashPage.tsx |
| 4 | GET | `/clients` | `getClientsPage` — m/clients/api/clients.service.ts:112 | empresaId, search, zone, seller, status, page, pageSize | — | ClientsPageDTO | empresa | page/pageSize | no | — | — | m/clients/ClientsPage.tsx |
| 5 | GET | `/clients/export` | `exportClients` — m/clients/api/clients.service.ts:142 | empresaId, search, zone, seller, status | — | ExportResult<ClientAccount> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/clients/ClientsPage.tsx |
| 6 | GET | `/clients/catalog` | `fetchClientsCatalog` — m/clients/api/clients.service.ts:166 | empresaId | — | ClientAccount[] | empresa | no | no | — | — | m/orders/components/create-order/CreateOrderModal.tsx, m/orders/components/OrderDetailPanel.tsx |
| 7 | GET | `/clients/{clientId}` | `getClientById` — m/clients/api/clients.service.ts:188 | {clientId}, empresaId | — | ClientAccountDTO | empresa | no | no | — | — | —<br>server→server: m/orders/api/orders.service.ts |
| 8 | POST | `/clients` | `createClient` — m/clients/api/clients.service.ts:207 | — | { empresaId, ...clientFormInputToDTO(input) } | ClientAccountDTO | empresa | no | si | — | — | m/clients/ClientsPage.tsx |
| 9 | PUT | `/clients/{id}` | `updateClient` — m/clients/api/clients.service.ts:230 | {id} | { empresaId, ...clientFormInputToDTO(input) } | ClientAccountDTO | empresa | no | si | — | — | m/clients/ClientsPage.tsx |
| 10 | GET | `/clients/accounts` | `getClientAccountsPage` — m/clients/api/clients.service.ts:337 | empresaId, search, dateFrom, dateTo, page, pageSize, sortField, sortDirection | — | PageResult<ClientAccount> | empresa | page/pageSize | no | — | — | m/clients/components/ClientAccountsTable.tsx |
| 11 | GET | `/clients/accounts/export` | `exportClientAccounts` — m/clients/api/clients.service.ts:372 | empresaId, search, dateFrom, dateTo | — | ExportResult<ClientAccount> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/clients/components/ClientAccountsTable.tsx |
| 12 | GET | `/clients/overdue` | `getOverdueClientsPage` — m/clients/api/clients.service.ts:707 | empresaId, search, bucket, dateFrom, dateTo, page, pageSize, sortField, sortDirection | — | PageResult<OverdueClientRow, OverdueClientsAggregates> | empresa | page/pageSize | no | — | — | m/clients/components/ClientOverdueTable.tsx<br>server→server: m/dashboard/api/dashboardAggregates.service.ts |
| 13 | GET | `/clients/overdue/export` | `exportOverdueClients` — m/clients/api/clients.service.ts:763 | empresaId, search, bucket, dateFrom, dateTo | — | ExportResult<OverdueClientRow> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/clients/components/ClientOverdueTable.tsx |
| 14 | GET | `/dashboard/aggregates` | `getDashboardAggregates` — m/dashboard/api/dashboardAggregates.service.ts:51 | empresaId, dateFrom, dateTo, branchId | — | DashboardAggregatesResult | empresa (branchId en request) | no | no | — | — | m/dashboard/hooks/useDashboardAggregates.ts |
| 15 | GET | `/inventory/movements` | `getMovementsPage` — m/inventory/api/movements/movements.service.ts:78 | empresaId, branchId, page, pageSize, sortField, sortDirection | — | InventoryMovementsPageDTO | sucursal (branchId en request) | page/pageSize | no | — | — | m/inventory/components/TabMovements.tsx |
| 16 | GET | `/inventory/movements/export` | `exportMovements` — m/inventory/api/movements/movements.service.ts:119 | empresaId, branchId | — | ExportResult<InventoryMovement> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/inventory/components/TabMovements.tsx |
| 17 | GET | `/inventory/product-history` | `getProductHistoryPage` — m/inventory/api/product-history/product-history.service.ts:86 | empresaId, branchId, search, page, pageSize, sortField, sortDirection | — | ProductHistoryPageDTO | sucursal (branchId en request) | page/pageSize | no | — | — | m/inventory/components/TabProductHistory.tsx |
| 18 | GET | `/inventory/product-history/export` | `exportProductHistory` — m/inventory/api/product-history/product-history.service.ts:128 | empresaId, branchId, search | — | ExportResult<ProductHistoryEvent> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/inventory/components/TabProductHistory.tsx |
| 19 | GET | `/inventory/purchase-suggestions` | `getPurchaseSuggestionsPage` — m/inventory/api/purchase-suggestions/purchase-suggestions.service.ts:52 | empresaId, branchId, page, pageSize, sortField, sortDirection | — | PurchaseSuggestionsPageDTO | sucursal (branchId en request) | page/pageSize | no | — | — | m/inventory/components/TabPurchases.tsx |
| 20 | GET | `/inventory/purchase-suggestions/export` | `exportPurchaseSuggestions` — m/inventory/api/purchase-suggestions/purchase-suggestions.service.ts:89 | empresaId, branchId | — | ExportResult<PurchaseSuggestionDTO> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/inventory/components/TabPurchases.tsx |
| 21 | GET | `/deliveries` | `getDeliveriesPage` — m/logistics/services/deliveries.service.ts:228 | empresaId, branchId, status, dateFrom, dateTo, page, pageSize, sortField, sortDirection | — | PageResult<Delivery, DeliveryAggregates> | sucursal (branchId en request) | page/pageSize | no | — | — | m/logistics/components/CreateTripModal.tsx, m/logistics/LogisticsPage.tsx |
| 22 | GET | `/deliveries/export` | `exportDeliveries` — m/logistics/services/deliveries.service.ts:296 | empresaId, branchId, status, dateFrom, dateTo | — | ExportResult<Delivery> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/logistics/LogisticsPage.tsx |
| 23 | PUT | `/deliveries/{deliveryId}/transition` | `transitionDelivery` — m/logistics/services/deliveries.service.ts:356 | {deliveryId} | { empresaId, idempotencyKey, hasta, quien } | DeliveryTransitionResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/LogisticsPage.tsx<br>server→server: m/logistics/services/trips.service.ts |
| 24 | PUT | `/deliveries/{deliveryId}/reprogram` | `reprogramDelivery` — m/logistics/services/deliveries.service.ts:424 | {deliveryId} | { empresaId, idempotencyKey, ...input } | ReprogramDeliveryResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/ReprogramarModal.tsx<br>server→server: m/logistics/services/trips.service.ts |
| 25 | POST | `/deliveries/{deliveryId}/notes` | `registrarEntrega` — m/logistics/services/deliveries.service.ts:535 | {deliveryId} | { empresaId, idempotencyKey, lines, evidenciaIds, creadoPor } | RegistrarEntregaResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/RegistrarEntregaModal.tsx |
| 26 | POST | `/deliveries` | `createDelivery` — m/logistics/services/deliveries.service.ts:699 | — | { empresaId, idempotencyKey, orderId, ...input } | CreateDeliveryResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/orders/components/CreateDeliveryModal.tsx |
| 27 | GET | `/orders/{orderId}/deliveries` | `getDeliveriesForOrder` — m/logistics/services/deliveries.service.ts:765 | {orderId}, empresaId | — | Delivery[] | sucursal (branchId NO viaja) | no | no | — | — | m/orders/components/OrderDetailPanel.tsx |
| 28 | GET | `/deliveries/by-ids` | `getDeliveriesByIds` — m/logistics/services/deliveries.service.ts:784 | empresaId, ids | — | Delivery[] | sucursal (branchId NO viaja) | no | no | — | — | m/logistics/components/TripDetailPanel.tsx |
| 29 | GET | `/deliveries/{deliveryId}/pod` | `getPodForDelivery` — m/logistics/services/pod.service.ts:63 | {deliveryId}, empresaId | — | Pod \| null | sucursal (branchId NO viaja) | no | no | — | — | m/logistics/components/TripDetailPanel.tsx |
| 30 | GET | `/trips` | `getTripsPage` — m/logistics/services/trips.service.ts:134 | empresaId, branchId, estado, fecha, vehicleId, driverId, page, pageSize, sortField, sortDirection | — | PageResult<Trip, undefined> | sucursal (branchId en request) | page/pageSize | no | — | — | m/logistics/TripsPage.tsx |
| 31 | GET | `/trips/{tripId}` | `getTripById` — m/logistics/services/trips.service.ts:176 | {tripId}, empresaId | — | Trip \| null | sucursal (branchId NO viaja) | no | no | — | — | m/logistics/components/TripDetailPanel.tsx |
| 32 | POST | `/trips` | `createTrip` — m/logistics/services/trips.service.ts:226 | — | { empresaId, idempotencyKey, ...input } | CreateTripResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/CreateTripModal.tsx |
| 33 | POST | `/trips/{tripId}/stops/{stopId}/assign` | `assignDeliveriesToStop` — m/logistics/services/trips.service.ts:321 | {tripId}, {stopId} | { empresaId, idempotencyKey, tripId, stopId, input, ...options } | AssignDeliveriesResult | sucursal (branchId NO viaja) | no | si | withIdempotency | expectedVersion | m/logistics/components/CreateTripModal.tsx |
| 34 | PUT | `/trips/{tripId}/transition` | `transitionTrip` — m/logistics/services/trips.service.ts:428 | {tripId} | { empresaId, idempotencyKey, hasta, quien } | TransitionTripResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/TripDetailPanel.tsx |
| 35 | PUT | `/trips/{tripId}/stops/order` | `updateStopOrder` — m/logistics/services/trips.service.ts:467 | {tripId} | { empresaId, stops } | UpdateStopOrderResult | sucursal (branchId NO viaja) | no | si | — | — | m/logistics/components/TripDetailPanel.tsx |
| 36 | POST | `/trips/{tripId}/stops/{stopId}/pod` | `registerPod` — m/logistics/services/trips.service.ts:526 | {tripId}, {stopId} | { empresaId, idempotencyKey, deliveryId, stopId, ...input, creadoPor: quien } | RegisterPodResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/PodModal.tsx |
| 37 | POST | `/trips/{tripId}/stops/{stopId}/no-visitada` | `markStopNoVisitada` — m/logistics/services/trips.service.ts:635 | {tripId}, {stopId} | { empresaId, idempotencyKey, ...input } | MarkStopNoVisitadaResult | sucursal (branchId NO viaja) | no | si | withIdempotency | — | m/logistics/components/NoEntregaModal.tsx |
| 38 | GET | `/trips/{tripId}/posicion` | `getTripPosition` — m/logistics/services/trips.service.ts:749 | {tripId}, empresaId | — | PageResult<TripPosition, undefined> | sucursal (branchId NO viaja) | page/pageSize | no | — | — | m/logistics/components/TripDetailPanel.tsx |
| 39 | GET | `/trips/{tripId}/recorrido` | `getTripRoute` — m/logistics/services/trips.service.ts:773 | {tripId}, empresaId | — | TripPosition[] | sucursal (branchId NO viaja) | no | no | — | — | m/logistics/components/TripDetailPanel.tsx |
| 40 | GET | `/orders` | `getOrdersPage` — m/orders/api/orders.service.ts:175 | empresaId, search, status, seller, paymentMethod, dateFrom, dateTo, page, pageSize, sortField, sortDirection | — | OrdersPageDTO | empresa | page/pageSize | no | — | — | m/orders/OrdersPage.tsx |
| 41 | GET | `/orders/export` | `exportOrders` — m/orders/api/orders.service.ts:220 | empresaId, search, status, seller, paymentMethod, dateFrom, dateTo | — | ExportResult<OrderDTO> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/orders/OrdersPage.tsx |
| 42 | POST | `/orders` | `createOrder` — m/orders/api/orders.service.ts:296 | — | { empresaId, ...orderFormInputToDTO(input) } | CreateOrderResponseDTO | empresa | no | si | — | — | m/orders/components/create-order/CreateOrderModal.tsx |
| 43 | PUT | `/orders/{orderId}/advance` | `advanceOrderStatus` — m/orders/api/orders.service.ts:411 | {orderId}, empresaId | — | OrderStatusTransitionResult | empresa | no | si | — | — | m/orders/OrdersPage.tsx |
| 44 | PUT | `/orders/{orderId}/cancel` | `cancelOrder` — m/orders/api/orders.service.ts:449 | {orderId}, empresaId | — | OrderStatusTransitionResult | empresa | no | si | — | — | m/orders/OrdersPage.tsx |
| 45 | GET | `/orders/{orderId}` | `getOrderById` — m/orders/api/orders.service.ts:513 | {orderId}, empresaId | — | OrderDTO \| undefined | empresa | no | no | — | — | m/logistics/components/RegistrarEntregaModal.tsx<br>server→server: m/logistics/services/deliveries.service.ts |
| 46 | GET | `/settings/audit-log` | `getRecentAuditLog` — m/settings/api/audit/audit.service.ts:29 | empresaId | — | AuditLogItemDTO[] | empresa | no | no | — | — | m/settings/components/widgets/AuditLogWidget.tsx |
| 47 | GET | `/settings/invoices` | `getInvoicesPage` — m/settings/api/subscription/subscription.service.ts:64 | empresaId, page, pageSize | — | InvoicesPageDTO | empresa | page/pageSize | no | — | — | m/settings/components/tabs/TabSubscription.tsx |
| 48 | GET | `/settings/invoices/export` | `exportInvoices` — m/settings/api/subscription/subscription.service.ts:89 | empresaId | — | ExportResult<InvoiceRecordDTO> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/settings/components/tabs/TabSubscription.tsx |
| 49 | GET | `/settings/users` | `getUsersPage` — m/settings/api/users-roles/users-roles.service.ts:70 | empresaId, page, pageSize | — | UsersPageDTO | empresa | page/pageSize | no | — | — | m/settings/components/tabs/TabUsersRoles.tsx |
| 50 | GET | `/settings/users/export` | `exportUsers` — m/settings/api/users-roles/users-roles.service.ts:95 | empresaId | — | ExportResult<UserAccountDTO> | empresa | export (MAX_EXPORT_ROWS) | no | — | — | m/settings/components/tabs/TabUsersRoles.tsx |
| 51 | GET | `/settings/permissions` | `getPermissionsMatrix` — m/settings/api/users-roles/users-roles.service.ts:116 | empresaId | — | PermissionMatrixDTO[] | empresa | no | no | — | — | m/settings/components/tabs/TabUsersRoles.tsx |
| 52 | PUT | `/settings/permissions/{role}` | `updateRolePermission` — m/settings/api/users-roles/users-roles.service.ts:136 | {role} | { empresaId, modulo: moduleKey, acceso: hasAccess } | PermissionMatrixDTO[] | empresa | no | si | — | — | m/settings/components/tabs/TabUsersRoles.tsx |
| 53 | GET | `/suppliers` | `fetchSuppliersPage` — m/suppliers/api/suppliers.service.ts:116 | empresaId, search, category, page, pageSize, sortField, sortDirection | — | SuppliersPageDTO | empresa | page/pageSize | no | — | — | m/suppliers/SuppliersPage.tsx |
| 54 | GET | `/suppliers/export` | `exportSuppliers` — m/suppliers/api/suppliers.service.ts:148 | empresaId, search, category | — | SupplierDTO[] | empresa | no | no | — | — | m/suppliers/SuppliersPage.tsx |
| 55 | GET | `/suppliers` | `fetchSuppliers` — m/suppliers/api/suppliers.service.ts:165 | empresaId | — | SupplierDTO[] | empresa | no | no | — | — | m/compras/ComprasPage.tsx, m/inventory/InventoryPage.tsx |
| 56 | POST | `/suppliers` | `createSupplier` — m/suppliers/api/suppliers.service.ts:194 | — | supplierFormInputToDTO(empresaId, input) | SupplierDTO | empresa | no | si | — | — | m/suppliers/SuppliersPage.tsx |
| 57 | PUT | `/suppliers/{id}` | `updateSupplier` — m/suppliers/api/suppliers.service.ts:230 | {id} | supplierFormInputToDTO(empresaId, input) | SupplierDTO | empresa | no | si | — | — | m/suppliers/SuppliersPage.tsx |
| 58 | GET | `/dashboard` | `fetchDashboardData` — svc/dashboard.service.ts:29 | empresaId | — | DashboardData | empresa | no | no | — | — | s/hooks/useDashboard.ts |
| 59 | GET | `/dashboard/kpis` | `fetchKpis` — svc/dashboard.service.ts:39 | — | — | (sin tipo) | empresa **(sin empresaId)** | no | no | — | — | **ninguno** |
| 60 | GET | `/dashboard/sales-series` | `fetchSalesSeries` — svc/dashboard.service.ts:47 | — | — | (sin tipo) | empresa **(sin empresaId)** | no | no | — | — | **ninguno** |
| 61 | GET | `/dashboard/top-products` | `fetchTopProducts` — svc/dashboard.service.ts:55 | — | — | (sin tipo) | empresa **(sin empresaId)** | no | no | — | — | **ninguno** |
| 62 | GET | `/dashboard/recent-orders` | `fetchRecentOrders` — svc/dashboard.service.ts:63 | — | — | (sin tipo) | empresa **(sin empresaId)** | no | no | — | — | **ninguno** |
| 63 | GET | `/purchase-orders` | `getPurchaseOrdersPage` — svc/purchaseOrders.service.ts:156 | empresaId, search, supplierId, branchId, status, dateFrom, dateTo, page, pageSize, sortField, sortDirection | — | PageResult<PurchaseOrder, PurchaseOrdersAggregates> | empresa (branchId en request) | page/pageSize | no | — | — | m/compras/components/TabPendingReceipt.tsx, m/compras/ComprasPage.tsx, m/inventory/components/TabPurchases.tsx |
| 64 | GET | `/purchase-orders/export` | `exportPurchaseOrders` — svc/purchaseOrders.service.ts:204 | empresaId, search, supplierId, branchId, status, dateFrom, dateTo | — | ExportResult<PurchaseOrder> | empresa (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/compras/components/TabPendingReceipt.tsx, m/compras/ComprasPage.tsx |
| 65 | GET | `/purchase-orders/by-supplier/{supplierId}` | `getPurchaseOrdersBySupplierId` — svc/purchaseOrders.service.ts:238 | {supplierId}, empresaId | — | PurchaseOrder[] | empresa | no | no | — | — | m/suppliers/components/SupplierDetailPanel.tsx |
| 66 | POST | `/purchase-orders` | `createPurchaseOrder` — svc/purchaseOrders.service.ts:268 | — | { empresaId, ...input } | CreatePurchaseOrderResult | empresa | no | si | — | — | m/compras/components/PurchaseOrderFormModal.tsx |
| 67 | PUT | `/purchase-orders/{orderId}/status` | `updatePurchaseOrderStatus` — svc/purchaseOrders.service.ts:315 | {orderId} | { empresaId, status: nextStatus } | PurchaseOrderTransitionResult | empresa | no | si | — | — | m/compras/components/TabPendingReceipt.tsx, m/compras/ComprasPage.tsx |
| 68 | POST | `/purchase-orders/from-suggestion` | `generatePurchaseOrderFromSuggestion` — svc/purchaseOrders.service.ts:352 | — | { empresaId, ...input } | GeneratePurchaseOrderResult | empresa | no | si | — | — | m/inventory/components/TabPurchases.tsx |
| 69 | GET | `/alerts/summary` | `getAlertsSummary` — s/api/alerts/alerts.service.ts:39 | empresaId | — | AlertsSummary | empresa | no | no | — | — | s/layouts/AlertsBell.tsx |
| 70 | GET | `/alerts` | `getAlertsPage` — s/api/alerts/alerts.service.ts:60 | empresaId, cursor, tipo, severidad, pageSize | — | AlertsPageResult | empresa | cursor | no | — | — | s/layouts/AlertsBell.tsx |
| 71 | PUT | `/alerts/{alertId}/read` | `markAlertAsRead` — s/api/alerts/alerts.service.ts:75 | {alertId}, empresaId | — | void | empresa | no | si | — | — | s/layouts/AlertsBell.tsx |
| 72 | GET | `/drivers` | `getDriversPage` — s/api/drivers/drivers.service.ts:48 | empresaId, search, soloActivos, page, pageSize, sortField, sortDirection | — | PageResult<Driver, undefined> | empresa | page/pageSize | no | — | — | m/logistics/DriversPage.tsx |
| 73 | POST | `/drivers` | `createDriver` — s/api/drivers/drivers.service.ts:101 | — | { empresaId, idempotencyKey, ...input } | DriverMutationResult | empresa | no | si | withIdempotency | — | m/logistics/DriversPage.tsx |
| 74 | PUT | `/drivers/{driverId}` | `updateDriver` — s/api/drivers/drivers.service.ts:120 | {driverId} | { empresaId, idempotencyKey, ...input } | DriverMutationResult | empresa | no | si | withIdempotency | — | m/logistics/DriversPage.tsx |
| 75 | PUT | `/drivers/{driverId}/toggle-activo` | `toggleDriverActivo` — s/api/drivers/drivers.service.ts:138 | {driverId} | { empresaId, idempotencyKey } | DriverMutationResult | empresa | no | si | withIdempotency | — | m/logistics/DriversPage.tsx |
| 76 | GET | `/drivers/active` | `fetchActiveDrivers` — s/api/drivers/drivers.service.ts:158 | empresaId | — | Driver[] | empresa | no | no | — | — | m/logistics/TripsPage.tsx |
| 77 | GET | `/motivos` | `getMotivoCatalog` — s/api/motivos/motivos.service.ts:28 | empresaId, tipo | — | MotivoCatalogItem[] | empresa | no | no | — | — | m/logistics/components/NoEntregaModal.tsx, m/logistics/components/RegistrarEntregaModal.tsx, m/logistics/components/ReprogramarModal.tsx<br>server→server: m/logistics/services/deliveries.service.ts |
| 78 | GET | `/products` | `fetchProducts` — s/api/products/products.service.ts:89 | empresaId | — | InventoryItem[] | empresa | no | no | — | — | m/compras/ComprasPage.tsx, m/inventory/InventoryPage.tsx, m/orders/components/create-order/CreateOrderModal.tsx<br>server→server: m/inventory/api/purchase-suggestions/purchase-suggestions.service.ts, m/orders/api/orders.service.ts, svc/purchaseOrders.service.ts |
| 79 | POST | `/products` | `createProduct` — s/api/products/products.service.ts:99 | — | { empresaId, ...productFormInputToDTO(input) } | InventoryItem | empresa | no | si | — | — | m/inventory/InventoryPage.tsx |
| 80 | PUT | `/products/{id}` | `updateProduct` — s/api/products/products.service.ts:118 | {id} | { empresaId, ...productFormInputToDTO(input) } | InventoryItem | empresa | no | si | — | — | m/inventory/InventoryPage.tsx |
| 81 | DELETE | `/products/{id}` | `deleteProduct` — s/api/products/products.service.ts:162 | {id}, empresaId | — | void | empresa | no | si | — | — | m/inventory/InventoryPage.tsx |
| 82 | GET | `/products/{productId}/stock/{branchId}` | `getStockForBranch` — s/api/products/products.service.ts:191 | {productId}, {branchId}, empresaId | — | ProductStock \| undefined | sucursal (branchId en request) | no | no | — | — | m/compras/ComprasPage.tsx, m/inventory/components/StockAdjustmentModal.tsx, m/orders/components/create-order/OrderProductsSection.tsx |
| 83 | GET | `/products/stock-by-branch/{branchId}` | `getStockedProductsPage` — s/api/products/products.service.ts:374 | {branchId}, empresaId, branchId, search, page, pageSize, sortField, sortDirection | — | StockedProductsPageDTO | sucursal (branchId en request) | page/pageSize | no | — | — | m/inventory/components/TabStockCurrent.tsx, m/inventory/InventoryPage.tsx |
| 84 | GET | `/products/stock-by-branch/export` | `exportStockedProducts` — s/api/products/products.service.ts:424 | empresaId, branchId, search | — | ExportResult<StockedInventoryItem> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/inventory/components/TabStockCurrent.tsx |
| 85 | GET | `/products/low-stock` | `getLowStockPage` — s/api/products/products.service.ts:508 | empresaId, branchId, search, page, pageSize, sortField, sortDirection | — | LowStockPageDTO | sucursal (branchId en request) | page/pageSize | no | — | — | m/inventory/components/TabLowStock.tsx, m/inventory/InventoryPage.tsx |
| 86 | GET | `/products/low-stock/export` | `exportLowStock` — s/api/products/products.service.ts:555 | empresaId, branchId, search | — | ExportResult<StockedInventoryItem> | sucursal (branchId en request) | export (MAX_EXPORT_ROWS) | no | — | — | m/inventory/components/TabLowStock.tsx |
| 87 | GET | `/vehicles` | `getVehiclesPage` — s/api/vehicles/vehicles.service.ts:57 | empresaId, search, soloActivos, page, pageSize, sortField, sortDirection | — | PageResult<Vehicle, undefined> | empresa | page/pageSize | no | — | — | m/logistics/VehiclesPage.tsx |
| 88 | POST | `/vehicles` | `createVehicle` — s/api/vehicles/vehicles.service.ts:121 | — | { empresaId, idempotencyKey, ...input } | VehicleMutationResult | empresa | no | si | withIdempotency | — | m/logistics/VehiclesPage.tsx |
| 89 | PUT | `/vehicles/{vehicleId}` | `updateVehicle` — s/api/vehicles/vehicles.service.ts:150 | {vehicleId} | { empresaId, idempotencyKey, ...input } | VehicleMutationResult | empresa | no | si | withIdempotency | — | m/logistics/VehiclesPage.tsx |
| 90 | PUT | `/vehicles/{vehicleId}/toggle-activo` | `toggleVehicleActivo` — s/api/vehicles/vehicles.service.ts:176 | {vehicleId} | { empresaId, idempotencyKey } | VehicleMutationResult | empresa | no | si | withIdempotency | — | m/logistics/VehiclesPage.tsx |
| 91 | GET | `/vehicles/active` | `fetchActiveVehicles` — s/api/vehicles/vehicles.service.ts:197 | empresaId | — | Vehicle[] | empresa | no | no | — | — | m/logistics/TripsPage.tsx |

## Funciones de "servidor" que NO pasan por `httpClient`

| Función | Archivo:línea | Qué hace | Quién la llama | Problema |
|---|---|---|---|---|
| `fetchSession` | `services/mock/session.service.ts:17` | devuelve `SESSION_MOCK_DATA` con `setTimeout` propio | `shared/state/useSessionStore.ts` | sin contrato HTTP, sin auth (ver 04 §Auth) |
| `createExportJob` / `getExportJobStatus` | `shared/api/exports/exportJobs.ts:85,131` | "servidor" de exportación en el navegador | `shared/hooks/useExportJob.ts:71,87` | C-1 |
| `signUpload` / `confirmUpload` | `shared/api/uploads/uploads.service.ts:44,61` | simula URL prefirmada (ADR-005) | `shared/hooks/useEvidenceUpload.ts` | sin contrato HTTP. Su comentario (`:5`) dice que es a propósito |
| `ANALYTICS_DATA` (import directo) | `modules/analytics/AnalyticsPage.tsx:2` | dataset estático por período | la propia página | sin service ni contrato (ALTO preexistente en `ESTADO.md`) |
| **`getDeliveryNotesForDelivery`** | `modules/logistics/services/deliveries.service.ts:652` | lee `deliveryNotesStore` sincrónicamente | **`DeliveryHistoryModal.tsx` (componente)** | **ALTO: los remitos no tienen endpoint. En modo `http` el modal no muestra nada** |
| `getActiveDeliveriesForOrder` | `deliveries.service.ts` | entregas activas de un pedido | `orders.service.ts#cancelOrder:461` | server-internal |
| `getOrderBranchLinksForAggregation` | `deliveries.service.ts` | relaciones pedido-sucursal | `dashboardAggregates.service.ts` | server-internal (ADR-009) |
| `getDeliveryById` / `getDeliveryIdsMatchingFilter` | `deliveries.service.ts` | lookup y filtro | `trips.service.ts` | server-internal |
| `releaseDeliveryFromTrip` | `trips.service.ts:62` | saca la entrega de su parada | `deliveries.service.ts#reprogramDelivery:493` | server-internal, efecto cruzado |
| `applyDeliveryToOrderLines` | `orders.service.ts:541` | suma `cantidad_entregada` | `deliveries.service.ts#registrarEntrega:627` | server-internal (ver 03, R-PED-6) |
| `registerPodEvidence` | `pod.service.ts:33` | guarda el POD | `trips.service.ts#registerPod:542` | server-internal |
| `getVehicleById` | `shared/api/vehicles/vehicles.service.ts` | lookup | `trips.service.ts` | server-internal |
| `getOrdersSnapshotForAggregation` | `orders.service.ts:488` | proyección del store completo | `dashboardAggregates` | server-internal, recorre la colección entera |
| `computePurchaseOrderTotal` | `services/mock/purchaseOrders.service.ts:60` | suma `quantity * unitPrice` | 6 componentes de compras/proveedores | **regla de dinero en el cliente**, en float (ver 04 §Dinero) |

## Los 3 services que siguen en `src/services/mock/`

| Archivo | Llamadas | Estado |
|---|---|---|
| `dashboard.service.ts` | 5 (`fetchDashboardData` + 4 muertas sin `empresaId`) | `fetchDashboardData` alimenta `useDashboard` → `DashboardPage`, sin DTO, devuelve `DashboardData` (KPIs con `value: string` ya formateado, `dashboard.types.ts:8`). Las 4 restantes no tienen consumidor (su propio comentario lo dice, `:20-25`). Convive con `modules/dashboard/api/dashboardAggregates.service.ts` (ADR-009): **dos fuentes para el mismo tablero** |
| `purchaseOrders.service.ts` | 6 | Compras completo. Sin DTO, `PageResult` directo. Dos de sus funciones llaman `fetchProducts` server→server (ADR-016) |
| `session.service.ts` | 0 | ver tabla anterior |
