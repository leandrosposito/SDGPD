# Verificación Tanda 21 — `createOrder` rechaza SKUs inexistentes (`product-not-found`)

**Fecha:** 2026-10-07. `PENDIENTES.md` ítem 19, parte validación. Enmienda de ADR-015 ("Enmienda 2026-10-07b").

## Qué cambió

- `shared/utils/orderEligibility.ts`: `CreateOrderReason` gana `'product-not-found'`, y `getCreateOrderBlockReason` recibe `hasUnknownProduct`. La precedencia queda `no-items` → `client-not-found` → `inactive-client` → `product-not-found` → `inactive-product`. Hay texto nuevo en `describeCreateOrderReason` (el `switch` es exhaustivo: sin el `case`, `tsc` falla).
- `orders.service.ts#createOrder`: arma un `Map` SKU → estado con el catálogo (antes era un `.find()` anidado por ítem) y detecta el primer ítem desconocido y el primer inactivo. El `detail` es el del ítem que corresponde al motivo ganador.
- `CreateOrderModal.tsx`: `product-not-found` invalida `'products'`, igual que `inactive-product`.

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b` | exit 0 |
| 2 `eslint .` | 0 errores, 1 warning preexistente |
| 3 `vite build` | `✓ built in 1.12s` |
| 4 smoke | `tanda-21.smoke.mjs`: 10 OK, exit 0. Los 26 scripts (smoke + verificación) dan exit 0 |
| 5 conexión | no hay funciones exportadas nuevas. El motivo nuevo llega a la UI por el `result.reason` que ya consume `CreateOrderModal` |
| 6 autorrevisión | sin `any`/`as`/`@ts-ignore`. No hay lecturas nuevas: reusa el `fetchProducts` que ya existía (deuda de ADR-016, sin agravar) |
| 8 arquitectura | sin cambios de estructura |

**V17, 3 checks nuevos, y prueba de que detectan el bug:** corrí el V17 nuevo contra el código **anterior** a esta tanda (worktree en `69ac78a`). Resultado: `FAIL sku inexistente: reason product-not-found…`, `FAIL sku inexistente: no llego al alta (no consumio numero) (PED-000394 -> PED-000396)` y `FAIL … gana product-not-found`, exit 1. O sea: antes, el pedido con un SKU fantasma **se persistía** (consumió `PED-000395`). Con el fix: los 3 OK, exit 0.

## Qué verificar en el navegador

No hay forma directa de provocarlo desde la UI. El buscador y el escáner de `OrderProductsSection` solo agregan productos del catálogo. Lo más cercano:

1. Abrir "Nuevo Pedido" y agregar un producto. En otra parte de la app **no hay** borrado físico de productos (la baja es lógica), así que el SKU no puede desaparecer del catálogo. **Esperado:** el caso no es reproducible desde la UI hoy, y la cobertura es V17 + smoke.
2. Regresión: un alta de pedido normal sigue funcionando (toast de éxito, el pedido aparece en el listado).
3. Regresión de la Tanda 17, punto 3: un producto dado de baja con el modal abierto sigue dando el toast de `inactive-product` con el nombre del producto, y **no** el de "no existe".

## Qué NO se verificó

- Nada en el navegador.
- El texto exacto del toast de `product-not-found`: lo cubre el smoke, no se vio en pantalla.
