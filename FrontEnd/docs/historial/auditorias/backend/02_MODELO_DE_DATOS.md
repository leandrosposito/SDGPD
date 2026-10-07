# 02 — Modelo de datos: inventario de lo que hay

**Verificado contra el código el 2026-10-07.** Fuente: `FrontEnd/src/shared/types/` (22 archivos) y `FrontEnd/src/data/mock/` (17 archivos). Es un **inventario, no un diseño de tablas**. Las rutas son relativas a `FrontEnd/src/`.

## Convenciones de este documento

- **Id tipado** = branded type de ADR-006 (`ids.types.ts:44-59`, 12 tipos: `OrderId`, `BranchId`, `OrderLineId`, `ClientId`, `DeliveryId`, `DeliveryNoteId`, `DeliveryHistoryEventId`, `VehicleId`, `DriverId`, `TripId`, `StopId`, `PodId`). Cada uno se valida **por prefijo** (`/^ord-/`, `/^cli-/`…, `:61-72`). **"string suelto"** = id sin brand.
- **FK explícita** = el campo guarda el id del otro. **FK implícita** = la relación se resuelve por nombre, SKU, código o texto, sin id.
- **Dinero:** ADR-008 pide enteros en centavos con moneda. **Ninguna entidad persistida cumple**: todo importe es `number` en pesos con decimales. El tipo `Money` (`shared/utils/money.ts`) solo lo usa el tablero (`modules/dashboard/`), y lo calcula desde floats con `moneyFromNumber`.
- **Alcance:** EMPRESA o SUCURSAL según `PROTOCOLO.md` §1. **Ninguna entidad de negocio tiene `empresaId`, salvo `Trip`** (`trip.types.ts:92`). `Company` (`session.types.ts:24`) tampoco se relaciona con `Branch`.

---

## Organización y acceso

### Company — `session.types.ts:24`
`id: string` (suelto), `name: string`. Solo existe dentro de `SessionUser.company`. Mock: `session.mock.ts` (una sola empresa, `company-001`). No tiene entidad propia, ni endpoint, ni datos fiscales (RF-ORG-001).

### Branch (sucursal) — `session.types.ts:15`
`id: BranchId` (tipado), `name`, `code`, `city`, `address`, `status: 'active'|'inactive'`. Alcance: empresa (de forma implícita, por estar en la sesión). Mock: `session.mock.ts`, 4 sucursales (`branch-004` inactiva a propósito, ver `DECISIONES_TECNICAS_LOG.md`). **No hay depósito**: Doc 02 §10.22 modela "Depósito 1—N Existencia", y el código usa la sucursal como depósito. Sin endpoint: llega solo dentro de la sesión.

### SessionUser — `session.types.ts:29`
`id: string` (suelto), `fullName`, `email`, `company: Company`, `branches: Branch[]`, `defaultBranchId: BranchId`. **No tiene rol ni permisos** (ver 04 §Auth). Mock: `session.mock.ts`.

### UserAccount — `settings.types.ts:7`
`id: string` (suelto), `name`, `email`, `role: SystemRole` (`'Admin'|'Vendedor'|'Chofer'|'Deposito'`), `status: 'active'|'inactive'`. Mock: `settings.data.ts` (`SETTINGS_MOCK_USERS`). **Es un segundo modelo de usuario, desconectado de `SessionUser`**: no comparten id ni campos, y el usuario de la sesión no figura en esta lista con su rol. Hay **actores guardados como texto** en todo el sistema (`quien`, `creadoPor`, `responsable`, `user`, `sellerName`): son FK implícitas a un usuario, por nombre.

### PermissionMatrix — `settings.types.ts:15`
`role: SystemRole` (FK implícita por nombre de rol) y `modules: {dashboard, pedidos, inventario, clientes, proveedores, logistica, caja, analitica}: boolean`. Son **8 módulos de 10**: faltan `compras` y `settings`. La granularidad es de módulo, no de acción. Mock: `SETTINGS_MOCK_PERMISSIONS`. Nadie la consulta para autorizar nada (04 §Permisos).

