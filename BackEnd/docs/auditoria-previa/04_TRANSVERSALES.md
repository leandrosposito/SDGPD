# 04 — Transversales: qué existe hoy y qué falta

**Verificado contra el código el 2026-10-07.** Rutas relativas a `FrontEnd/src/`. Cada punto: **Hoy** (con evidencia), **Falta** (lo que el backend tiene que proveer y el contrato no dice).

---

## 1. Autenticación y sesión

**Hoy:**
- La sesión sale de `fetchSession()` (`services/mock/session.service.ts:17-20`): `setTimeout` de 500 ms y `structuredClone(SESSION_MOCK_DATA)`. **No pasa por `httpClient`**, no hay endpoint, no hay credenciales.
- `useSessionStore.loadSession` (`shared/state/useSessionStore.ts:73-88`) la carga al arrancar. Si falla: `reason: 'fetch-error'`.
- La sucursal activa se recuerda en `localStorage` (`:50-58`) y se valida contra `session.branches` y `status === 'active'` (`:56,92-100`). Rechazos: `'not-found'` y `'inactive'`.
- `SessionUser` (`shared/types/session.types.ts:29-36`) tiene `id`, `fullName`, `email`, `company`, `branches`, `defaultBranchId`. **No tiene rol, permisos, token ni expiración.**
- **No hay login, logout, guard de rutas ni refresh**: `grep -rn "login\|logout\|Authorization\|credentials"` sobre `src` no da ninguna coincidencia de código. Ya estaba documentado en `docs/historial/auditorias/AUDIT_2026-09-30_iam.md`.
- **`httpClient` en modo `http`** (`shared/api/httpClient.ts:161-195`):
  - Headers: solo `Content-Type: application/json`, y únicamente cuando hay body (`:179`).
  - **Sin `Authorization`, sin `credentials`** (el `fetch` usa el default `same-origin`, así que una API en otro origen no recibe cookies), sin `Idempotency-Key`, sin `If-Match`, sin id de correlación.
  - Base: `VITE_API_BASE_URL` o `window.location.origin` (`:167`).

**Falta:**
- El contrato de login y sesión (`/auth/*`, o el que se decida) y **qué devuelve la sesión**: rol, permisos efectivos y sucursales habilitadas por usuario.
- Cómo viaja la credencial (cookie `HttpOnly` con `credentials: 'include'`, o bearer).
- Qué hace el cliente ante un 401: hoy un 401 es un `CLIENT_ERROR` más y no se reintenta (`ApiError.ts:36-37`).
- **La identidad del actor:** 8 mutaciones mandan `quien`, `creadoPor` o `responsable` en el body (01, C-11). El servidor tiene que tomarla de la sesión.

## 2. Tenancy

**Hoy:**
- `empresaId` viaja como **parámetro de cada función de service**, y de ahí a query o body, en **87 de las 91 llamadas**: 53 como parámetro posicional y 34 dentro de `filters` (los 4 restantes son las funciones muertas de `dashboard.service.ts`, que no lo tienen).
- Es la regla 3.5 del protocolo y el barrido `AUDIT_2026-09-08_empresaId-sweep.md`. Según `shared/api/types.ts:13-21`, el objetivo es que "agregar el filtrado real de tenant sea un cambio de qué valor se pasa, no de firma".
- **Ningún resolver mock filtra por `empresaId`**: hay una sola empresa (`company-001`). Muchos hacen `void empresaId` (`pod.service.ts:40`, `deliveries.service.ts:653`).
- `Trip` es la única entidad que **persiste** `empresaId` (`trip.types.ts:92`).

**Contradicción con la decisión D1** (`docs/historial/DECISIONES_TECNICAS_LOG.md:219-220`, también citada en `session.types.ts:3-5`):

> "el frontend nunca la usa como filtro ni la envía como parámetro manipulable […] cualquier función que hoy reciba `empresaId` desde el front sería un candidato a IDOR si el backend confiara en ese valor en vez de derivarlo de la sesión autenticada."

