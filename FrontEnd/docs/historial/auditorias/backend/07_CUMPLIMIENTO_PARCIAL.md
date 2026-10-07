# 07 — Cumplimiento parcial: qué modelo hay en el código y qué piden los documentos

**Verificado el 2026-10-07.** Este documento es **solo evidencia: no recomienda**. Las citas textuales de Doc 02 y Doc 03 salen de `doc02_all_extracted.txt` y `doc03_extracted.txt` (archivos de una sola línea, citados por número de sección). Las de Doc 04, por número de línea del `.md`.

## 1. Qué implementa hoy el código

### Venta: pendiente derivado por línea, un solo pedido, N remitos (ADR-001)

| Pieza | Archivo:línea | Qué hace |
|---|---|---|
| Cantidad entregada acumulada por línea | `shared/types/order.types.ts:63` (`OrderItem.cantidadEntregada`) | es el único contador por línea. Pedido = `quantity` |
| Pendiente **derivado, nunca persistido** | `shared/utils/orderFulfillment.ts:20-22` | `Math.max(0, quantity - cantidadEntregada)`. **El `max(0)` oculta la sobreentrega** (03, R-PED-6) |
| Estado de cumplimiento del pedido | `orderFulfillment.ts:24-32` | `pendiente` / `parcial` / `completo`, derivado de las líneas. Lo consume `OrderDetailPanel.tsx:171` |
| Remito (documento por entrega física) | `shared/types/deliveryNote.types.ts:19-57` | `DeliveryNoteLine {orderLineId, cantidadOfrecida, cantidadEntregada, cantidadRechazada, motivo, cantidadEnTransitoDeRetorno?}`. Append-only |
| Rechazo total (derivado) | `deliveryNote.types.ts:59-62` (`isRechazoTotal`) | todas las líneas rechazadas por completo |
| Alta del remito | `modules/logistics/services/deliveries.service.ts:580-607` | arma las líneas y pasa la entrega a `FINALIZADO` **aunque haya quedado pendiente** |
| Propagación al pedido | `modules/orders/api/orders.service.ts:541-561` | `cantidad_entregada += delta`, sin tope |
| Nueva entrega para lo pendiente | `createDelivery` (`deliveries.service.ts:692-749`) | se crea **a mano**, otra `Delivery` sobre el mismo `orderId`. No se valida que quede pendiente |
| Eje logístico del pedido (ADR-010 §1) | `shared/utils/orderLogistics.ts:38` | derivado de las `Delivery` del pedido |
| UI | `RegistrarEntregaModal.tsx:130,282` (tope visual por pendiente), `OrderDetailPanel.tsx:171` | — |

**Lo que el modelo NO tiene:**
- Cantidad **preparada** ni **despachada** por línea (no hay picking).
- Estado de línea.
- Entidad backorder o sub-pedido.
- Reserva de stock.
- Movimiento de stock asociado al remito.

### Compra: sin modelo de recepción parcial

| Pieza | Archivo:línea | Qué hace |
|---|---|---|
| Estados de la OC | `shared/types/purchaseOrder.types.ts:21` | `draft`, `sent`, `received`, `cancelled`. **No hay "Parcial"** |
| Línea de OC | `purchaseOrder.types.ts:30-35` | `{id, productId, quantity, unitPrice}`. **Sin cantidad recibida** |
| Recepción | `services/mock/purchaseOrders.service.ts:303-330` | `sent → received` cambia el estado y nada más (sin cantidades, sin stock) |
| UI | `PurchaseOrderDetailPanel.tsx:89` | botón "Marcar como Recibida" |

### Facturación y preparación: no existen en el código

- La factura de venta es solo el estado `invoiced` de `OrderStatus` (`order.types.ts:25`), al que se llega con `advanceOrderStatus` desde `delivered` (`orders.service.ts:383-388`). No hay documento, ni facturación parcial, ni relación con el remito.
- La preparación es solo el estado `preparing`, sin tareas, cantidades ni faltantes.

## 2. Qué piden los documentos (cita textual)

### Doc 03 — Modelo Funcional del Dominio

