# 03 — Reglas de negocio que hoy ejecuta el mock como si fuera el servidor

**Verificado contra el código el 2026-10-07.** Rutas relativas a `FrontEnd/src/`. Columnas de cada tabla: **Regla**, **Dónde** (archivo:línea del resolver mock), **Qué valida o hace**, **Respuesta** (`reason`, o `ApiError` con su status) y **¿Duplicada en la UI?** (archivo:línea).

**Cómo se relevó:** `grep -rnE "reason: '|throw new ApiError"` sobre los services (66 puntos de rechazo explícitos), más los motivos que salen de una variable (`createOrder` vía `getCreateOrderBlockReason`, `markStopNoVisitada` vía `getStopNoVisitadaBlockReason`), más la lectura de cada resolver de mutación para los efectos que no devuelven `reason`. **Total: 72 reglas** (R-…, contadas por id de fila). Los hallazgos de cada regla están en la columna "Qué valida"; los marcados **ALTO** también figuran en `00_RESUMEN.md`.

## Pedidos (`modules/orders/api/orders.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-PED-1 | `createOrder` (`shared/utils/orderEligibility.ts:52-60`, llamado en `orders.service.ts:322`) | sin ítems → rechazo | `no-items` | — |
| R-PED-2 | ídem; `getClientById` (`clients.service.ts:188`) | el cliente existe | `client-not-found` | — |
| R-PED-3 | ídem | el cliente está activo (`isActive`) | `inactive-client` | **sí, misma función** (`CreateOrderModal.tsx`, filtro del selector) |
| R-PED-3b | ídem | cada SKU existe en el catálogo | `product-not-found` | indirecto: el buscador solo ofrece productos del catálogo |
| R-PED-3c | ídem | ningún SKU está `inactive` | `inactive-product` | **sí** (`CreateOrderModal.tsx`, `status === 'active'`) |
| **R-PED-4 (ALTO)** | `createOrder:352-357` | **persiste `subtotal`, `tax` y `totalAmount` que manda el cliente, sin recalcular.** Los subtotales por ítem tampoco se recalculan. El impuesto es `(subtotal - discount) * 0.21` **en float, sin redondeo**, y solo en el cliente (`CreateOrderModal.tsx`, AUDIT_10 #2) | — (acepta) | el cálculo vive **solo en la UI** |
| R-PED-5 | `nextOrderNumber` (ADR-014) | número correlativo por empresa `PED-XXXXXX`. Se asigna **después** de validar (un rechazo no consume número, verificado por V17) | — | — |
| **R-PED-6 (ALTO)** | `applyDeliveryToOrderLines:541-561` | suma `cantidad_entregada += delta` **sin tope**: no compara contra `quantity`, no valida delta negativo, no valida que la línea exista (una línea inexistente se ignora en silencio, `:553`) | `ApiError 404` solo si el pedido no existe (`:544`) | — |
| R-PED-7 | `advanceOrderStatus:410-429` | avanza el `status` legado por `ORDER_STATUS_FLOW` (`:383-388`). **No mira `comercial` ni las entregas**: se puede pasar a `delivered` sin ninguna `Delivery`. No escribe `history` | `not-found`, `terminal-status` | `OrdersPage.tsx` muestra el botón según `status` |
| R-PED-8 | `cancelOrder:448-477` | no cancelable si `delivered|invoiced|cancelled` (`:447`) | `invalid-status-for-cancel` | **sí** (`OrderDetailPanel.tsx:163-169`) |
| R-PED-9 | `cancelOrder:461` | no cancelable con entregas activas (`CREADO|EN_TRANSITO`, `deliveries.service.ts:102`) | `has-active-deliveries` | **sí** (`OrderDetailPanel.tsx:162`) |
| R-PED-10 | `cancelOrder:471-473` | escribe `estado='cancelled'` **y** `estado_comercial='Cancelado'` (los dos ejes). No escribe `history`. **No cancela las entregas en cascada** (decisión sin ADR, `ESTADO.md` Tanda 9) | — | — |

## Clientes (`modules/clients/api/clients.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-CLI-1 | `createClient:207` | **ninguna validación**: ni CUIT único, ni formato de CUIT, ni campos obligatorios | — | la UI tampoco valida CUIT |
| R-CLI-2 | `updateClient:236` | el cliente existe | `ApiError 404` | — |
| R-CLI-3 | `createClient` | inicializa la cuenta: saldos en 0, `status: 'Al dia'`, `transactions: []` | — | — |
| R-CLI-4 | `getOverdueClientsPage` y helpers | FIFO de pagos sobre facturas, buckets de antigüedad, montos por moneda **sin sumar entre monedas** | — | — |

## Proveedores (`modules/suppliers/api/suppliers.service.ts`)

| Regla | Dónde | Qué valida | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-PRO-1 | `createSupplier:200`, `updateSupplier:236` | razón social y CUIT obligatorios | `ApiError 400` (texto) | **sí** (`SupplierFormModal.tsx:40`) |
| R-PRO-2 | `:203`, `:243` | CUIT único (normalizado solo para comparar) | `ApiError 400` | — |
| R-PRO-3 | `:240` | existe para editar | `ApiError 404` | — |

## Productos e inventario (`shared/api/products/products.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-PRD-1 | `createProduct:104`, `updateProduct:126` | SKU único, sin distinguir mayúsculas | `ApiError 400` | **sí** (`ProductFormModal.schema.ts:81-90`, contra el catálogo completo cargado) |
| R-PRD-2 | `:107`, `:131` | código de barras único | `ApiError 400` | **sí** (`:92-100`) |
| R-PRD-3 | `updateProduct:124`, `deleteProduct:168` | existe | `ApiError 404` | — |
| R-PRD-4 | `deleteProduct:170` | **baja lógica** (`estado: 'inactive'`), no se borra nada | — | — |
| R-PRD-5 | `updateProduct:140-141` (`mergeProductUpdate`, `productUpdate.ts`) | conserva los lotes si el formulario no los manda (PENDIENTES #13) | — | — |
| R-PRD-6 | `filterAndSortLowStock` (`products.service.ts:490`) | Bajo Stock Mínimo excluye inactivos (Tanda 14). Stock Actual no | — | — |
| R-INV-1 | — | **ninguna operación modifica `ProductStock` ni escribe `InventoryMovement`/`ProductHistoryEvent`**. `grep "stockDTOStore =\|movements.*Store ="` → 0 asignaciones | — | — |
| R-INV-2 | `purchase-suggestions.service.ts:19-21,65,94` | las sugerencias excluyen productos inactivos (server→server con `fetchProducts`, ADR-016) | — | **sí** (`TabPurchases.tsx`) |

## Compras (`services/mock/purchaseOrders.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-CMP-1 | `createPurchaseOrder:273` | `supplierId` no vacío. **No verifica que el proveedor exista** | `invalid-supplier` | **sí** (`PurchaseOrderFormModal.schema.ts:25`) |
| R-CMP-2 | `:276` | al menos una línea | `no-lines` | **sí** (`schema:28`) |
| R-CMP-3 | `:279` | `quantity > 0` y `unitPrice >= 0`. **No exige cantidad entera** (la UI sí, `schema:20`) | `invalid-line` | parcial |
| R-CMP-4 | `:282` | ningún producto inactivo | `inactive-product` | **sí** (`PurchaseOrderFormModal.tsx`) |
| R-CMP-5 | `updatePurchaseOrderStatus:320-325`, `VALID_TRANSITIONS:303-308` | transición permitida | `order-not-found`, `invalid-transition` | botones por estado (`PurchaseOrderDetailPanel.tsx:89`) |
| **R-CMP-6 (ALTO)** | `:328` | **`received` solo cambia el estado**: no suma stock, no registra cantidad recibida, no hay recepción parcial (RF-CMP-002, ver 07) | — | — |
| **R-CMP-7 (ALTO)** | `generatePurchaseOrderFromSuggestion:364-380` | fusiona en el borrador existente por (proveedor, sucursal) **sin comparar moneda**: una línea en ARS puede caer en una OC en USD. Al fusionar una línea existente **pisa `unitPrice`** para toda la cantidad acumulada (`:373`) | `merged: true` | — |
| R-CMP-8 | `:357-361` | proveedor no vacío; producto activo | `invalid-supplier`, `inactive-product` | — |

## Entregas (`modules/logistics/services/deliveries.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-ENT-1 | `transitionDelivery:362-367` | existe; `puedeTransicionar` (`DELIVERY_TRANSITIONS`, ADR-002) | `not-found`, `invalid-transition` | **sí** (`DeliveriesTable.tsx`, misma función) |
| R-ENT-2 | `transitionDelivery:372` | agrega un evento a `historial` (append-only) con `quien` **enviado por el cliente** | — | — |
| R-ENT-3 | `reprogramDelivery:440-462` | existe; transición a `REPROGRAMADO` permitida; motivo obligatorio; `OTRO` exige texto; el código existe en el catálogo del tipo indicado | `not-found`, `invalid-transition`, `motivo-invalido` | **sí** (`ReprogramarModal.tsx`, `MOTIVO_OTRO_CODIGO`) |
| R-ENT-4 | `reprogramDelivery:477-482` | aplica `REPROGRAMADO` y enseguida `CREADO` (dos eventos), cambia `date` y agrega a `reprogramaciones` | — | — |
| R-ENT-5 | `reprogramDelivery:493` | **efecto cruzado:** `releaseDeliveryFromTrip` saca la entrega de su parada (ADR-013) | — | — |
| R-ENT-6 | `registrarEntrega:545-567` | existe; transición a `FINALIZADO` permitida; al menos una línea; cantidad rechazada > 0 exige motivo; `OTRO` exige texto | `not-found`, `invalid-transition`, `no-lines`, `motivo-invalido` | **sí** (`RegistrarEntregaModal.tsx`) |
| **R-ENT-7 (ALTO)** | `registrarEntrega:561-593` | **no valida cantidades**: ni `entregada + rechazada ≤ pendiente` de la línea, ni no-negativas, ni que el `orderLineId` sea de ese pedido. Junto con R-PED-6, se puede entregar más de lo pedido | — | la UI limita con `derivePendingQuantity`, solo visual |
| **R-ENT-8 (ALTO)** | — | `requiereEvidencia` del motivo **no lo valida el servidor**: un rechazo con un motivo que exige evidencia se acepta con `evidenciaIds: []` | — | **solo UI** (`RegistrarEntregaModal.tsx:149`) |
| R-ENT-9 | `registrarEntrega:583,591` | `disparaLogisticaInversa` → `cantidadEnTransitoDeRetorno`. **No mueve stock** (ADR-010 §6, confirmación manual que no existe) | — | — |
| R-ENT-10 | `registrarEntrega:606-607` | crea un `DeliveryNote` (append-only) y pasa la entrega a `FINALIZADO` **aunque la entrega haya sido parcial**: lo pendiente queda en la línea del pedido (ADR-001) | — | — |
| R-ENT-11 | `registrarEntrega:626-633` | **efecto cruzado:** `applyDeliveryToOrderLines`. Si falla, el remito y el `FINALIZADO` **ya están escritos** | `propagation-failed` (con `note`) | — |
| R-ENT-12 | `createDelivery:709-719` | el pedido existe y está `comercial === 'Confirmado'`. **No valida sucursal, fecha, ni que quede algo pendiente de entregar** | `order-not-found`, `order-not-confirmado` | — |
| R-ENT-13 | `createDelivery:733-734` | copia `clientName`/`address` del pedido (snapshot) | — | — |

## Viajes y paradas (`modules/logistics/services/trips.service.ts`)

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-VIA-1 | `createTrip:232-234` | el vehículo existe. **No valida que esté activo, que exista el chofer, que el chofer esté activo, ni que el vehículo o el chofer estén libres esa fecha** | `vehicle-not-found` | la UI ofrece solo activos (`fetchActiveVehicles`/`fetchActiveDrivers`) |
| R-VIA-2 | `assignDeliveriesToStop:327-329` | existen el viaje y la parada | `not-found` | — |
| R-VIA-3 | `:331-332` | **concurrencia optimista**: `version === expectedVersion` (ADR-011 §3) | `stale-version` | — |
| R-VIA-4 | `:339-345` | modo lista o filtro; techo `MAX_TRIP_ASSIGNMENT` = 100 | `exceeds-limit` (+ `matched`, `limit`) | **sí** (`CreateTripModal.tsx`) |
| R-VIA-5 | `:351-360` | una entrega asignada a otro viaje no se reasigna (se devuelve como conflicto parcial) | `conflictos[]` | — |
| **R-VIA-6 (ALTO)** | `:339-363` | **no valida el estado de la entrega** (se puede asignar una `FINALIZADA` o `CANCELADA` en modo lista), **ni la sucursal** (entrega de la sucursal A en un viaje de B), **ni el estado del viaje** (se puede asignar a un viaje `Rendido`) | — | el modal filtra por la sucursal activa |
| R-VIA-7 | `:365-373` | capacidad multidimensional (`excedeCapacidad`). Excederla exige `forzar.motivo`, que queda en `overrides` | `exceeds-capacity`, `motivo-requerido` | **sí** (`CreateTripModal.tsx`, override) |
| R-VIA-8 | `transitionTrip:435-440` | `TRIP_TRANSITIONS`. **No chequea `version`** (incrementa sin comparar). **Sin efectos**: despachar el viaje no pasa sus entregas a `EN_TRANSITO`, y rendirlo no exige paradas resueltas. No hay historial de viaje (`void quien`, `:434`) | `not-found`, `invalid-transition` | `computeAllowedTripTransitions` en el detalle |
| R-VIA-9 | `updateStopOrder:472-477` | mismo conjunto de paradas. **No chequea `version` ni el estado del viaje** | `not-found`, `stops-mismatch` | — |
| R-VIA-10 | `registerPod:532-539` | la entrega pertenece a la parada; la entrega existe. **No chequea el estado del viaje** | `not-found`, `delivery-not-found` | — |
| **R-VIA-11 (ALTO)** | `registerPod:558-560` | finaliza la entrega llamando a `transitionDelivery` (`FINALIZADO`) **sin remito ni `applyDeliveryToOrderLines`**. **Hay dos caminos a `FINALIZADO` con efectos distintos**: por `registrarEntrega` el pedido refleja lo entregado, por POD no | `deliveryFinalized: boolean` | — |
| R-VIA-12 | `registerPod:562` | parada → `Visitada` (aunque la parada tenga más entregas sin POD) | — | — |
| R-VIA-13 | `markStopNoVisitada:668-673` (`stopVisitEligibility.ts`) | viaje `Despachado|EnTransito`; parada `Pendiente`; con entregas; ninguna terminal | `trip-not-en-curso`, `stop-not-pendiente`, `no-deliveries`, `delivery-en-estado-terminal` | **sí, misma función** (`TripDetailPanel.tsx`) |
| R-VIA-14 | `:681-708` | reprograma cada entrega (`reprogramDelivery`, motivo de tipo `no-entrega`); todo o nada **solo para el estado de la parada** | `reprogram-failed` (+ `resultadosPorEntrega`) | — |
| R-VIA-15 | `releaseDeliveryFromTrip:62-77` | saca la entrega de la parada, recalcula la capacidad e incrementa `version` | — | — |

## Vehículos y choferes (`shared/api/vehicles|drivers/*.service.ts`)

| Regla | Dónde | Qué valida | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-VEH-1 | `vehicles.service.ts:127-129,160-162` | patente única **normalizada** (mayúsculas, sin espacios) | `patente-duplicada` | — |
| R-VEH-2 | `:157,183` | existe | `not-found` | — |
| R-VEH-3 | — | capacidades no negativas y al menos una zona: **solo UI** (`VehicleFormModal.schema.ts:16-20`) | — | solo UI |
| R-CHO-1 | `drivers.service.ts:128,146` | existe | `not-found` | — |
| R-CHO-2 | — | nombre, licencia y teléfono obligatorios: **solo UI** (`DriverFormModal.schema.ts:10-12`). **No hay licencia única** | — | solo UI |

## Caja, alertas, permisos

| Regla | Dónde | Qué valida / hace | Respuesta | ¿UI? |
|---|---|---|---|---|
| R-CAJ-1 | `cash.service.ts:222` | `amount > 0` | `ApiError 400` | — |
| R-CAJ-2 | `:225-235` | **no valida que `category` sea coherente con `type`** (ingreso con categoría de egreso). `time` lo manda el cliente. `entity` y `linkedVoucher` son texto libre. **Sin caja abierta/cerrada** | — | — |
| R-ALE-1 | `alerts.service.ts:75-84` | `leida = true` **global** (ADR-007 pide por usuario). No valida que exista | — | — |
| R-PER-1 | `users-roles.service.ts:136-151` | actualiza la matriz de un rol. **Sin restricciones** (se le puede quitar todo a `Admin`) | — | — |

## Unicidad y numeración (resumen)

| Qué | Regla | Dónde |
|---|---|---|
| Número de pedido | correlativo por empresa `PED-XXXXXX` | `orders.service.ts` (`nextOrderNumber`, ADR-014) |
| SKU, código de barras | únicos | `products.service.ts:104-108` |
| CUIT de proveedor | único | `suppliers.service.ts:203,243` |
| Patente | única normalizada | `vehicles.service.ts:113` |
| CUIT de cliente | **no es único** | — |
| Licencia de chofer | **no es única** | — |
| Ids de todo lo demás | `` `${prefijo}-${Date.now()}` `` (con índice en algunos) | 21 usos de `Date.now()` en 12 archivos (05) |
| Número de remito, de OC, de recibo | **no existen**: solo id interno | — |

## Reglas que viven SOLO en la UI (el backend no las heredaría)

| Regla | Dónde (UI) | Consecuencia si el backend no la implementa |
|---|---|---|
| Cálculo de subtotal, descuento, IVA 21% y total del pedido | `CreateOrderModal.tsx` (`useMemo`, `tax = … * 0.21`) | el servidor guarda totales del cliente (R-PED-4) |
| Stock insuficiente al armar un pedido | `OrderProductsSection.tsx:142,158` (solo una clase CSS) | no hay control de stock ni reserva (RF-INV-007) |
| Alerta de deuda sobre el límite de crédito | `CreateOrderModal.tsx:95` (aviso, no bloquea) | RF-CLI-002/004 piden bloquear; hoy no lo hace nadie |
| Evidencia obligatoria según motivo | `RegistrarEntregaModal.tsx:149` | R-ENT-8 |
| Pendiente máximo por línea al registrar una entrega | `RegistrarEntregaModal.tsx` (`derivePendingQuantity`) | R-ENT-7 |
| Dígito verificador EAN-13 | `ProductFormModal.schema.ts:35-40` | el servidor acepta cualquier código |
| Cantidad entera en las líneas de OC | `PurchaseOrderFormModal.schema.ts:20` | el servidor acepta 2,5 unidades |
| Capacidades del vehículo ≥ 0, ≥ 1 zona | `VehicleFormModal.schema.ts:16-20` | R-VEH-3 |
| Campos obligatorios del chofer | `DriverFormModal.schema.ts:10-12` | R-CHO-2 |
| Ofrecer solo vehículos y choferes activos | `TripsPage.tsx` (`fetchActive*`) | R-VIA-1 |
| Sucursal inactiva no seleccionable | `useSessionStore.ts` (`setActiveBranch`, `reason: 'inactive'`) | ningún endpoint valida `branch.status` |
| Solicitud de reposición única por producto | `useReplenishmentStore.ts:38-49` (`already-requested`) | el estado ni siquiera llega al servidor |
| Rol fijo `USER_ROLE='ADMIN'` para habilitar acciones de inventario | `InventoryPage.tsx:69` | no hay autorización real (04) |

## Efectos que deberían ser UNA transacción y hoy son pasos sueltos

| Operación | Pasos | Qué queda inconsistente si falla a mitad |
|---|---|---|
| `registrarEntrega` (`deliveries.service.ts:606-633`) | 1) guarda el remito → 2) entrega `FINALIZADO` → 3) `applyDeliveryToOrderLines` | si 3 falla, el remito y el `FINALIZADO` quedan sin que el pedido lo refleje (`propagation-failed`, sin reversión) |
| `markStopNoVisitada` (`trips.service.ts:681-718`) | N × `reprogramDelivery` (cada uno: historial + fecha + `releaseDeliveryFromTrip`) → parada `NoVisitada` | si la entrega k falla, las k−1 anteriores **ya se reprogramaron y salieron del viaje**; la parada no cambia (ADR-013, enmienda: "no hay transacción real en este mock") |
| `registerPod` (`trips.service.ts:542-564`) | 1) `registerPodEvidence` → 2) `transitionDelivery` (con otra clave de idempotencia, `` `${key}-finalizar` ``) → 3) parada `Visitada` | si 2 falla queda un POD sin entrega finalizada; si 3 falla, la entrega finalizada y la parada `Pendiente` |
| `reprogramDelivery` (`deliveries.service.ts:477-493`) | 1) historial + fecha → 2) `releaseDeliveryFromTrip` (otro store, otra `version`) | entrega reprogramada que todavía figura en la parada |
| `createOrder` (`orders.service.ts:295-376`) | 1) `getClientById` (request anidado) → 2) `fetchProducts` (request anidado, ADR-016) → 3) número correlativo → 4) persistir | lectura no aislada: el cliente o el producto pueden cambiar entre 1-2 y 4 |
| `cancelOrder` (`:461-473`) | 1) consulta entregas activas → 2) cancela | carrera: entre 1 y 2 alguien puede crear una `Delivery` (no hay bloqueo) |
| `createDelivery` (`deliveries.service.ts:709-745`) | 1) `getOrderById` (request anidado) → 2) crea | el pedido puede cancelarse entre 1 y 2 |
| Confirmar un pedido → reservar stock; despachar → descontar stock; recibir una OC → sumar stock | **no existen** (R-INV-1) | — |
| Registrar entrega/factura → movimiento en cuenta corriente | **no existe**: `ClientAccount.transactions` no se escribe desde ninguna operación | — |
