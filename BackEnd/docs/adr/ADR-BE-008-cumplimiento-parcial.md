# ADR-BE-008 — Cumplimiento parcial y preparación

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #6, #7 y #8 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md). Evidencia completa: [`07_CUMPLIMIENTO_PARCIAL.md`](../../../FrontEnd/docs/historial/auditorias/backend/07_CUMPLIMIENTO_PARCIAL.md).

## Contexto

- **El conflicto (B5):** ADR-001 y Doc 03 §17.25 dejan el pendiente dentro del mismo pedido. Doc 04 RF-PED-002 y RF-PRE-003 (MVP) piden "crear un Sub-Pedido (Backorder)" y "particionar" el pedido.
- **Sobreentrega (A4):**
  - `applyDeliveryToOrderLines` suma sin tope (`FrontEnd/src/modules/orders/api/orders.service.ts:541-561`).
  - `registrarEntrega` no valida cantidades (`deliveries.service.ts:561-593`).
  - `derivePendingQuantity` oculta el exceso con `Math.max(0, …)` (`shared/utils/orderFulfillment.ts:21`).
- **Compras (A9):** no hay recepción parcial. `received` solo cambia el estado (`services/mock/purchaseOrders.service.ts:303-330`). La línea de OC no tiene cantidad recibida (`purchaseOrder.types.ts:30-35`), y RF-CMP-002 pide un estado "Parcial".
- **Preparación:** Doc 02 §10.21 y RF-PRE-001..004 piden Preparación y Despacho entre el pedido y la entrega. En el código, la preparación es solo el estado `preparing`.

## Decisión

### Venta
- **Pendiente derivado por línea dentro del mismo pedido** (ADR-001 se confirma). **No hay sub-pedido.**
- RF-PED-002 y RF-PRE-003 quedan enmendados.
- **El servidor rechaza la sobreentrega.**

### Compra (simétrico)
- **La recepción es un documento propio, append-only y con líneas.** La cantidad recibida se acumula por línea de la orden.
- **"Parcial" es un estado derivado. No se parte la orden.**
- **El excedente se rechaza por defecto.**
- RF-CMP-002 queda enmendado.

### Preparación
- **Preparación y despacho no se modelan como entidades en las tandas BE-0 a BE-10:** "en preparación" sigue siendo un estado.
- RF-PRE-001 a 004 pasan a un módulo posterior, con su propio ADR.
- **El esquema no tiene que impedir insertar esa entidad entre el pedido y la entrega.**

## Alternativas descartadas (08 #6, #7, #8)

- **#6 B. Backorder como sub-pedido:** contradice ADR-001 y Doc 03 (§17.25 "La cantidad no entregada podrá mantenerse como pendiente"; §12.109 y §17.98 ponen el backorder en una etapa posterior). Además, rompe el conteo de pedidos de ADR-009 (un pedido pasa a contar como dos).
- **#7 Modelar Preparación → Despacho ya:** RF-PRE no tiene ningún contrato hoy (`06_COBERTURA_RF.md`), y ADR-010 §2 ya fijó Viaje → Parada → Entrega → Línea. Agregar dos entidades más en BE-0..10 retrasa todo lo demás por un módulo sin UI.
- **#8 C. Partición de la OC:** el mismo problema que el sub-pedido, del lado de compras.
- **#8 A. Solo `cantidadRecibida` sin documento:** pierde quién recibió, cuándo y contra qué remito de proveedor. RF-CMP-002 habla de "parte de recepción (Remito de Compra)".

## Consecuencias para el backend

- **Venta:**
  - `order_lines` guarda la cantidad pedida, y la entregada se **deriva** de las líneas de remito, o se materializa en la misma transacción (sub-decisión 1).
  - `registrarEntrega` valida, por línea: `entregada + rechazada ≤ pendiente`, valores no negativos, y que el `orderLineId` pertenezca al pedido de esa entrega. Si no cumple, 422 `over-delivery` o `invalid-line`.
- **Compra:**
  - Tablas `purchase_receipts` y `purchase_receipt_lines` (append-only), con FK compuesta a la OC y a sus líneas.
  - `POST /purchase-orders/{id}/receive` con líneas `{purchaseOrderLineId, quantity}`. Valida `recibido + nuevo ≤ pedido` (excedente → 422 `over-receipt`) e ingresa stock en la misma transacción (ADR-BE-009).
- **Preparación:** el pedido no tiene FK directa "hacia abajo". Las entregas referencian `order_id`, y una entidad futura de preparación podrá referenciarse desde la entrega (`preparation_id` anulable) sin romper nada.

## Consecuencias para el frontend

- `RegistrarEntregaModal` deja de ser la única barrera: el servidor devuelve `over-delivery`. `derivePendingQuantity` deja de necesitar el `Math.max(0, …)`, que hoy oculta el error.
- `PurchaseOrderDetailPanel`: "Marcar como Recibida" (`:89`) pasa a ser un formulario de recepción por línea. Aparecen el estado derivado "Parcial" y la lista de recepciones de la OC.
- `PurchaseOrderStatus` (`purchaseOrder.types.ts:21`): `received` deja de ser una transición manual (ver sub-decisión 3).
- Ningún cambio por la preparación: `preparing` sigue siendo un estado (derivado, ver ADR-BE-007).

## Hallazgos que cierra

- **B5** (modelo de cumplimiento parcial contradictorio).
- **A4** (sobreentrega).
- **A9**, parte de cantidades (recibir solo cambiaba el estado). La parte de stock la cierra ADR-BE-009.

## Sub-decisiones tomadas al redactar (pendientes de revisión)

1. **Cantidad entregada por línea de pedido:** se **materializa** en `order_lines.delivered_quantity`, actualizada en la misma transacción que el remito, y se puede conciliar contra la suma de las líneas de remito (mismo criterio que el saldo de stock contra el kardex en ADR-BE-009).
2. **Lo rechazado vuelve a quedar pendiente:** `pendiente = pedida − entregada`, y lo rechazado no se descuenta (ADR-001). Ese pendiente se puede volver a despachar en otra entrega.
3. **Estados persistidos de la OC:** `draft`, `sent`, `cancelled`. `partial` y `received` son derivados de las recepciones.
4. **Cierre de saldo:** RF-CMP-002 dice "cerrar la línea corta o dejarla pendiente". Se agrega un comando explícito con motivo para cerrar el saldo pendiente de una línea, **en compra y en venta por simetría** (`POST /purchase-orders/{id}/close-balance`, `POST /orders/{id}/close-balance`). Ninguna decisión lo cubría.
5. **Sin tolerancia configurable de excedente** en BE-0..10. "Por defecto" queda como el único comportamiento hasta que una necesidad lo pida.
6. **Códigos:** `over-delivery`, `over-receipt` e `invalid-line` (422).

## Objeciones

1. **"Rechaza la sobreentrega" no tiene contra qué comparar en el despacho.** `Delivery` no tiene líneas (`FrontEnd/src/shared/types/logistics.types.ts:73-93`): las cantidades aparecen recién en el remito (`deliveryNote.types.ts:19-44`). Con varias entregas del mismo pedido en curso a la vez (el seed tiene pedidos con 2 y 3 entregas, ADR-009), dos remitos pueden validar cada uno contra el mismo pendiente y entre los dos superarlo, salvo que la validación se haga con bloqueo de las líneas del pedido. Lo mismo afecta a ADR-BE-009 ("baja física al despachar"), que necesita cantidades **en la entrega**.
2. **"En preparación sigue siendo un estado" contra ADR-BE-007** ("solo se persiste el eje comercial"): ver la objeción 1 de ADR-BE-007.
