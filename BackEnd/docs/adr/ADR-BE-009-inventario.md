# ADR-BE-009 — Inventario

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisión #10 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-010](../../../FrontEnd/docs/adr/ADR-010-modelo-logistico.md) (confirma §6 y agrega cuarentena). RF del Documento 04: RF-ENT-002.

## Contexto

**Ninguna operación mueve stock.** `stockDTOStore`, `movementsDTOStore` y `productHistoryDTOStore` son `const` y nadie los modifica (`05_LO_QUE_EL_MOCK_NO_PUEDE_HEREDAR.md` §1; regla R-INV-1 de `03_REGLAS_DE_NEGOCIO.md`; hallazgo **B7**). En particular:
- No hay reserva al confirmar un pedido (RF-INV-007).
- No hay descuento al despachar.
- La recepción de OC no ingresa stock (A9).
- El rechazo en la entrega no reingresa nada.
- El ajuste manual existe solo como un modal huérfano (`StockAdjustmentModal.tsx`, `PENDIENTES.md` #11).

Además, los lotes viven en el producto (alcance empresa) y no se concilian con `ProductStock.stock` (`PENDIENTES.md` #9). El estado "reposición solicitada" vive solo en el navegador (`useReplenishmentStore.ts:29-49`, **A19**).

## Decisión

1. **El kardex es append-only y es la fuente de verdad.** El saldo por producto, sucursal y lote se materializa en la misma transacción, y se tiene que poder conciliar contra el kardex.
2. **Reserva al confirmar el pedido:** disponible = físico − reservado. **La baja física ocurre al despachar** (entrega a `EN_TRANSITO`). **Cancelar libera la reserva.**
3. **Lo rechazado pasa a "en tránsito de retorno"** y reingresa con la confirmación manual de recepción (ADR-010 §6). RF-ENT-002 queda enmendado.
4. **La recepción de compra ingresa stock.**
5. **Un ajuste manual es un documento con motivo y usuario.**
6. **El stock negativo está prohibido por restricción de base.**
7. **Los lotes son por sucursal.**

## Alternativas descartadas (08 #10)

- **Saldo como fuente de verdad, con el kardex como auditoría:** el saldo puede corregirse "a mano" sin dejar rastro, y no hay cómo reconstruirlo.
- **Saldo 100 % derivado del kardex en cada lectura:** caro en todos los listados de stock, y no permite la restricción de "no negativo" a nivel de fila.
- **Reingreso automático en el momento del rechazo** (RF-ENT-002 al pie de la letra): inventa stock que todavía está en la calle. ADR-010 §6 ya lo descartó.
- **Baja física al entregar** (no al despachar): el stock del depósito figuraría como disponible mientras la mercadería está arriba del camión.

## Consecuencias para el backend

- **Tablas:**
  - `inventory_movements`, append-only, con FK al documento de origen: remito, recepción, ajuste, confirmación de retorno, despacho.
  - `stock_balances (empresa_id, branch_id, product_id, lot_id, physical, reserved, in_return_transit)` con `CHECK (physical >= 0 AND reserved >= 0 AND reserved <= physical)`.
  - `product_lots` por sucursal.
- **Cada comando con efecto de stock** escribe el movimiento y actualiza el saldo en la misma transacción (ADR-BE-005). Un job o test de conciliación compara la suma del kardex contra el saldo.
- **Efectos por comando:**

| Comando | Efecto |
|---|---|
| Confirmar pedido | `reserved += cantidad` en la sucursal de origen (ADR-BE-007). Si no alcanza el disponible, 422 `insufficient-stock` |
| Despachar (entrega → `EN_TRANSITO`) | `physical −= cantidad`, `reserved −= cantidad` |
| Registrar entrega con rechazo | `in_return_transit += rechazada` |
| Confirmar recepción de devolución | `in_return_transit −= declarada`; `physical += recibida` |
| Cancelar pedido | `reserved −=` lo reservado que quede |
| Recibir OC | `physical += recibida` |
| Ajuste | `physical ±=`, con motivo y usuario |

## Consecuencias para el frontend (al conectar Inventario)

- `TabStockCurrent` y `TabLowStock` muestran físico, reservado, disponible y en tránsito de retorno.
- `OrderProductsSection` (hoy solo pinta en rojo, `:142,158`) recibe el rechazo `insufficient-stock` del servidor.
- `StockAdjustmentModal` deja de ser huérfano: se conecta a un endpoint de ajuste.
- `TabMovements` y `TabProductHistory` pasan a cursor (ADR-BE-004), y cada movimiento muestra su documento de origen.
- Los lotes salen de `ProductFormModal` (hoy son parte del producto, `inventory.types.ts:56`) y pasan a la vista de stock de la sucursal.
- Aparece la acción de depósito "confirmar recepción de devolución", que hoy no existe en la UI.
- `useReplenishmentStore` se reemplaza por estado de servidor (sub-decisión 5).

## Hallazgos que cierra

- **B7** (nada mueve stock).
- **A9**, parte de stock (la recepción de OC ingresa stock).
- **A19** (reposición solicitada solo en el navegador), por la sub-decisión 5.

## Sub-decisiones tomadas al redactar (pendientes de revisión)

1. **Elección de lote al despachar:** FEFO (primero vence, primero sale) automático, salvo que el comando indique el lote.
2. **Recepción de compra y lotes:** la línea de recepción acepta número de lote y vencimiento opcionales. Sin lote, ingresa a un lote técnico "sin lote" de esa sucursal.
3. **Cancelar un pedido con entregas ya despachadas:** libera solo la reserva del pendiente no despachado. Lo despachado no vuelve por cancelación: vuelve por devolución.
4. **Códigos:** `insufficient-stock` (422), `negative-stock` (422, si la restricción de base salta en un ajuste).
5. **La solicitud de reposición se persiste** como entidad de sucursal (`replenishment_requests`), con estado `requested` y el usuario que la pidió. Ninguna decisión la cubría, y A19 quedaba abierto.
6. **Destino de la devolución:** la confirmación manual elige el destino (stock disponible o cuarentena), como dice ADR-010 §6. La cuarentena es otro saldo (`quarantine`) en `stock_balances`.

## Objeciones

1. **"La baja física ocurre al despachar" y `Delivery` no tiene líneas.** La entrega no tiene cantidades por producto (`FrontEnd/src/shared/types/logistics.types.ts:73-93`). Las cantidades aparecen recién en el remito, al finalizar (`deliveryNote.types.ts:19-44`). En el momento de pasar a `EN_TRANSITO` no hay cantidad que descontar. Para que la decisión se pueda implementar tal cual, `Delivery` necesita líneas con la cantidad despachada, que es la "cantidad despachada" de Doc 03 §17.24. Ningún ADR lo dice todavía.
2. **Reserva en la sucursal de origen contra despacho desde otra sucursal.** La reserva se hace en la sucursal de origen del pedido (ADR-BE-007), pero una entrega puede salir de otra (`Delivery.branchId` es independiente del pedido; los 6 pedidos del seed tienen entregas en 2 o 3 sucursales, ADR-009). Con la decisión tal cual, el despacho desde B baja la reserva en A y el físico en B, así que A queda con reserva sin físico y B con físico sin reserva. Falta decidir si el despacho desde otra sucursal **traslada** la reserva, o si una entrega solo puede salir de la sucursal de origen.