### AuditLogItem — `settings.types.ts:29`
`id`, `timestamp: string`, `user: string` (texto), `action`, `details`. **`timestamp` guarda texto de display** (`'Hace 5 min'`, `settings.data.ts`), no una fecha. Mock: `SETTINGS_MOCK_AUDIT`. Append-only por naturaleza, pero **ninguna mutación escribe acá** (04 §Auditoría).

### InvoiceRecord (suscripción SaaS) — `settings.types.ts:37`
`id`, `date: string` (**formato `dd/MM/yyyy`**, `settings.data.ts`), `amount: number` (float), `status: 'paid'|'pending'`, `plan: string`. Es la facturación **de la plataforma a la empresa cliente**, no facturación de venta. Mock: `SETTINGS_MOCK_INVOICES`.

---

## Comercial

### ClientAccount (cliente + cuenta corriente) — `client.types.ts:51`
- **Id y alcance:** `id: ClientId` (tipado). Alcance empresa.
- **Campos maestros (obligatorios):** `clientName`, `cuit`, `address`, `phone`, `zone`, `sellerName`, `creditLimit` (dinero, float), `priceList`, `saleCondition`, y los 10 campos que se agregaron en la Tanda 16: `tradeName`, `ivaCondition`, `email`, `googleMapsLink`, `deliveryAddressSameAsFiscal`, `deliveryAddress`, `deliveryReferences`, `businessCategory`, `notes`, `isActive`.
- **FK implícitas:**
  - `zone`: texto libre. Pero `Delivery.zone` es la unión `'Norte'|'Centro'|'Sur'` (`logistics.types.ts:82`).
  - `sellerName`: texto, en vez de una referencia a `UserAccount`.
  - `priceList`/`saleCondition`: texto, sin entidad de lista de precios (RF-PRI-001).
  - `ivaCondition`/`businessCategory`: texto, sin enum.
- **Campos derivados que hoy se persisten** (no deberían): `totalDebit`, `totalCredit`, `currentBalance`, `daysOverdue`, `status: 'Al dia'|'Con Deuda'`. Salen de `transactions`.
- **Composición embebida:** `transactions: ClientTransaction[]` (`:46`), unión discriminada por `type: 'invoice'|'payment'|'adjustment'`. Campos: `id` (suelto), `date`, `description`, `debit`, `credit`, `balance` (**saldo acumulado persistido**, derivado), `currency: 'ARS'|'USD'`. `invoice` agrega `dueDate`.
  - **Ninguna transacción referencia un pedido, un remito ni una factura de venta.** El vínculo pedido→deuda no existe.
- **Unicidad:** `cuit` **no** es único (ni en la UI ni en el servidor). Para proveedores sí lo es.
- **Datos del mock:** `clients.data.ts`, 30 clientes. **Las fechas de las transacciones son relativas a hoy** (`dueIn(-2)`, `new Date()`), así que el seed cambia con el día de ejecución.

**Proyecciones derivadas, que no se persisten:** `OpenInvoice` (`:114`, FIFO de pagos sobre facturas), `OverdueClientRow` (`:166`), `AgingBucketAggregate`/`OverdueClientsAggregates` (`:183-192`). Las calcula el mock en `clients.service.ts`, con un caché por referencia del store (`overdueSnapshotCache`, `:551-557`).

