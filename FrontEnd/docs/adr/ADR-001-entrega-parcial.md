# ADR-001 — Modelo de entrega parcial

**Estado:** Decidido (no discutir de nuevo salvo contradicción frontal con el código, ver sección 9 del prompt maestro de la corrida completa). **Fecha:** 2026-09-07.

## Problema

Hoy `Order` no tiene líneas con cantidad entregada — un pedido se marca con un `status` único (`'pending' | ...`), sin ninguna noción de "se entregó parte". Para que Logística/Entregas (Tanda 8) pueda registrar una entrega parcial trazable por producto (ej. pedido de 100 unidades, remito de 70, quedan 30 pendientes, y después un segundo remito por esas 30), hace falta un modelo de datos que:

1. Sepa, por línea de pedido, cuánto se pidió y cuánto se entregó hasta ahora.
2. Represente cada entrega física como un documento propio (remito), no como una edición del pedido.
3. Derive el estado del pedido (pendiente/parcial/completo) de sus líneas, sin que nada lo escriba a mano y pueda desincronizarse.
4. Nunca pierda historial: una corrección es un evento nuevo, no una edición del anterior (append-only, mismo criterio ya usado en `InventoryMovement`/`ProductHistoryEvent`, ver `AUDIT_4_IDS_RELACIONES.md`, "qué está bien").

## Opción elegida

- **Unidad de trazabilidad: la línea de pedido, no el pedido.** Cada `OrderLine` gana `cantidadPedida: number` y `cantidadEntregada: number`. `cantidadPendiente` **se deriva siempre** (`cantidadPedida - cantidadEntregada`), nunca se persiste — mismo principio que `PurchaseOrderLine`/`computePurchaseOrderTotal` ya aplican con el total de una OC (`AUDIT_10_DINERO_CANTIDADES.md`, "qué está bien": "nunca se persiste un total propio").
- **Las entregas son documentos propios (remitos).** Un `DeliveryNote` (remito) tiene sus propias líneas (`DeliveryNoteLine`), cada una apuntando a una `OrderLine` **por ID tipado** (`OrderLineId`, ver ADR-006), con la `cantidadEntregada` de ESE remito puntual. Un pedido puede tener N remitos a lo largo del tiempo.
- **El estado del pedido se deriva de sus líneas**, nunca se escribe a mano: `pendiente` (ninguna línea con `cantidadEntregada > 0`), `parcial` (al menos una línea con `0 < cantidadEntregada < cantidadPedida`, o algunas líneas completas y otras no), `completo` (todas las líneas con `cantidadEntregada === cantidadPedida`). Una función pura (`deriveOrderFulfillmentStatus(lines: OrderLine[])`) centraliza esta regla — mismo patrón que `computePurchaseOrderTotal`.
- **Todo es append-only.** Un remito, una vez creado, no se edita — una corrección (ej. se cargó mal la cantidad) es un remito nuevo (posiblemente negativo/de ajuste, a definir en la implementación de Tanda 8) o un evento de historial nuevo, nunca un `UPDATE` sobre el remito existente.
- **Caso guía obligatorio, verificado por el smoke script de la Tanda 8:** pedido de 100 unidades en una línea, un remito de 70 (`cantidadEntregada` acumulada: 70, `cantidadPendiente`: 30, estado: `parcial`), un segundo remito de 30 (`cantidadEntregada` acumulada: 100, `cantidadPendiente`: 0, estado: `completo`).

## Alternativas descartadas

1. **Guardar `cantidadPendiente` como campo persistido, actualizado en cada remito.** Descartada por la misma razón que `PurchaseOrder` no persiste un `total`: un campo derivado que se actualiza a mano en dos lugares (al crear el remito Y al leer el pedido) es exactamente la clase de bug que `AUDIT_10` ya identificó como riesgo (`orders` no deriva `totalAmount` de sus líneas, a diferencia de `purchaseOrders`) — no repetir el mismo error en el modelo de entregas.
2. **Un solo `status` de pedido editado a mano en cada remito** (lo que existe hoy, extendido). Descartada porque un `status` de texto libre no puede representar "línea A completa, línea B parcial" — el pedido de 100 con dos productos, uno entregado y el otro no, no tiene una sola palabra que lo describa correctamente sin perder información por producto.
3. **Editar la línea de pedido original en cada entrega** (sin documento de remito separado). Descartada porque viola append-only y porque un remito es un documento de negocio real (lo que el depósito imprime y el cliente firma) — colapsarlo dentro del pedido pierde la trazabilidad de "qué remito entregó qué" que Tanda 8 pide explícitamente.

## Qué se rompe si se cambia después

- Si se decide que la trazabilidad debe ser a nivel de PEDIDO y no de línea (ej. por rendimiento, evitar N filas por pedido), hay que revisar cualquier reporte que ya asuma "estado por línea" (ej. "productos pendientes de entrega" cruzando líneas de distintos pedidos) — se pierde granularidad, no se puede reconstruir después sin el dato.
- Si se decide persistir `cantidadPendiente` en vez de derivarla, hay que auditar cada punto que crea/edita un remito para mantenerlo sincronizado — exactamente el riesgo que esta decisión evita.
- Si se decide que los remitos SÍ se editan (no append-only), se pierde la auditoría de "quién entregó qué y cuándo" que Tanda 8 necesita para el historial visible en la UI.
