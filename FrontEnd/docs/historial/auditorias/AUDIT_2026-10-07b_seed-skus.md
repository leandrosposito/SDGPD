# Auditoría de entrada — SKUs huérfanos del seed + `product-not-found` (sesión 2026-10-07b)

**Verificado contra el filesystem el 2026-10-07**, rama `sesion-seed-skus-2026-10-07` (desde `lean` = `origin/lean` = `84e2af7`). Regla 2.10: si leés esto después de esa fecha, reverificá los archivo:línea antes de confiar en ellos.

## Tarea 1 — `PENDIENTES.md` ítem 19: 5 líneas del seed con SKU inexistente

`src/data/mock/orders.data.ts`:

| Línea | Pedido/línea | SKU actual | Existe en `inventory.data.ts` |
|---|---|---|---|
| 29 | `ord-001`/`oi-102` | `YER-TAR-1K` "Yerba Taragui 1kg" | no |
| 30 | `ord-001`/`oi-103` | `GAL-SUR-200` "Galletitas Surtidas 200g" | no |
| 83 | `ord-003`/`oi-301` | `GAL-SUR-200` | no |
| 112 | `ord-004`/`oi-402` | `GAL-SUR-200` | no |
| 167 | `ord-006`/`oi-601` | `YER-TAR-1K` | no |

**Mapeo elegido:**
- `YER-TAR-1K` → `YER-MAT-1K` ("Yerba Mate 1kg Paquete", `inv-002`). Misma presentación (1 kg), mismo precio de venta que la línea (3600) y mismo costo que el proveedor que la lista (`suppliers.data.ts:44`, `sp-201`, costo 2800).
- `GAL-SUR-200` → `GAL-AGU-200` ("Galletitas de Agua 200g", `inv-005`). Es el único 200 g de galletitas del catálogo.

**Qué se cambia en cada línea:** `sku` y `name`. **No se cambian** `quantity`, `unitPrice` ni `subtotal`. Hay precedente en el mismo seed de que la línea es una foto del momento del pedido y no un espejo del catálogo: `oi-101` dice "Aceite Girasol 1.5L" y el catálogo "Aceite de Girasol 1.5L". Tocar `unitPrice` (450 → 420 en galletitas) arrastraría `subtotal`, `subtotal`/`tax`/`totalAmount` del pedido y lo que derive de ellos (tablero, saldos), para corregir algo que no está roto.

**Qué no se rompe:** ningún consumidor resuelve una línea de pedido por `sku` contra el catálogo (`grep -rn "\.sku" src`: solo mappers y `OrderProductsSection`, que trabaja sobre ítems nuevos). `logistics.data.ts` referencia pedidos por `orderId`, no por sku. Los `OrderLineId` (`oi-102`…) no cambian, así que los remitos y entregas siguen resolviendo.

**Hallazgos al pasar (mismo dato huérfano, fuera de lo pedido: se documentan, no se tocan):**
- **MEDIO:** `analytics.data.ts:25-26,54-55,84-85,121-122` usa `YER-TAR-1K`/`GAL-SUR-200` en los rankings de productos. `analytics` no tiene capa de service (ALTO abierto en `ESTADO.md`) y es un dataset estático sin relación con el catálogo.
- **BAJO:** `suppliers.data.ts:44,64` lista esos SKUs en el catálogo **del proveedor**. Puede ser legítimo (el proveedor vende cosas que no tenemos dadas de alta), pero no hay regla que lo diga.
- **MEDIO:** `alerts.data.ts:21,23`: `alr-005` dice `productName: 'Yerba Taragui 1kg'` con `productId: 'inv-013'` (Papel Higiénico), y `alr-003` dice "Galletitas Surtidas 200g" con `inv-009` (Arroz). El id resuelve, pero el nombre denormalizado no coincide con el producto.

## Tarea 2 — `createOrder` acepta un SKU desconocido

`orders.service.ts:314`: `products.find((p) => p.sku === item.sku)?.status === 'inactive'`. Si el SKU no existe, `find` devuelve `undefined`, la comparación da `false` y el ítem pasa. Un pedido nuevo puede persistirse con una línea que no resuelve a ningún producto, que es exactamente la clase de dato que la Tarea 1 está limpiando del seed.

**Plan:** nuevo `CreateOrderReason = 'product-not-found'`, con `detail` = el SKU, texto en `describeCreateOrderReason` (el `switch` exhaustivo hace fallar a `tsc` si falta) y precedencia **antes** de `inactive-product`. Un producto que no existe ni siquiera tiene estado. Es una enmienda de ADR-015 (amplía su conjunto de motivos), no una decisión nueva.

## Plan de tandas

| Tanda | Qué | Depende de |
|---|---|---|
| **20** | Dato: las 5 líneas de `orders.data.ts`. V17 tiene que quedar en verde **sin tocar su D2.3**. | — |
| **21** | `product-not-found` en `orderEligibility.ts` + `createOrder` + toast/invalidación en `CreateOrderModal` + smoke + check nuevo en V17. Enmienda de ADR-015. | 20 (V17 tiene que estar verde para que el check nuevo signifique algo) |