### Order (pedido de venta) — `order.types.ts:66`
- **Id y alcance:** `id: OrderId` (tipado). `orderNumber: string` (correlativo `PED-XXXXXX`, ADR-014). **Sin `branchId` ni `empresaId`**: la relación con la sucursal se deriva vía `Delivery` (ADR-009).
- **Campos:** `date` (ISO datetime), `clientId: ClientId` (**FK explícita**).
- **Snapshot denormalizado del cliente:** `clientName`, `clientAddress` (dirección **fiscal**, ver `PENDIENTES.md` #16), `clientZone`.
- **`sellerName`:** texto, FK implícita a un usuario.
- **Dos estados conviviendo:**
  - `status: OrderStatus` (legado, comentado como "deprecado" en `:75`): `pending→preparing→dispatched→delivered→invoiced`, más `cancelled`. Transiciones en `ORDER_STATUS_FLOW` (`orders.service.ts:383-388`): avance lineal; `cancelled` desde cualquier estado salvo `delivered`/`invoiced`/`cancelled` (`:447`).
  - `comercial: OrderComercialStatus` (`'Borrador'|'Confirmado'|'Cancelado'`, ADR-010 §1). **No hay máquina de transiciones para `comercial`**: solo `cancelOrder` lo escribe (`:472`) y `createOrder` lo fija en `'Confirmado'`.
  - Los ejes logístico y financiero de ADR-010 no existen como campo: se derivan (`shared/utils/orderLogistics.ts`, `orderFulfillment.ts`).
- **`source: 'mobile'|'manual'`, `paymentMethod`:** uniones.
- **Dinero:** `subtotal`, `discount`, `tax`, `totalAmount` (floats). **Los manda el cliente y el servidor no los recalcula** (03, R-PED-4).
- **`notes`.**
- **`items: OrderItem[]`** (`:56`): `id: OrderLineId` (tipado), `sku` (**FK implícita por SKU** a `InventoryItem`, no hay `productId`), `name` (snapshot), `quantity`, `unitPrice` (float), `subtotal` (derivado, persistido), `cantidadEntregada` (ADR-001, acumulado). **`cantidadPendiente` no se persiste** (derivado, ADR-001).
- **`history: OrderHistoryEvent[]`** (`:42`): `id` (suelto), `date`, `status`, `description`. Append-only, **pero solo `createOrder` escribe**: `advanceOrderStatus`/`cancelOrder` no agregan eventos (`orders.service.ts:425,471`).
- **Datos del mock:** `orders.data.ts`, 6 pedidos. Desde la Tanda 20 todos los SKUs resuelven (V17 D2.3).

### Supplier (proveedor) — `supplier.types.ts:14`
- **Id y alcance:** `id: string` (**suelto**). Alcance empresa.
- **Campos:** `name`, `cuit` (único, `suppliers.service.ts:203,243`), `phone`, `contactName`, `contactEmail`, `address`, `city`, `paymentTerms` (texto), `category` (texto).
- **Derivados persistidos:** `pendingOrdersCount`, `daysUntilExpiration: number|null`, `currentBalance` (float), `hasOverdueDebt`. Ninguno se recalcula a partir de las OC.
- **`products: SupplierProduct[]`** (`:5`): `id`, `sku` (FK implícita **por SKU**, y hay SKUs que no existen en el catálogo, ver `PENDIENTES.md` #20), `name`, `category`, `cost` (float), `lastUpdate`. Es una lista de precios del proveedor embebida (RF-PRD-002).
- **Datos del mock:** `suppliers.data.ts`, 3 proveedores.

### PurchaseOrder (orden de compra) — `purchaseOrder.types.ts:42`
- **Id y alcance:** `id: string` (suelto). `branchId` = la sucursal **de destino**: alcance sucursal en los hechos, aunque el protocolo pone a compras en EMPRESA.
- **FK:** `supplierId: Supplier['id']` (FK explícita, no tipada).
- **Campos:** `currency: 'ARS'|'USD'`, `status`, `createdAt` (ISO).
- **Estados:** `draft→sent→received`, `draft|sent→cancelled` (`VALID_TRANSITIONS`, `purchaseOrders.service.ts:303-308`). **No hay estado "Parcial"** (RF-CMP-002, ver 07).
- **`lines: PurchaseOrderLine[]`** (`:30`): `id` (suelto), `productId: InventoryItem['id']` (FK explícita, no tipada), `quantity`, `unitPrice` (float). **No hay cantidad recibida por línea.**
- **Total:** no se persiste. Se calcula con `computePurchaseOrderTotal` (`purchaseOrders.service.ts:60`), que **también usan 6 componentes**.
- **Datos del mock:** `purchaseOrders.data.ts`, con generación determinística (`:131`, sin `Math.random`) y una fecha relativa (`new Date(`).

### PurchaseSuggestion — `inventory.types.ts:101`
- **Campos:** `id` (suelto), `productId` (FK explícita), `sku` y `productName` (snapshot), `supplierName` (**FK implícita por nombre**, sin `supplierId`), `branchId` (sucursal), `currentStock`, `minStock`, `suggestedQuantity`, `estimatedCost` (float).
- **Es una proyección derivada** de stock contra mínimo, pero el mock la **persiste como dataset** (`inventory.data.ts`, `suggestions`). No se recalcula cuando cambia el stock.
- **Estado "solicitado":** vive **solo en el navegador** (`useReplenishmentStore.ts:29-49`, `ReplenishmentStatus`). Se indexa por `productId` **sin sucursal** y se pierde al recargar.

---

## Inventario

### InventoryItem (producto) — `inventory.types.ts:39`
- **Id y alcance:** `id: string` (**suelto**, prefijo `inv-`). Alcance empresa (transversal).
- **Campos:** `sku` (único, case-insensitive, `products.service.ts:104`), `barcode` (EAN-13, único en el servidor; el dígito verificador solo lo valida la UI), `name`, `description?`.
- **FK implícitas:** `category` (texto, sin árbol, RF-CAT-001) y `unitOfMeasure` (texto, sin conversión, RF-PRD-004).
- **`status: 'active'|'inactive'`:** baja lógica (`deleteProduct`, `:170`).
- **`supplierId: Supplier['id']`:** FK explícita, **un solo proveedor por producto**. El seed tiene `inv-019` con `sup-999`, que no existe.
- **Dinero:** `cost`, `price` (floats).
- **Márgenes:** `wholesaleMargin?`, `distributorMargin?`, `retailMargin?`. Son porcentajes, pero **los precios por margen no se derivan**: el precio por lista no existe como entidad.
- **`lots?: ProductLot[]`** (`:8`, embebido): `id` (suelto), `lotNumber`, `quantity`, `expirationDate` (ISO). **Los lotes viven en el producto (alcance empresa), no por sucursal** (`PENDIENTES.md` #9). La suma de lotes no se concilia con `ProductStock.stock`.
- **Datos del mock:** `inventory.data.ts` (`items`, 19 productos).

### ProductStock — `inventory.types.ts:21`
`productId` (FK explícita), `branchId` (sucursal), `stock`, `minStock`. La clave natural es (producto, sucursal). **No hay reservado ni comprometido** (RF-INV-007). Mock: `productStock.data.ts`. **Ninguna operación lo modifica** (03, R-INV-1). `StockedInventoryItem = InventoryItem & ProductStock` (`:33`) es una proyección.

### InventoryMovement (kardex) — `inventory.types.ts:89`
`id` (suelto), `date` (ISO), `sku` + `productName` (**FK implícita por SKU**, sin `productId`), `type: 'in'|'out'|'adjustment'`, `quantity`, `user` (texto), `notes`, `branchId`. Append-only por naturaleza. **No referencia el documento de origen** (pedido, remito, OC), que RF-INV-003 sí pide. Mock: `inventory.data.ts` (`movements`). **Ninguna operación escribe movimientos.**

### ProductHistoryEvent — `inventory.types.ts:72`
`id`, `date`, `sku` + `productName` (FK implícita), `eventType: string` (texto libre, sin enum), `description`, `user` (texto), `branchId`. Mock: `inventory.data.ts` (`history`). Nadie lo escribe.

---

## Logística

### Delivery (entrega) — `logistics.types.ts:73`
- **Id y alcance:** `id: DeliveryId` (tipado). `branchId` = sucursal (alcance sucursal).
- **FK:** `orderId: OrderId` (FK explícita).
- **Snapshot del pedido:** `clientName`, `address`. **No tiene `clientId`**: el cliente se alcanza solo vía el pedido.
- **Fechas:** `date` (`yyyy-MM-dd`), `estimatedTime` (texto, por ejemplo `"09:00 - 11:00"`).
- **`status: DeliveryStatus`:** transiciones en `DELIVERY_TRANSITIONS` (`deliveryStatus.types.ts:23-29`): `CREADO→EN_TRANSITO|CANCELADO|REPROGRAMADO`, `EN_TRANSITO→FINALIZADO|REPROGRAMADO|CANCELADO`, `REPROGRAMADO→CREADO`. `FINALIZADO` y `CANCELADO` son terminales.
- **Uniones:** `zone: 'Norte'|'Centro'|'Sur'`, `priority: 'high'|'medium'|'low'`.
- **`collectionAmount: number`:** dinero, float. **Lo carga el usuario** (`CreateDeliveryInput`), no se deriva del total del pedido.
- **`historial: DeliveryHistoryEvent[]`** (`:21`, append-only): `id: DeliveryHistoryEventId`, `desde|null`, `hasta`, `quien` (texto), `cuando` (ISO).
- **`reprogramaciones: ReprogramacionEvent[]`** (`:43`, append-only): `fechaAnterior`/`fechaNueva` (`yyyy-MM-dd`), `motivo` (texto resuelto), `motivoCodigo?` (FK implícita por código a `MotivoCatalogItem`), `responsable` (texto), `timestamp`, `tripId?`/`stopId?` (Tanda 13).
- **Derivado, no se persiste:** `allowedTransitions?` (`:92`).
- **Datos del mock:** `logistics.data.ts`, 18 entregas, con fechas relativas a hoy.

### DeliveryNote (remito) — `deliveryNote.types.ts:46`
- **Id:** `id: DeliveryNoteId` (tipado).
- **FK:** `orderId` y `deliveryId` (FK explícitas, tipadas; `orderId` es redundante con `deliveryId`).
- **Campos:** `fecha`, `creadoEn` (ISO), `creadoPor` (texto), `evidenciaIds: string[]` (FK a un storage externo, ADR-005).
- **`lines: DeliveryNoteLine[]`** (`:19`): `orderLineId: OrderLineId` (FK explícita), `cantidadOfrecida` (derivada: entregada + rechazada, pero se persiste), `cantidadEntregada`, `cantidadRechazada`, `motivoCodigo?` (FK implícita por código), `motivoRechazo?` (texto resuelto), `cantidadEnTransitoDeRetorno?`.
- **Append-only:** sí (ADR-001). **Sin seed**: `deliveryNotesStore` arranca vacío, y **no hay endpoint para leerlo** (01, `getDeliveryNotesForDelivery`).

### Trip (viaje) — `trip.types.ts:87`
- **Id y alcance:** `id: TripId` (tipado). **`empresaId: string` (la única entidad con tenant explícito)**. `branchId` (sucursal).
- **FK:** `vehicleId`, `driverId` (FK explícitas, tipadas).
- **`fecha`:** `yyyy-MM-dd`.
- **`estado: TripStatus`:** `TRIP_TRANSITIONS` (`tripStatus.types.ts:20-26`): `Planificado→Despachado|Cancelado`, `Despachado→EnTransito|Cancelado`, `EnTransito→Rendido`. `Rendido` y `Cancelado` son terminales.
- **`version: number`:** concurrencia optimista. **Solo `assignDeliveriesToStop` la chequea.**
- **Derivados persistidos:** `capacidadUsada: VehicleCapacity` y `sobrecargado` (se recalculan en cada mutación).
- **`overrides: CapacityOverrideEvent[]`** (append-only): `quien` (texto), `cuando`, `motivo`, `deltaBultos`.
- **`posicionActual?: TripPosition`:** `lat`, `lng`, `timestampDispositivo`, `timestampServidor`, `precision?`.
- **Otros:** `createdAt`, `updatedAt`. `allowedTransitions?` (derivado).
- **`paradas: Stop[]`** (embebidas, `:44`): `id: StopId`, `tripId` (FK), `orden`, `clientName` y `address` (**texto, sin `clientId`**), `deliveryIds: DeliveryId[]` (FK explícitas, N:M de hecho), `estado: StopStatus` (`'Pendiente'|'Visitada'|'NoVisitada'|'Reprogramada'`; **sin máquina de transiciones declarada**: las reglas están repartidas en `registerPod`/`markStopNoVisitada`, ver 03), `preferenciasEntrega?` (ventana horaria y días).
- **Datos del mock:** `trips.data.ts`, con fecha `TODAY_ISO` (relativa a hoy).

### Pod (prueba de entrega) — `pod.types.ts:26`
`id: PodId`, `deliveryId`, `stopId` (FK tipadas), `receptor: {nombre, documento?, contactId?}`, `firmaEvidenciaId?` y `imagenesIds` (storage), `ubicacion?`, `observaciones?`, `timestampDispositivo`, `timestampServidor`, `creadoPor` (texto). Append-only. Sin seed (`pod.service.ts:15`). **No tiene archivo de mock.**

### Vehicle — `vehicle.types.ts:29`
`id: VehicleId`, `patente` (única normalizada, `vehicles.service.ts:113`), `tipo` (texto), `capacidad: {bultos, pesoKg, volumenM3, refrigerado, zonasHabilitadas: string[]}`, `activo`. Alcance empresa (decisión de la Tanda 10B sin ADR, comentada en `vehicle.types.ts`). Mock: `vehicles.data.ts` (4).

### Driver — `driver.types.ts:8`
`id: DriverId`, `nombre`, `licencia`, `telefono`, `activo`. **No está vinculado a `UserAccount`**, aunque existe el rol `'Chofer'`. Mock: `drivers.data.ts` (3).

### MotivoCatalogItem — `motivo.types.ts:29`
`codigo: string` (clave natural; **no es única sola**: `'OTRO'` se repite en los 3 tipos, así que la clave es (`tipo`, `codigo`)), `tipo: 'rechazo'|'reprogramacion'|'no-entrega'`, `descripcion`, `activo`, `requiereEvidencia`, `disparaLogisticaInversa`. ADR-010 §5 lo pide configurable por empresa, pero **no hay ABM**. Mock: `motivos.data.ts`.

---

## Caja

### CashTransaction / CashRegister — `cash.types.ts:22,46`
- **CashTransaction:** `id` (suelto, `ctx-${Date.now()}`), `time: string` (**solo la hora `'08:45:00'`, sin fecha**), `type: 'income'|'expense'`, `category: TransactionCategory` (14 valores que mezclan inglés y español: `'collection'` y `'cobro'`, `'advance'` y `'anticipo_ingreso'`; `cash.types.ts:6-20`), `entity?` (**FK implícita por nombre** a cliente o proveedor), `linkedVoucher?` (**FK implícita por número de comprobante**, texto), `description`, `amount` (float).
- **CashRegister:** `date`, `initialBalance`, `totalIncome`, `totalExpense`, `currentBalance` (derivados), `expenseAnalysis` (derivado), `transactions`. **No existe la entidad Caja** (apertura, cierre, arqueo; RF-TES-002/004) ni un vínculo con sucursal.
- **Mock:** `cash.data.ts` (`CASH_MOCK_DATA`, más `PENDING_VOUCHERS_MOCK`, que **ningún archivo usa**).

---

## Alertas

### Alert — `alert.types.ts:41`
Unión discriminada por `tipo`:
- `'transferencia-retrasada'`: `deliveryId: string` (FK **no tipada**), `branchDestino: string` (texto), `diasRetraso`.
- `'producto-por-vencer'`: `productId`, `productName` (snapshot, y **en el seed no coincide con el producto**, `alerts.data.ts:21,23`), `branchId: string`, `diasParaVencer`.
- Base común: `id`, `severidad`, `creadoEn` (ISO), **`leida: boolean` global, no por usuario** (ADR-007 lo pide por usuario).

**No existe el concepto "transferencia"** entre sucursales (RF-INV-004): la alerta referencia una `Delivery`. Mock: `alerts.data.ts` (15). **Nada genera alertas.**

---

## Proyecciones de solo lectura (no son entidades)

| Tipo | Archivo | Qué es |
|---|---|---|
| `DashboardData`, `KpiMetric`, `SalesDataPoint`, `TopProduct`, `RecentOrder` | `dashboard.types.ts` | Dataset estático (`dashboard.data.ts`). `KpiMetric.value` es un **string ya formateado** (`:8`). `RecentOrder.status` es una copia de `OrderStatus` **sin `'invoiced'`** (`:39`) |
| `AnalyticsPeriodData`, `KpiData`, `TopProduct` (otro), `TopDebtor` | `analytics.types.ts` | Dataset estático por período (`analytics.data.ts`), leído directo por la página. `TopProduct` **está definido dos veces con formas distintas** (`dashboard.types.ts:24` contra `analytics.types.ts:19`) |
| `OpenInvoice`, `OverdueClientRow`, aggregates | `client.types.ts` | Ver ClientAccount |
| `PurchaseOrdersAggregates`, `StockAggregates`, etc. | varios | Aggregates de listados, calculados por el servidor |

## Excluidos del inventario de entidades (V2), con motivo

| Archivo | Motivo |
|---|---|
| `shared/types/ids.types.ts` | Define los ids tipados y sus constructores, no una entidad. Citado en "Convenciones" |
| `shared/types/pagination.types.ts` | Contrato de transporte (`PageQuery`, `PageResult`, `ExportResult`, `MAX_EXPORT_ROWS`). Va en 01 y 04 |
| `shared/types/deliveryStatus.types.ts` | Máquina de estados de `Delivery`. Integrada arriba, en Delivery |
| `shared/types/tripStatus.types.ts` | Máquina de estados de `Trip`. Integrada arriba, en Trip |

Los 18 archivos de tipos restantes y los 17 archivos de `data/mock/` aparecen en alguna sección de arriba (V2 lo verifica, ver `00_RESUMEN.md`).

### Tipos auxiliares: cubiertos dentro de otra entidad, o tipos de contrato (no son entidades)

| Tipo | Archivo | Dónde está cubierto |
|---|---|---|
| `ClientInvoiceTransaction`, `ClientPaymentTransaction`, `ClientAdjustmentTransaction` | `client.types.ts:33-44` | las 3 variantes de `ClientTransaction` (sección ClientAccount) |
| `OverdueAmountByCurrency` | `client.types.ts:146` | componente de `OverdueClientRow` (proyección) |
| `OverdueClientsQueryFilters`, `PurchaseOrdersQueryFilters` | `client.types.ts:130`, `purchaseOrder.types.ts:74` | filtros de listado → `04_TRANSVERSALES.md` §7 |
| `PurchaseOrderStatusAggregate` | `purchaseOrder.types.ts:91` | aggregate de listado (tabla de proyecciones) |
| `CreatePurchaseOrderInput`, `CreatePurchaseOrderResult`, `PurchaseOrderTransitionResult`, `GeneratePurchaseOrderFromSuggestionInput`, `GeneratePurchaseOrderResult` | `purchaseOrder.types.ts:117-176` | payloads y respuestas de mutación → `01_ENDPOINTS.md` (#66-#68) y `04_TRANSVERSALES.md` §8 (reasons) |
| `AllowedTransition`, `AllowedTripTransition` | `logistics.types.ts:34`, `trip.types.ts:68` | `allowedTransitions?` derivados de Delivery y Trip |
| `PreferenciasEntrega` | `trip.types.ts:38` | `Stop.preferenciasEntrega` (sección Trip) |
| `PodReceptor`, `PodUbicacion` | `pod.types.ts:14,20` | campos `receptor` y `ubicacion` de Pod |
| `TransferenciaRetrasadaAlert`, `ProductoPorVencerAlert`, `AlertsSummary` | `alert.types.ts:26,33,44` | las 2 variantes de `Alert` y la respuesta de `#69` |
| `ExpenseCategoryItem`, `ExpenseAnalysis` | `cash.types.ts:33,39` | `CashRegister.expenseAnalysis` (derivado) |
| `CashFlowData` | `analytics.types.ts:26` | parte de `AnalyticsPeriodData` (proyección) |
| `InventoryData` | `inventory.types.ts:124` | forma del archivo de seed `inventory.data.ts` (items, movements, suggestions, history) |

---

## Grafo de dependencias (quién referencia a quién)

`A → B` = A guarda una referencia a B. `⇢` = referencia implícita (por nombre, SKU, código o texto).

```
Company ── (sin relación modelada) ── Branch
SessionUser → Company, Branch[]
UserAccount ⇢ PermissionMatrix (por nombre de rol)        [desconectado de SessionUser]

InventoryItem → Supplier                                   [1 proveedor por producto]
ProductStock → InventoryItem, Branch
InventoryMovement ⇢ InventoryItem (sku), → Branch, ⇢ usuario (texto)
ProductHistoryEvent ⇢ InventoryItem (sku), → Branch
Supplier.products ⇢ InventoryItem (sku, con huérfanos)

ClientAccount ⇢ usuario vendedor (sellerName), ⇢ lista de precios (texto)
Order → ClientAccount ; Order.items ⇢ InventoryItem (sku) ; Order ⇢ usuario (sellerName)
Delivery → Order, Branch ; ⇢ MotivoCatalogItem (motivoCodigo)
DeliveryNote → Order, Delivery ; lines → OrderItem (orderLineId) ; ⇢ MotivoCatalogItem
Trip → Vehicle, Driver, Branch ; Stop → Trip ; Stop.deliveryIds → Delivery[]
Pod → Delivery, Stop
Driver ⇢ (ningún UserAccount aunque exista el rol Chofer)

PurchaseOrder → Supplier, Branch ; lines → InventoryItem
PurchaseSuggestion → InventoryItem, Branch ; ⇢ Supplier (supplierName)

CashTransaction ⇢ ClientAccount|Supplier (entity, texto) ⇢ comprobante (linkedVoucher, texto)
Alert → Delivery|InventoryItem (string sin tipar), Branch (string)
ClientAccount.transactions ⇢ (nada: no se vinculan a Order ni a una factura)
```

**Orden topológico que surge del grafo** (base para las tandas, ver `00_RESUMEN.md`):
1. **Tenancy y acceso:** Company, Branch, User (unificar `SessionUser` y `UserAccount`), Rol/Permiso.
2. **Maestros sin dependencias de negocio:** Supplier, MotivoCatalogItem, Vehicle, Driver.
3. **InventoryItem** (→ Supplier). Después **ProductStock / lotes** (→ InventoryItem, Branch).
4. **ClientAccount** (maestro). La cuenta corriente se separa como entidad propia, que depende de los documentos.
5. **Order + OrderItem** (→ ClientAccount, InventoryItem).
6. **Delivery** (→ Order, Branch). Después **DeliveryNote** (→ Delivery, OrderItem) y **Trip/Stop** (→ Vehicle, Driver, Branch, Delivery). Después **Pod**.
7. **PurchaseOrder** (→ Supplier, Branch, InventoryItem) y **PurchaseSuggestion** (proyección).
8. **Movimientos de inventario** (dependen de que existan los documentos que los originan: remito, recepción, ajuste).
9. **Caja, Alertas, Auditoría** (transversales, referencian a casi todo).
