# 05 — Lo que funciona solo porque es un mock

**Verificado contra el código el 2026-10-07.** Rutas relativas a `FrontEnd/src/`. Cada punto: qué hace hoy el mock, por qué no se puede trasladar al backend tal cual, y qué tiene que resolver el backend.

## 1. Estado en memoria del proceso del navegador

**Hoy:** 24 variables de módulo hacen de base de datos. Todo vuelve al seed con cada recarga, y cada pestaña tiene su propia copia.

| Store | Archivo:línea | Mutable |
|---|---|---|
| `ordersDTOStore`, `orderNumberCounters` | `orders.service.ts:79,265` | sí |
| `clientsStore` (en espacio de **dominio**, no DTO) | `clients.service.ts:58` | sí |
| `deliveriesStore`, `deliveryNotesStore` | `deliveries.service.ts:57,61` | sí |
| `tripsStore` | `trips.service.ts:37` | sí |
| `podsStore` | `pod.service.ts:15` | sí |
| `purchaseOrdersStore` | `services/mock/purchaseOrders.service.ts:51` | sí |
| `productsDTOStore` | `shared/api/products/products.service.ts:80` | sí |
| `suppliersDTOStore` | `suppliers.service.ts:46` | sí |
| `cashTransactionsDTOStore` | `cash.service.ts:66` | sí |
| `vehiclesStore`, `driversStore` | `vehicles.service.ts:18`, `drivers.service.ts:15` | sí |
| `alertsStore` | `alerts.service.ts:19` | sí |
| `permissionsDTOStore` | `users-roles.service.ts:43` | sí |
| `idempotencyStore` | `shared/utils/idempotency.ts:24` | sí, sin expiración |
| `stockDTOStore`, `movementsDTOStore`, `productHistoryDTOStore`, `suggestionsDTOStore` | `products.service.ts:86`, `movements.service.ts:31`, `product-history.service.ts:30`, `purchase-suggestions.service.ts:38` | **`const`: nadie los modifica** (el stock nunca se mueve, 03 R-INV-1) |
| `auditLogDTOStore`, `invoicesDTOStore`, `usersDTOStore`, `motivosStore` | `audit.service.ts:20`, `subscription.service.ts:27`, `users-roles.service.ts:36`, `motivos.service.ts:21` | `const` (sin ABM) |

También son estado de "servidor" en memoria: `overdueSnapshotCache` (`clients.service.ts:551-557`, se invalida **por igualdad de referencia** del array `clientsStore`), `jobs` (`exportJobs.ts:82`) y el contador de uploads (`uploads.service.ts`).

**El backend tiene que resolver:** persistencia real. Además, **dos dependencias de la forma del store**:
- La invalidación del caché de morosos depende de que **cada mutación reemplace el array** (`clientsStore = [...]`). En una base de datos no existe esa señal: el caché necesita invalidación explícita, o no tener caché.
- `deliveryNotesStore` y `podsStore` arrancan vacíos: **no hay datos de prueba** para remitos ni POD.

## 2. Atomicidad gratis por ser de un solo hilo

**Hoy:** JavaScript no intercala dos resolvers a mitad de una lectura-modificación-escritura. Por eso funcionan "sin carrera":
- El correlativo de pedidos: lectura, incremento y escritura sobre `orderNumberCounters`. ADR-014 lo reconoce.
- `withIdempotency`: el chequeo `has` y después el `set` (`idempotency.ts:30-35`).
- `version === expectedVersion` y después la escritura (`trips.service.ts:331-390`).
- Unicidad de SKU, código de barras, CUIT y patente: "¿existe? → insertar" (`products.service.ts:104-111`, `vehicles.service.ts:127-129`).
- `cancelOrder`: "¿hay entregas activas? → cancelar" (`orders.service.ts:461-473`).
- `assignDeliveriesToStop`: "¿la entrega está en otro viaje? → asignar" (`trips.service.ts:351-363`).

**El backend tiene que resolver:** secuencias atómicas, restricciones `UNIQUE` (por empresa), `SELECT … FOR UPDATE` o versionado en el `UPDATE … WHERE version = ?`, y un almacén de idempotencia con inserción atómica. Ninguna de estas garantías está en el contrato hoy. El mock las da por gratis.

## 3. Recorridos de colección completa

