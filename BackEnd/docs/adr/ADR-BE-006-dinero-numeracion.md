# ADR-BE-006 — Dinero, impuestos y numeración

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #11 y #25 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-008](../../../FrontEnd/docs/adr/ADR-008-dinero-cantidades.md), [ADR-014](../../../FrontEnd/docs/adr/ADR-014-numero-pedido-correlativo.md).

## Contexto

- **ADR-008** (centavos enteros más moneda) está decidido, pero no implementado. Todo importe persistido es `number` en pesos con decimales (`02_MODELO_DE_DATOS.md`; hallazgo **A16**).
- **Importes del pedido (A3):** `createOrder` persiste subtotal, IVA y total tal como los manda el cliente (`FrontEnd/src/modules/orders/api/orders.service.ts:352-357`). El IVA se calcula en float, sin redondeo, solo en la UI (`CreateOrderModal.tsx`, `tax = … * 0.21`).
- **Moneda (A8, parte de moneda):** `Order` no tiene moneda. La fusión de OC desde una sugerencia no compara moneda (`services/mock/purchaseOrders.service.ts:364-380`).
- **Numeración:** solo el pedido tiene número correlativo (ADR-014). Remito, OC, recibo y viaje usan el id interno (`04_TRANSVERSALES.md` §14).

## Decisión

1. **El backend nace con centavos enteros más moneda** (ADR-008). **No hay floats en el contrato.** El frontend migra módulo por módulo al conectarse.
2. **Pedido y orden de compra tienen moneda**, con la de la empresa por defecto.
3. **El servidor calcula todos los importes.**
   - El cliente manda `productId`, cantidad y descuento; **nunca subtotales ni totales**.
   - **La alícuota de IVA es atributo del producto.**
   - **Redondeo half-up por línea; el total es la suma de las líneas.**
   - **La función de cálculo vive en `contracts`**, para que la UI muestre la vista previa con la misma cuenta.
4. **Numeración:** contador **por empresa y serie**, con **bloqueo de fila dentro de la misma transacción**, para pedido, remito, orden de compra, recepción, viaje y recibo (extiende ADR-014). **La numeración fiscal por punto de venta queda para el ADR de Facturación.**

## Alternativas descartadas (08 #11, #25)

- **Mantener el float hasta una tanda de migración:** el backend heredaría el hallazgo A16 en la base, y la migración de datos de dinero es la más riesgosa de todas.
- **String decimal en el wire** (`"1234.56"`): seguro en precisión, pero obliga a parsear en los dos lados y no es lo que decidió ADR-008.
- **Totales calculados en el cliente y validados en el servidor:** duplica la regla. Si alguna vez difieren, ¿quién gana?
- **Secuencia de Postgres (`SEQUENCE`) por documento:** no hay garantía de que no queden huecos ante un rollback, ni se crea fácilmente "por empresa".
- **Número tomado de `count(*)+1`:** descartado ya en ADR-014 (se repite si se borra un documento).

## Consecuencias para el backend

- Toda columna de dinero es `bigint` en centavos, acompañada de `currency char(3)`. Todo importe del DTO es `{ amount: number (entero), currency }`, o un entero más la moneda del documento (sub-decisión 3).
- `packages/contracts` exporta la función pura de cálculo de líneas y totales. La usan el servidor (fuente de verdad) y la vista previa de la UI.
- Tabla de contadores con `UPDATE … RETURNING` dentro de la transacción del comando, que bloquea la fila hasta el commit. Un rollback no deja hueco.

```sql
UPDATE document_counters
   SET last_value = last_value + 1
 WHERE empresa_id = current_setting('app.empresa_id')::uuid AND series = 'PED'
RETURNING last_value;
```

## Consecuencias para el frontend (al conectar cada módulo)

- Cada módulo pasa sus importes a `Money` (`shared/utils/money.ts`). Hoy solo lo usa `modules/dashboard/`.
- `CreateOrderModal` deja de mandar `subtotal`, `discount`, `tax` y `totalAmount` (`orders/api/mapper.ts`, `OrderFormInput`). Manda líneas `{productId, quantity, unitDiscount}`. La vista previa usa la función de `contracts`, no el `useMemo` con `* 0.21`.
- `computePurchaseOrderTotal` (6 componentes) se reemplaza por los totales que devuelve el servidor, y por la función de `contracts` en la vista previa del formulario de OC.
- El pedido y la OC muestran moneda. El formulario de OC ya la tiene (`PurchaseOrderFormModal`).
- Los números legibles (`orderNumber` y los nuevos de remito, OC, recepción, viaje y recibo) se muestran donde hoy se muestra el id.

## Hallazgos que cierra

- **A3** (totales del cliente).
- **A16** (dinero en float).
- **A8**, parte de moneda (la fusión de OC tiene que respetar la moneda; ver sub-decisión 6). La parte de "pisa el precio" la corrige la tanda BE-8.

## Sub-decisiones tomadas al redactar (pendientes de revisión)

1. **Alícuota en basis points** (`taxRateBp: 2100` = 21 %), entero.
2. **Descuento de línea:** importe **por unidad** en centavos (`unitDiscount`), que es lo que hace hoy la UI (`discount * quantity`, `CreateOrderModal.tsx`).
3. **Forma del dinero en el DTO:** en los documentos con moneda propia (pedido, OC), los importes son enteros y la moneda es un campo del documento. En los listados y aggregates que mezclan monedas, cada importe viaja como `{ amount, currency }`.
4. **Fórmula por línea:**
   - `bruto = cantidad × precioUnitario`
   - `descuento = cantidad × unitDiscount`
   - `neto = bruto − descuento`
   - `iva = roundHalfUp(neto × taxRateBp / 10000)`
   - `totalLínea = neto + iva`
   - Totales del documento = suma de cada componente de las líneas.
5. **Series y formato:** `PED` (pedido), `REM` (remito), `OC` (orden de compra), `REC` (recepción), `VIA` (viaje), `RCB` (recibo). Formato `SERIE-` + 6 dígitos, igual que ADR-014 (`PED-000392`). La serie es por empresa, no por sucursal.
6. **Fusión de OC desde sugerencia** (`generatePurchaseOrderFromSuggestion`): solo fusiona en un borrador **de la misma moneda**. Si no hay, crea uno nuevo.
7. **Cantidades:** enteras en la unidad mínima (ADR-008). Las unidades fraccionables quedan para el ADR de unidades de medida (RF-PRD-004).

## Objeciones

1. **El precio depende de la lista de precios elegida en el modal, y la decisión dice que el cliente no manda precios.** Hoy `OrderProductsSection.tsx:59` aplica `modifier = priceList === 'Mayorista' ? 0.9 : priceList === 'Distribuidor' ? 0.8 : 1` sobre el precio del producto, con un selector de lista en `CreateOrderModal` (`priceList`, `useState('Mayorista')`). Si el cliente manda solo `productId`, cantidad y descuento, el servidor no sabe qué lista aplicar. Las listas de precios (RF-PRI-001) no tienen ADR. Opciones sin decidir: tomar la lista de `ClientAccount.priceList` (`client.types.ts:69`), aceptar `priceList` en el comando, o congelar el precio base hasta el ADR de precios.
2. **"La alícuota de IVA es atributo del producto"** y `InventoryItem` no tiene ese campo (`inventory.types.ts:39-64`). Hace falta agregarlo al ABM de productos (`ProductFormModal`) **antes** de poder confirmar un pedido calculado en el servidor. El orden de las tandas tiene que contemplarlo: BE-3 (productos) antes de BE-5 (pedidos).