- **§17.23 Pedido Parcial:** "Un pedido podrá ser atendido parcialmente. Ejemplo: Pedido: 100 unidades. Despacho: 60 unidades. Pendiente: 40 unidades".
- **§17.24 Entrega Parcial:** "La entrega parcial deberá conservar: cantidad solicitada; cantidad preparada; cantidad despachada; cantidad entregada; cantidad pendiente."
- **§17.25 Backorder:** "La cantidad no entregada podrá mantenerse como pendiente. PEDIDO 100 ↓ ENTREGADO 60 ↓ PENDIENTE 40. El sistema deberá poder gestionar el pendiente posteriormente."
- **§17.50 Falta de Stock:** "Si no existe disponibilidad suficiente, el sistema podrá: impedir confirmación; permitir pedido pendiente; permitir backorder; permitir compra; permitir sustitución. La estrategia deberá ser configurable."
- **§12.105 Flujo de Venta con Falta de Stock:** "Stock insuficiente ↓ Política comercial ├── Rechazar ├── Entregar parcial ├── Backorder └── Esperar reposición".
- **§12.109 Evolución del Dominio (de Ventas):** "Posteriormente: Cotizaciones, Promociones, … Backorders, Picking, Packing, Ruteo…". Es decir, el backorder figura **fuera** de la primera versión.
- **§17.98 Evolución del Dominio:** "Segunda etapa: Cotizaciones, Aprobaciones, Reservas, Backorders, Devoluciones…".
- **Principio de separación (§4.24):** "…Entrega ≠ Movimiento de Stock ≠ Factura ≠ Cobro. Pueden estar relacionados, pero representan hechos diferentes. Esta separación será fundamental para permitir: Entregas parciales. Facturación parcial. Devoluciones…".
- **Configuración de compras (§6.34):** "Podrán contemplarse: Aprobaciones. Límites. Recepción parcial. Tolerancias…".
- **Ciclo de compra (§21.34):** "…06/08 → Orden emitida, 10/08 → Recepción parcial, 15/08 → Recepción final".

### Doc 02 — Arquitectura Funcional del Negocio

- **§10.21:** "Pedido 1 ───── N Preparación y posteriormente: Preparación 1 ───── N Despacho y: Despacho 1 ───── N Entrega. Esto permite soportar: Entregas parciales. Múltiples despachos. Diferentes rutas. Diferentes transportistas."
- **§8.17 Flujos Alternativos:** "Deberán contemplarse situaciones como: Cancelaciones. Rechazos. Devoluciones. Falta de stock. Pagos parciales. Entregas parciales. Recepciones parciales…".

### Doc 04 — Plan Maestro (RF)

- **RF-PED-002** (línea 961, MVP): "Estados: Pendiente, En Preparación, Despachado, Entregado. Si hay quiebre de stock en piso (incidencia en RF-PRE-003), el sistema debe permitir despachar el saldo posible y automáticamente crear un **"Sub-Pedido" (Backorder)** con el resto pendiente." Criterio: "…despachar lo disponible y crear un backorder con el resto."
- **RF-PED-001** (943): "Congela precios pactados. Aumenta stock comprometido (RF-INV-007)."
- **RF-PED-004** (996): "Al cancelar un pedido no despachado, el stock reservado debe liberarse completamente. No debe ser posible cancelar un pedido ya despachado."
- **RF-INV-007** (739): "Stock Disponible = Stock Físico - Stock Reservado. Al confirmar un Pedido de Venta, se incrementa el Stock Reservado. Al despachar el pedido, baja el Físico y baja el Reservado."
- **RF-PRE-002** (1047): "El operario ingresa lo que encontró. El sistema compara contra lo solicitado."
- **RF-PRE-003** (1062): "Si el operario declara "Faltante", el sistema genera automáticamente un Ajuste Negativo de Stock Físico (RF-INV-002) y **detona el Backorder en el Pedido** (RF-PED-002)." Criterio: "…el pedido debe **particionarse** automáticamente."
- **RF-CMP-001** (767-770): "Flujo principal: 1. Creada. 2. Enviada. 3. Recepcionada (parcial o total)." "No debe ser posible modificar una Orden de Compra que ya tiene recepciones parciales registradas."
- **RF-CMP-002** (783-791): "Tomar una OC en estado "Enviada" y generar el parte de recepción (Remito de Compra). Si hay diferencias entre lo pedido y lo recibido, el sistema alerta y permite cerrar la línea corta o dejarla pendiente." Criterio: "Al recibir 8 de 10 unidades pedidas, la OC debe quedar en **estado Parcial** y el stock debe incrementarse en 8." Tarea: "Definir algoritmo de partición de OC en caso de backorder de compra."
- **RF-ENT-001** (1151): "Al confirmar la entrega, el pedido debe quedar en estado Entregado y bloqueado contra modificaciones posteriores."
- **RF-ENT-002** (1166): "Transiciona el Pedido a "Rechazado". Exige Motivo." Criterio: "…la mercadería debe reingresarse al stock físico y debe poder generarse la nota de crédito correspondiente."
- **RF-FAC-001** (1216): "Toma un Pedido **o Remito** y genera un documento fiscal (Factura A, B, C)." Criterio: "…el saldo deudor del cliente en su cuenta corriente debe incrementarse por el monto facturado."