**Hoy:** cada listado filtra el array entero y después corta la página. Es correcto como simulación, pero el backend no puede llamar a otro endpoint para hacer un join. Los casos que **no** son "filtrá y cortá":
- **ADR-016 (deuda declarada):** `fetchProducts` (catálogo completo vía `httpClient`) dentro de `getPurchaseSuggestionsPage`/`exportPurchaseSuggestions` (`purchase-suggestions.service.ts:19-21,65,94`), `createOrder` (`orders.service.ts`, bloque `fetchProducts`) y `hasInactiveProduct` (`purchaseOrders.service.ts:28-32`). Además, `createOrder` valida el cliente con `getClientById` vía `httpClient` anidado.
- `getOrdersSnapshotForAggregation` (`orders.service.ts:488-496`) proyecta **todos** los pedidos para el tablero, y `getOrderBranchLinksForAggregation` (`deliveries.service.ts`) **todas** las relaciones pedido-sucursal (ADR-009).
- `computeOverdueSnapshot(clientsStore)` recorre todos los clientes y todas sus transacciones con FIFO (`clients.service.ts:556`).
- Los aggregates de compras (`purchaseOrders.service.ts:130-149`) recalculan `computePurchaseOrderTotal` de **cada** OC en cada página.
- `getDeliveryIdsMatchingFilter` (modo filtro de asignación, ADR-011 §1) materializa todos los ids que cumplen el filtro antes de contarlos contra el techo de 100.
- `findTripContainingDelivery` recorre todos los viajes por cada entrega candidata (`trips.service.ts:354`).

