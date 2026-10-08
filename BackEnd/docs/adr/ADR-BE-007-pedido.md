# ADR-BE-007 — Pedido: estados, sucursal, producto y snapshot

**Estado:** Aceptado. **Fecha:** 2026-10-07. **Resuelve:** decisiones #9, #16, #19 y #24 de [`08_DECISIONES_ABIERTAS.md`](../../../FrontEnd/docs/historial/auditorias/backend/08_DECISIONES_ABIERTAS.md).

**Enmienda a ADRs del frontend:** [ADR-009](../../../FrontEnd/docs/adr/ADR-009-alcance-dashboard.md), [ADR-016](../../../FrontEnd/docs/adr/ADR-016-filtro-estado-server-side.md). RF del Documento 04: RF-ENT-002.

## Contexto

- **Dos estados conviviendo:** el `Order` tiene `status` (legado, comentado como "deprecado", `FrontEnd/src/shared/types/order.types.ts:75`) y `comercial` (ADR-010 §1).
- **`advanceOrderStatus` (M9):** avanza el `status` sin mirar entregas (`orders.service.ts:410-429`). Ni `advance` ni `cancel` escriben `history`.
- **"Rechazado" (RF-ENT-002)** no existe en ninguna de las dos uniones.
- **Sin sucursal:** el pedido no tiene sucursal. ADR-009 la deriva vía `Delivery`, con doble conteo, y un pedido sin entregas desaparece de los filtros por sucursal.
- **Relación por SKU (M15):** las líneas referencian producto por SKU, que es editable (`products.service.ts:126`). Lo mismo pasa con movimientos, historial y productos de proveedor.
- **Dirección (`PENDIENTES.md` #16/#17):** el pedido toma la dirección fiscal y descarta lo que se carga en `OrderDeliverySection`.

## Decisión

1. **Se persiste solo el eje comercial.** Los ejes logístico y financiero son derivados (ADR-010 §1).
   - **El `status` legado no existe en la base.** El DTO lo expone derivado y de solo lectura hasta que el frontend deje de usarlo.
   - **`advanceOrderStatus` desaparece** y se reemplaza por comandos explícitos.
   - **"En preparación" es un valor derivado del eje logístico** (alguna entrega en `CREADO`; sub-decisión 1). **No existe una acción manual de "poner en preparación": crear la entrega es empezar a prepararla** (resolución de la objeción 1).
2. **"Rechazado" y "Entregado y bloqueado" son derivados**, no estados persistidos. **Un pedido entregado por completo es inmutable.**
3. **El pedido tiene sucursal de origen obligatoria**, con la sucursal activa por defecto. Se sigue viendo a nivel empresa.
   - **Enmienda ADR-009:** el filtro del tablero usa ese campo y no el join por `Delivery`.
4. **Las líneas referencian `productId`; SKU y nombre quedan como snapshot.** El SKU es editable y único por empresa. Lo mismo para movimientos, historial de producto y productos de proveedor.
5. **Al confirmar se congelan** los datos fiscales del cliente, la dirección de entrega, los precios y las alícuotas.
   - **La dirección de entrega es un campo propio del pedido:** por defecto, la de entrega del cliente; si no tiene, la fiscal.
   - **Lo que se carga en el modal se persiste.**

## Alternativas descartadas (08 #9, #16, #19, #24)

- **#9 A. Relación pedido↔sucursal derivada vía `Delivery`** (ADR-009 original): la reserva de stock al confirmar (ADR-BE-009) necesita saber de qué sucursal reservar **antes** de que exista una entrega, y un pedido nuevo desaparecía de los filtros por sucursal.
- **#16 Persistir los tres ejes:** se desincronizan. Es exactamente la "migración a medias" que ADR-010 §1 evita derivando.
- **#16 Mantener `advanceOrderStatus`:** avanza estados logísticos sin que haya ocurrido ningún hecho logístico (R-PED-7).
- **#19 B. SKU inmutable:** obliga a dar de alta un producto nuevo para corregir un SKU mal cargado, y rompe el historial.
- **#24 Sin snapshot (leer el cliente vivo):** un cambio de domicilio fiscal reescribiría pedidos ya emitidos.

## Consecuencias para el backend

- `orders` tiene `commercial_status` (`Borrador|Confirmado|Cancelado`) más `version`. No tiene columna de estado logístico.
- El estado logístico, el financiero y el legado salen de una vista o función SQL sobre las entregas, los remitos y (más adelante) las facturas.
- Comandos: `POST /orders` (alta), `POST /orders/{id}/confirm` (si se crea en borrador) y `POST /orders/{id}/cancel`. El avance logístico ocurre por los comandos de entrega (ADR-BE-008/009), no por el pedido.
- `orders.branch_id NOT NULL` con FK compuesta a `branches` (ADR-BE-002).
- `order_lines.product_id` es FK compuesta a `inventory_items`, y `sku`/`name` son snapshot. Igual para `inventory_movements`, `product_history_events` y `supplier_products`.
- `inventory_items` tiene `UNIQUE (empresa_id, sku)`. El SKU se puede editar; los snapshots no cambian.
- Columnas de snapshot al confirmar: datos fiscales del cliente (razón social, CUIT, condición de IVA), dirección de entrega (dirección, localidad, contacto, teléfono, referencias), precio unitario y alícuota por línea.
- Un pedido con cumplimiento completo rechaza toda mutación con 422 `order-locked` (sub-decisión 5).

## Consecuencias para el frontend (al conectar Pedidos)

- `OrdersPage`: el botón de "avanzar estado" desaparece. Las columnas de estado muestran el eje comercial y el logístico (derivado). El `status` legado se lee del DTO mientras quede algún consumidor.
- `OrderItem` gana `productId`. `OrderProductsSection` y `CreateOrderModal` mandan `productId`.
- `CreateOrderModal` manda `branchId` (la sucursal activa) y la dirección de entrega del modal. `OrderDeliverySection` deja de ser fantasma (`PENDIENTES.md` #17), y el default sale del cliente (#16).
- `filterOrdersForBranch` y `getOrderBranchLinksForAggregation` (ADR-009) dejan de usarse para el tablero.
- `OrderDetailPanel` muestra "Rechazado" y "Entregado" como derivados que vienen del servidor.

## Hallazgos que cierra

- **M9** (`advanceOrderStatus` ignora las entregas; `history` no se escribe en avance ni cancelación).
- **M15** (FK por SKU).
- Además cierra `PENDIENTES.md` #16 y #17 (dirección de entrega), que no tienen id en `00_RESUMEN.md`.

## Sub-decisiones (aprobadas 2026-10-08)

1. **Derivación del `status` legado** (en orden de precedencia):

| `status` | Condición |
|---|---|
| `cancelled` | `comercial = Cancelado` |
| `invoiced` | existe factura (cuando exista Facturación; hasta entonces, nunca) |
| `delivered` | cumplimiento completo |
| `dispatched` | alguna entrega `EN_TRANSITO`, o cumplimiento parcial |
| `preparing` | alguna entrega `CREADO` |
| `pending` | ninguna de las anteriores |

2. **"Rechazado" derivado:** el pedido tiene al menos un remito, **todos** sus remitos son rechazo total (`isRechazoTotal`, `deliveryNote.types.ts:59`), y la cantidad entregada acumulada es 0.
3. **Mientras no exista flujo de borrador** (`createOrder` hoy crea directo en `Confirmado`, `orders.service.ts`), **el alta es la confirmación**, y el snapshot se toma en el alta.
4. **Regla de dirección por defecto:** si `deliveryAddressSameAsFiscal` es `false` y `deliveryAddress` no está vacía, se usa la de entrega. En cualquier otro caso, la fiscal. Así se respeta el toggle de la Tanda 16 (`client.types.ts:85-86`).
5. **Código del rechazo por inmutabilidad:** `order-locked` (422).
6. **Historial del pedido:** `Order.history` lo escriben **todos** los comandos del pedido (alta, confirmación, cancelación) y los eventos derivados relevantes (primera entrega, cumplimiento completo), además de la auditoría genérica (ADR-BE-005).

## Objeciones

1. **"Solo se persiste el eje comercial" choca con "en preparación sigue siendo un estado"** (ADR-BE-008). Si el eje logístico es 100 % derivado de las entregas, "en preparación" no tiene dónde guardarse como estado: solo puede derivarse (la sub-decisión 1 lo deriva de "alguna entrega `CREADO`"). Hoy `preparing` es un valor que se setea a mano con `advanceOrderStatus` (`orders.service.ts:383-388`). Con las dos decisiones juntas, nadie puede "poner un pedido en preparación" sin crear una entrega.

   **Resolución (2026-10-08):** **"en preparación" es un valor derivado del eje logístico** (alguna entrega en `CREADO`), no un estado persistido. **No existe una acción manual de "poner en preparación": crear la entrega es empezar a prepararla.** Eso es exactamente lo que ya hacía la sub-decisión 1, así que la contradicción estaba en el texto de ADR-BE-008 ("sigue siendo un estado"), que quedó corregido en esa misma fecha. `advanceOrderStatus` desaparece sin reemplazo manual.
2. **Enmienda ADR-009 y los datos actuales:** ADR-009 verificó que los 6 pedidos del seed tienen entregas en 2 o 3 sucursales (`docs/adr/ADR-009-alcance-dashboard.md`, tabla de reconciliación). Filtrar por sucursal de origen cambia los números del tablero respecto de hoy: cada pedido cuenta en una sola sucursal. No es un error, pero el seed no tiene sucursal de origen y habrá que asignarla.

   **Resolución (2026-10-08):** **el cambio en los números del tablero queda aceptado**: cada pedido cuenta en una sola sucursal, la de origen, y desaparece el doble conteo de ADR-009. **La tanda que conecte pedidos (BE-5) le asigna sucursal de origen al seed**, anotado en el plan de tandas del README.