## 3. Dónde chocan (hechos, sin elegir)

| Tema | Código / ADR | Doc 03 | Doc 04 |
|---|---|---|---|
| Qué es el backorder | pendiente derivado por línea, mismo pedido (ADR-001) | "pendiente" del mismo pedido (§17.25), configurable (§17.50), y en una **etapa posterior** (§12.109, §17.98) | **otra entidad**: "Sub-Pedido", el pedido "debe particionarse" (RF-PED-002 y RF-PRE-003, **MVP**) |
| Cantidades por línea | pedida y entregada | solicitada, preparada, despachada, entregada, pendiente (§17.24) | comparar encontrado contra solicitado (RF-PRE-002) |
| Jerarquía | Pedido 1-N Delivery 1-N Remito | — | — |
| Doc 02 | — | — | Pedido 1-N Preparación 1-N Despacho 1-N Entrega (§10.21) |
| Estado del pedido tras una entrega parcial | la entrega queda `FINALIZADO`; el pedido, "parcial" derivado | — | estados Pendiente / En Preparación / Despachado / Entregado (RF-PED-002); "Rechazado" (RF-ENT-002) **no existe** en `OrderStatus` |
| Recepción de compra | sin parcial | "recepción parcial" configurable (§6.34) | estado "Parcial" de la OC con stock +8 (RF-CMP-002, MVP) |
| Facturación parcial | inexistente | separación Entrega ≠ Factura (§4.24) | factura desde Pedido **o** Remito (RF-FAC-001) |
| Stock | no se mueve | Entrega ≠ Movimiento de Stock (§4.24) | reserva al confirmar, baja al despachar (RF-INV-007) |

## 4. Qué cambiaría en el frontend bajo cada modelo

**Modelo A — Pendiente derivado por línea, un solo pedido (el actual, ADR-001 + Doc 03 §17.25):**
- `OrderItem` gana `cantidadPreparada` y `cantidadDespachada` si se adopta Doc 03 §17.24 (`order.types.ts:56-64`, mapper y DTO de pedidos).
- `deriveOrderFulfillmentStatus` (`orderFulfillment.ts:24`) pasa a considerar esas cantidades.
- La UI de "nueva entrega para lo pendiente" (`CreateDeliveryModal.tsx`) necesita mostrar el pendiente.
- `PurchaseOrderLine` gana `cantidadRecibida` y la OC el estado `partial` (o uno derivado). Cambian `PurchaseOrderDetailPanel.tsx` (recepción por línea) y `updatePurchaseOrderStatus`, que pasa a ser una operación de recepción con cantidades.
- Sin cambios de identidad: `OrderId`/`OrderLineId` siguen apuntando al pedido original.

**Modelo B — Backorder como sub-pedido (Doc 04 RF-PED-002 y RF-PRE-003):**
- `Order` gana `parentOrderId?: OrderId` (o equivalente), y la numeración (ADR-014) decide cómo se numera el hijo.
- Un remito parcial (o una incidencia de picking) **crea** un pedido nuevo con las líneas pendientes, y la línea original se cierra. Esto **reemplaza** el pendiente derivado de ADR-001 (`derivePendingQuantity` deja de tener sentido sobre el original).
- `OrdersPage` y `OrderDetailPanel` necesitan mostrar la relación padre/hijo. El tablero (ADR-009, que cuenta pedidos por sucursal vía `Delivery`) cuenta dos pedidos donde antes había uno.
- `DeliveryNoteLine.orderLineId` puede apuntar a líneas de pedidos distintos según el momento.
- Para compras, RF-CMP-002 pide "algoritmo de partición de OC": la misma pregunta de modelo para `PurchaseOrder`.

**Modelo C — Cadena Preparación → Despacho → Entrega (Doc 02 §10.21):**
- Aparecen entidades nuevas entre `Order` y `Delivery`: Preparación (tareas de picking, RF-PRE-*) y Despacho.
- `Delivery` deja de colgar directamente de `Order`.
- El pendiente se calcula por etapa: pedido contra preparado, preparado contra despachado, despachado contra entregado.
- Afecta `logistics.types.ts`, `deliveries.service.ts#createDelivery` (hoy desde el pedido) y `CreateDeliveryModal.tsx`.
- Es compatible con A (pendiente derivado) o con B (partición), así que es una decisión **ortogonal**.

Las tres preguntas (A contra B, adopción de C y recepción parcial de compras) figuran en `08_DECISIONES_ABIERTAS.md` (#6, #7 y #8).