**El backend tiene que resolver:** joins y agregaciones en SQL. Para la relación pedido-sucursal (que hoy se deriva de `Delivery`), definir si se materializa (08#9). Los aggregates de antigüedad de deuda se vuelven una consulta pesada si no hay modelo de cuenta corriente.

## 4. `Date.now()`, relojes y aleatoriedad

**Hoy:**
- **21 usos de `Date.now()` en 12 archivos** generan ids (`` `ord-${Date.now()}` ``, `` `del-${Date.now()}` ``, `` `remito-${Date.now()}` ``, `` `trip-${Date.now()}` ``, `` `pod-${Date.now()}` ``, `` `ctx-${Date.now()}` ``, `` `inv-${Date.now()}` ``, `` `cli-${Date.now()}` ``, `` `evd-${Date.now()}-n` ``). Dos altas en el mismo milisegundo colisionan, salvo donde se agrega un índice.
- Fechas de seed **relativas a hoy**: `clients.data.ts` (4 `new Date(`, `dueIn(-2)`), `logistics.data.ts` (3), `trips.data.ts:26` (`TODAY_ISO`), `purchaseOrders.data.ts` (1). Los datos de prueba cambian con el día de ejecución, y los aggregates de mora también.
- Timestamps que **pone el cliente**: `CashTransaction.time` (lo manda el formulario), `Pod.timestampDispositivo` (correcto: es la hora del dispositivo, y el servidor agrega `timestampServidor`, `pod.service.ts:51`), `ReprogramDeliveryInput.fechaNueva`.
- `Math.random()`: solo en `httpClient.ts:150` (falla simulada) y `useEvidenceUpload.ts:64` (id local de UI, inocuo).

**El backend tiene que resolver:** ids generados por el servidor (y su formato, porque los branded types validan **prefijos**: `/^ord-/`, `ids.types.ts:61-72`; un UUID sin prefijo rompe `asOrderId` → 08#3), la hora del servidor para todo timestamp de negocio, y una zona horaria definida (AUDIT_11). El seed de pruebas tiene que ser determinístico.

## 5. Agregados y montos calculados en el cliente

| Qué | Dónde | Problema |
|---|---|---|
| Subtotal, descuento, IVA 21% y total del pedido | `CreateOrderModal.tsx` (`useMemo`) | el servidor los persiste sin recalcular (03, R-PED-4) |
| Total de una OC | `computePurchaseOrderTotal` en 6 componentes | float; aceptable como cálculo por fila, pero la regla vive en el cliente |
| Total vencido por moneda del tablero | `getOverdueTotalsInMoney` (`dashboardAggregates.service.ts:92-107`) | suma los buckets que devuelve el servidor, en el cliente |
| `cantidadPendiente` | `derivePendingQuantity` (`shared/utils/orderFulfillment.ts`) | correcto según ADR-001 (derivado), pero tiene que ser **la misma** regla en el servidor (R-ENT-7) |
| Capacidad usada y sobrecarga del viaje | `computeCapacidadUsada`/`excedeCapacidad` (`trips.service.ts`) | ya es server-side en el mock; el backend tiene que preservarla (ADR-011 §2) |

## 6. Datos de display denormalizados (snapshots y texto)

| Dato | Dónde | Qué decidir |
|---|---|---|
| `Order.clientName/clientAddress/clientZone` | `order.types.ts:71-73` | ¿snapshot congelado al confirmar (Doc 03 §17.28, "Snapshot comercial")? Hoy se copia en el alta |
| `OrderItem.name` (+ `sku` sin `productId`) | `order.types.ts:58-59` | la FK por SKU es frágil (un SKU se puede editar, `updateProduct:126`) |
| `Delivery.clientName/address`, `Stop.clientName/address` | `logistics.types.ts:77-78`, `trip.types.ts:48-49` | parada sin `clientId`: no se pueden aplicar las `preferenciasEntrega` del cliente |
| `PurchaseSuggestion.supplierName`, `InventoryMovement.productName`, `ProductHistoryEvent.productName` | `inventory.types.ts` | FK implícitas por nombre o SKU |
| Actores como texto (`quien`, `creadoPor`, `responsable`, `user`, `sellerName`) | 9 tipos | no hay `userId`: el nombre del usuario es la FK |
| `KpiMetric.value: string` ya formateado | `dashboard.types.ts:8` | formateo hecho en el "servidor" |
| `AuditLogItem.timestamp = 'Hace 5 min'` | `settings.data.ts` | texto relativo en vez de fecha |
| `InvoiceRecord.date = '01/06/2026'` | `settings.data.ts` | `dd/MM/yyyy` en vez de ISO |
| `CashTransaction.time = '08:45:00'` sin fecha | `cash.data.ts` | un movimiento de caja sin día |
| Derivados persistidos: `ClientAccount.currentBalance/status/daysOverdue/totalDebit/totalCredit`, `ClientTransaction.balance`, `Supplier.pendingOrdersCount/currentBalance/hasOverdueDebt`, `OrderItem.subtotal`, `DeliveryNoteLine.cantidadOfrecida`, `Trip.capacidadUsada/sobrecargado` | 02 | ¿se calculan o se materializan con trigger? Hoy algunos (clientes, proveedores) **nunca se recalculan** |

## 7. Seeds con referencias rotas o incoherentes

| Caso | Estado al 2026-10-07 |
|---|---|
| 5 líneas de pedido con SKUs inexistentes (`YER-TAR-1K`, `GAL-SUR-200`) | **Corregido en la Tanda 20** (`69ac78a`, en `lean`). V17 D2.3 da OK |
| Los mismos SKUs en `analytics.data.ts:25-26,54-55,84-85,121-122` | vigente (`PENDIENTES.md` #20) |
| `alerts.data.ts:21,23`: `productName` que no corresponde al `productId` (`alr-005` → `inv-013` Papel Higiénico, dice "Yerba Taragui") | vigente (#20) |
| `suppliers.data.ts:44,64`: el catálogo del proveedor con SKUs que no están en el catálogo propio | vigente (#20), quizás legítimo |
| `inventory.data.ts:68`: `inv-019` con `supplierId: 'sup-999'`, que no existe | vigente, a propósito ("Producto Descontinuado", `PENDIENTES.md` #14) |
| `PENDING_VOUCHERS_MOCK` (`cash.data.ts`) | sin consumidor |
| `dashboard.data.ts` y `analytics.data.ts` | datasets estáticos sin relación con pedidos, clientes ni caja reales: los números del tablero viejo y de la analítica **no salen de los datos** |

**El backend tiene que resolver:** FKs reales (las implícitas de 02 pasan a ser explícitas), un seed de desarrollo que pase la integridad referencial (los scripts `scripts/verificacion/v*.mjs` sirven como especificación), y la decisión de qué hacer con los datasets estáticos (tablero viejo y analítica).

## 8. "Servidor" que corre en el navegador

| Qué | Dónde | Por qué no se hereda |
|---|---|---|
| Jobs de exportación + generación del XLSX/CSV | `exportJobs.ts`, `buildExportFile.ts` | ADR-004 lo pone en el servidor; hoy el archivo se arma en el cliente con columnas que son funciones del cliente (01 C-1) |
| URLs firmadas e ids de evidencia | `uploads.service.ts:44-61` | el id lo genera el cliente |
| Sesión | `session.service.ts:17` | sin autenticación |
| Estado "reposición solicitada" | `useReplenishmentStore.ts:29-49` | estado de negocio que solo existe en la pestaña |
| Matriz de transiciones devuelta como `allowedTransitions` | `computeAllowedTransitions` (`deliveryStatus.types.ts:56`), `computeAllowedTripTransitions` (`tripStatus.types.ts:45`) | ADR-010 la pone en el contrato de lectura; los motivos son textos en español escritos en el cliente |

## 9. Requests anidados dentro de un resolver

**Hoy:** varios resolvers mock llaman a otra función que **vuelve a pasar por `httpClient`**:
- `createOrder` llama a `getClientById` y `fetchProducts`.
- `reprogramDelivery` y `registrarEntrega` llaman a `getMotivoCatalog`.
- `createDelivery` llama a `getOrderById`.
- `markStopNoVisitada` llama a `reprogramDelivery` × N.
- `registerPod` llama a `transitionDelivery`.
- La deuda de ADR-016.

Cada llamada anidada suma `VITE_MOCK_LATENCY_MS` (300 ms por defecto) y una oportunidad de falla simulada, y **se reintenta por su cuenta** dentro de otro request que también se reintenta.

**El backend tiene que resolver:** llamadas internas a servicios de dominio (no HTTP) dentro de la misma transacción. El contrato público no debería exponer endpoints que solo existen para que otro endpoint los llame.