El código hace exactamente lo que D1 describe como riesgo. La nota de D4 (`:233`) pide lo mismo para `branchId`: el backend tiene que validar que la sucursal pertenezca a la empresa de la sesión. **BLOQUEANTE** para diseñar el contrato (08#1): si el servidor deriva la empresa del token, `empresaId` en query o body es ruido, en el mejor caso, y un vector de IDOR, en el peor.

**RLS:** el stack objetivo usa `empresa_id` + Row-Level Security. Para eso la empresa tiene que fijarse **por conexión o transacción, a partir de la sesión**, nunca a partir de un parámetro del request.

## 3. Permisos

**Hoy:**
- Matriz rol × módulo (8 módulos, sin `compras` ni `settings`, `settings.types.ts:15-27`). Se lee y se edita en `TabUsersRoles.tsx` (`getPermissionsMatrix`/`updateRolePermission`, `users-roles.service.ts:116-151`).
- **No la consulta nada más**: `grep getPermissionsMatrix` → solo `TabUsersRoles.tsx`. Sin guard de rutas, sin ocultar menús, sin chequeo en mutaciones.
- Hay un rol fijo `USER_ROLE: 'ADMIN' | 'EMPLOYEE' = 'ADMIN'` en `InventoryPage.tsx:69` que habilita acciones (`:190`). Ni siquiera usa los 4 `SystemRole`.
- `updateRolePermission` no tiene restricciones (03, R-PER-1).

**Falta:**
- Granularidad de acción (crear, anular, aprobar, forzar capacidad), que RF-IAM-002 llama RBAC.
- Permisos por sucursal.
- Qué permisos efectivos devuelve la sesión.
- Enforcement en el servidor: cada endpoint de 01 necesita un permiso asignado.

## 4. Idempotencia

**Hoy:**
- `withIdempotency(key, compute)` (`shared/utils/idempotency.ts:24-38`): un `Map<string, unknown>` **global del módulo**. **Sin expiración, sin separar por empresa ni por endpoint**: la misma clave usada en dos operaciones distintas devuelve el resultado de la primera. Solo cachea los resultados `success: true` (`:34-35`).
- **15 mutaciones** la usan: las 4 de entregas (`transitionDelivery`, `reprogramDelivery`, `registrarEntrega`, `createDelivery`), 5 de viajes (`createTrip`, `assignDeliveriesToStop`, `transitionTrip`, `registerPod`, `markStopNoVisitada`) y las 6 de vehículos y choferes (`create*`, `update*`, `toggle*Activo`).
- **La clave viaja en el body** (`idempotencyKey`, por ejemplo `deliveries.service.ts:359,427,538,702`). ADR-010 §4 dice "header o campo del body, a definir".
- Se generan claves derivadas: `` `${key}-finalizar` `` (`trips.service.ts:560`) y `` `${key}-${deliveryId}` `` (`:683`).
- **Momento de generación** (ADR-010 §4, corrección del 2026-09-09: "cuando se forma la INTENCIÓN", no al enviar):
  - Correcto en 4 modales, con `useState` al abrir: `NoEntregaModal.tsx:59`, `PodModal.tsx:70`, `RegistrarEntregaModal.tsx:72`, `ReprogramarModal.tsx:46`.
  - **Al enviar** (`crypto.randomUUID()` dentro del handler) en `TripDetailPanel.tsx:135`, `LogisticsPage.tsx:148`, `DriversPage.tsx:67,75` y `VehiclesPage.tsx:68,80`. Un doble click genera dos claves.

**Mutaciones SIN idempotencia (17):** `createOrder`, `advanceOrderStatus`, `cancelOrder`, `createClient`, `updateClient`, `createSupplier`, `updateSupplier`, `createProduct`, `updateProduct`, `deleteProduct`, `createPurchaseOrder`, `updatePurchaseOrderStatus`, `generatePurchaseOrderFromSuggestion`, `createCashTransaction`, `updateRolePermission`, `markAlertAsRead`, `updateStopOrder`.

**ALTO, combinado con la política de reintentos:** `httpClient` reintenta **cualquier método** 2 veces ante timeout, error de red o 5xx (`httpClient.ts:250`, `isRetryableApiError` en `ApiError.ts:36-37`). Un `POST /orders` que tardó más de 15 s pero se procesó **se reenvía y duplica el pedido**. Lo mismo para movimientos de caja, OC y clientes.

**Falta:** el transporte de la clave, el alcance del almacén (empresa + endpoint + clave), el TTL (ADR-010 §4 sugiere 24-48 h), qué responde el servidor si llega la misma clave con otro payload, y qué mutaciones la exigen.

## 5. Concurrencia optimista

**Hoy:**
- **Solo `Trip.version`** (`trip.types.ts:99`), y solo **`assignDeliveriesToStop` la compara** (`trips.service.ts:331-332`, `reason: 'stale-version'`; ADR-011 §3 habla de "409 granular").
- `transitionTrip` (`:444`), `updateStopOrder` (`:484`) y `releaseDeliveryFromTrip` (`:76`) **incrementan** `version` sin chequearla.
- **Ninguna otra entidad tiene versión ni ETag.** Editar un cliente, un producto, un proveedor o una OC pisa el último cambio sin aviso.

**Falta:** decidir la estrategia (`version` en el body, o `ETag`/`If-Match`) y qué entidades la requieren.

## 6. Paginación

**Hoy:**
- El contrato es **offset**: `PageQuery {page (1-based), pageSize, filters, sort?}` → `PageResult {items, total, page, pageSize, aggregates?}` (`shared/types/pagination.types.ts:18-43`).
- `pageSize` por defecto 25 (`usePagedQuery.ts:74`), opciones de la UI `[10, 25, 50, 100]` (`paginationDefaults.ts:8`). **Ningún resolver acota `pageSize`**: el servidor tiene que hacerlo (regla 3.11). `page` vive en la URL; `pageSize` no.
- `PROTOCOLO.md` §3.1 dice "Cursor por defecto". **Solo 1 listado usa cursor:** `getAlertsPage` (`alerts.service.ts:60`, `alertsCursor.ts:43`, ADR-007), y además sin acotar `pageSize` (hallazgo V6c, `VERIFICACION_CORRIDA_COMPLETA.md`).
- **19 listados usan `page/pageSize`:**
  - Wire `{data, meta}` (11): `getCashTransactionsPage`, `getClientsPage`, `getMovementsPage`, `getProductHistoryPage`, `getPurchaseSuggestionsPage`, `getOrdersPage`, `getInvoicesPage`, `getUsersPage`, `fetchSuppliersPage`, `getStockedProductsPage`, `getLowStockPage`.
  - `PageResult` directo (8): `getClientAccountsPage`, `getOverdueClientsPage`, `getDeliveriesPage`, `getTripsPage`, `getTripPosition` (página de 1 elemento, ADR-003), `getDriversPage`, `getVehiclesPage`, `getPurchaseOrdersPage`.
- Los aggregates (totales, conteos) viajan en la misma respuesta de la página (`aggregates?`).

## 7. Filtros y orden (lista blanca para el servidor)

| Listado | Filtros | Orden |
|---|---|---|
| Pedidos (`orders.service.ts:40-52`) | `search`, `status`, `seller`, `paymentMethod`, `dateFrom`, `dateTo` | `date`, `totalAmount`, `clientName` |
| Clientes, directorio (`clients.service.ts:66-78`) | `search`, `zone`, `seller`, `status` | `clientName` (**no viaja**, 01 C-3) |
| Cuentas corrientes (`:267-274`) | `search`, `dateFrom`, `dateTo` (filtro **de existencia**) | `clientName`, `currentBalance`, `creditLimit` |
| Morosos (`client.types.ts:130-140`) | `search`, `bucket`, `dateFrom`, `dateTo` | `clientName`, `overdueAmount`, `oldestDueDate` |
| Proveedores (`suppliers.service.ts:22-35`) | `search`, `category` | `name`, `cuit`, `currentBalance`, `category` |
| OC (`purchaseOrder.types.ts:74-84`) | `search` (por id), `supplierId`, `status`, `branchId?`, `dateFrom`, `dateTo` | `createdAt`, `total` (calculado) |
| Stock actual (`products.service.ts:229,253`) | `branchId`, `search` | `sku`, `name`, `stock`, `minStock` |
| Bajo stock mínimo (`:454-464`) | `branchId`, `search` | lo anterior + `deficit` |
| Sugerencias (`purchase-suggestions/filterSort.ts:15-20`) | `branchId` | `productName`, `currentStock`, `suggestedQuantity`, `estimatedCost` |
| Movimientos (`movements.service.ts:33-38`) | `branchId` | `date`, `productName`, `quantity` |
| Historial de producto (`product-history.service.ts:32-38`) | `branchId`, `search` | `date`, `productName` |
| Entregas (`deliveries.service.ts:136-150`) | `branchId|null`, `status`, `dateFrom`, `dateTo` | `estimatedTime`, `collectionAmount`, `clientName` |
| Viajes (`trips.service.ts:88-97`) | `branchId|null`, `estado`, `fecha` (exacta), `vehicleId`, `driverId` | `fecha`, `estado` |
| Vehículos (`vehicles.service.ts:20-26`) / Choferes (`drivers.service.ts:17-23`) | `search`, `soloActivos` | `patente`, `tipo` / `nombre`, `licencia` |
| Caja (`cash.service.ts:31-45`) | **ninguno** (ni fecha ni sucursal) | `time` |
| Usuarios (`users-roles.service.ts:24-31`) / Facturas SaaS (`subscription.service.ts:20-24`) | ninguno | `name` / `date` |
| Alertas (`alerts.service.ts:66`) | `tipo`, `severidad`, `cursor`, `pageSize` | recencia (fija) |

Los filtros de estado se leen de la URL con un `as` sin validar en 9 lugares (hallazgo V8, `VERIFICACION_CORRIDA_COMPLETA.md`). El servidor tiene que validar contra la unión, no confiar en el valor.

## 8. Errores

**Hoy:**
- `ApiErrorCode` (`shared/api/ApiError.ts:14-20`): `CLIENT_ERROR` (4xx), `SERVER_ERROR` (5xx), `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `UNKNOWN`.
- **En modo `http` el cuerpo de la respuesta de error se descarta**: `throw new ApiError(response.status, code, \`Error ${status} al llamar a ${path}.\`)` (`httpClient.ts:188-190`).
- Hay **8 toasts** que muestran `err.message` del servidor (`CreateClientModal.tsx:155,176`, `ProductFormModal.tsx:91,105`, `DriverFormModal.tsx:48`, `PodModal.tsx:235`, `VehicleFormModal.tsx:56`, `SupplierFormModal.tsx:54`). En modo mock reciben "Ya existe un proveedor con ese CUIT"; **en modo `http` recibirían "Error 400 al llamar a /suppliers."**. Es **ALTO**: la UI cambia de comportamiento al cambiar de adaptador, contra la premisa de `httpClient.ts:9-12`.

**Dos mecanismos de rechazo de negocio conviviendo:**
- **`ApiError` con mensaje de texto** (15 lugares): productos (SKU o código de barras duplicado, no existe), proveedores (obligatorios, CUIT duplicado, no existe), clientes (no existe), caja (monto), `applyDeliveryToOrderLines`.
- **Resultado `{success: false, reason}`** con HTTP 200: pedidos, entregas, viajes, vehículos, choferes, compras.
  - En modo `http`, `runHttp` solo lee el body si `response.ok`, así que **el servidor tendría que devolver estos rechazos con 2xx**. Si los devuelve con 4xx, el `reason` se pierde.

**Uniones de `reason` declaradas** (contrato de negocio a mapear a status):

| Tipo | Archivo:línea | Valores |
|---|---|---|
| `CreateOrderReason` | `shared/utils/orderEligibility.ts:27` | `no-items`, `client-not-found`, `inactive-client`, `product-not-found`, `inactive-product` |
| `OrderStatusTransitionReason` | `orders.service.ts:400` | `not-found`, `terminal-status`, `has-active-deliveries`, `invalid-status-for-cancel` |
| `DeliveryTransitionReason` | `deliveries.service.ts:328` | `not-found`, `invalid-transition` |
| `ReprogramDeliveryReason` | `:410` | `not-found`, `invalid-transition`, `motivo-invalido` |
| `RegistrarEntregaReason` | `:519` | `not-found`, `invalid-transition`, `no-lines`, `motivo-invalido`, `propagation-failed` |
| `CreateDeliveryReason` | `:684` | `order-not-found`, `order-not-confirmado` |
| `CreateTripReason` | `trips.service.ts:212` | `vehicle-not-found` |
| `AssignDeliveriesReason` | `:290` | `not-found`, `stale-version`, `exceeds-limit`, `exceeds-capacity`, `motivo-requerido` |
| `TransitionTripReason` | `:407` | `not-found`, `invalid-transition` |
| `UpdateStopOrderReason` | `:458` | `not-found`, `stops-mismatch` |
| `RegisterPodReason` | `:500` | `not-found`, `delivery-not-found` |
| `MarkStopNoVisitadaReason` | `:607` | `not-found`, `trip-not-en-curso`, `stop-not-pendiente`, `no-deliveries`, `delivery-en-estado-terminal`, `reprogram-failed` |
| `VehicleMutationReason` / `DriverMutationReason` | `vehicles.service.ts:101` / `drivers.service.ts:92` | `not-found`, `patente-duplicada` / `not-found` |
| `CreatePurchaseOrderReason` | `purchaseOrder.types.ts:115` | `invalid-supplier`, `no-lines`, `invalid-line`, `inactive-product` |
| `PurchaseOrderTransitionReason` | `:136` | `invalid-transition`, `order-not-found` |
| `GeneratePurchaseOrderReason` | `:158` | `invalid-supplier`, `inactive-product` |

Son de cliente, no de servidor: `SetActiveBranchReason`/`SessionLoadReason` (`useSessionStore.ts:26-27`) y `ReplenishmentActionReason` (`useReplenishmentStore.ts:19`). Hay vocabulario mezclado: `not-found` y `order-not-found` (mismo concepto, dos nombres).

## 9. Dinero (ADR-008)

**Hoy:** todo importe persistido es `number` en pesos con decimales (02). `Money` (`shared/utils/money.ts`) tiene 3 consumidores, todos en `modules/dashboard/`. Lo que hay:
- IVA en float sin redondeo (`CreateOrderModal.tsx`).
- `computePurchaseOrderTotal` en float (`purchaseOrders.service.ts:60`), usado en 6 componentes.
- `currency` solo existe en `ClientTransaction`, `PurchaseOrder` y los aggregates. **`Order` no tiene moneda.**

**Falta:** la representación en el wire (¿centavos enteros más moneda, o string decimal?), la política de redondeo y la moneda de cada documento. ADR-008 está decidido, pero **el código y el contrato no lo implementan** (ALTO, ya registrado en `ESTADO.md`).

## 10. Exportación (ADR-004)

**El frontend asume del servidor** `POST /{recurso}/export` → `202 {jobId}` y `GET /exports/{jobId}` → `{estado, progreso, downloadUrl}`. **Hoy no lo usa**: el job corre en el navegador (`exportJobs.ts:82-129`), pide las filas con `GET …/export` (15 endpoints, hasta 10.000 filas) y arma el archivo con `xlsx` en el cliente, con columnas definidas como funciones del cliente. Ver 01 C-1, C-2 y C-3, y 08#5.

## 11. Evidencia y uploads (ADR-005)

**Asume:** `POST /uploads/sign` → URL prefirmada → `PUT` directo al storage → id. Límites: 5 archivos, 10 MB, `image/jpeg|png|webp` y `application/pdf` (`uploads.service.ts:20-26`).
**Hoy:** `signUpload`/`confirmUpload` simulan el flujo **sin `httpClient`** (`:44,61`). El id se genera en el cliente (`` `evd-${Date.now()}-…` ``, `:47`). `confirmUpload` recibe el `File`. Los ids terminan en `DeliveryNote.evidenciaIds`, `Pod.firmaEvidenciaId` y `Pod.imagenesIds`.
**Falta:** el endpoint real, el bucket y su aislamiento por empresa, quién valida los límites (hoy solo el cliente), el ciclo de vida de los archivos huérfanos (subidos y nunca referenciados), y la validación server-side de `requiereEvidencia` (03, R-ENT-8).

## 12. Tiempo real y polling (ADR-003)

**Asume:** polling (sin WebSocket ni SSE), 30 s por defecto, pausado en segundo plano, sobre los **mismos** endpoints paginados.
**Hoy:** `useLiveQuery` en `LogisticsPage.tsx` (entregas) y `TripDetailPanel.tsx` (posición del viaje, `TRIP_LIVE_INTERVAL_MS` = 12 s, enmienda de ADR-003).
**Falta:** el endpoint de **ingesta** de posiciones GPS (la app del chofer). `getTripPosition` solo lee `posicionActual`, y nada la escribe. `getTripRoute` devuelve 5 puntos sintéticos (`trips.service.ts:782-790`). Falta también una política de carga para N clientes haciendo polling.

## 13. Alertas (ADR-007)

**Asume:** `GET /alerts/summary` + `GET /alerts?cursor`, leído/no leído **por usuario**, sin borrado.
**Hoy:** el summary y la página existen (`alerts.service.ts:39,60`). `leida` es **global** (`alert.types.ts:23`, `markAlertAsRead:75-84`). **Nada genera alertas**: es el seed estático de 15. "Transferencia retrasada" referencia una `Delivery` porque no existen transferencias.
**Falta:** el motor de generación (qué evento crea qué alerta, RF-NOT-001), el leído por usuario, la retención, y los dos hallazgos de `AUDIT_2026-09-30_iam.md` (el `useEffect` + `Promise.resolve()` en `AlertsBell.tsx:72-100`).

## 14. Numeración correlativa (ADR-014)

**Asume:** `createOrder` devuelve un `orderNumber` ya asignado, correlativo por empresa, sin huecos por rechazo, y que no se reutiliza.
**Hoy:** `Map<empresaId, number>` en memoria, sembrado con el máximo del seed (`orders.service.ts`, `nextOrderNumber`). Verificado: un rechazo no consume número (V17, `PED-000392 → 393`, `394 → 395`).
**Falta:** una secuencia atómica por empresa en la base (el ADR ya lo dice). Y **ningún otro documento tiene número**: remito, OC, recibo, factura y viaje usan solo el id interno.

## 15. Auditoría (audit-log)

**Hoy:** `AuditLogWidget.tsx` muestra `getRecentAuditLog` (`audit.service.ts:28-37`): `{id, timestamp, user, action, details}`, con `timestamp` en texto de display (`'Hace 5 min'`). **El store es una constante sembrada (`:20`), y ninguna mutación del sistema escribe ahí.** Existen historiales por entidad (`Order.history`, `Delivery.historial`, `Delivery.reprogramaciones`, `Trip.overrides`), pero son parciales: `advanceOrderStatus` y `cancelOrder` no escriben `history`, y `transitionTrip` no tiene historial (`void quien`).
**Falta:** qué mutaciones auditar, con qué forma (antes/después, actor de la sesión, IP), si es una tabla única o por entidad, la retención, y la relación con RF-AUD-001/002.
