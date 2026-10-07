# ADR-015 — Estado activo como precondición de alta: dónde se filtra y cómo se rechaza

**Estado:** Decidido sin consultar (regla 2.9 del protocolo). **Enmendado 2026-10-07b** (ver "Enmienda 2026-10-07b" al final: agrega `product-not-found`, la decisión original no cambia). **Fecha:** 2026-10-07. Generaliza lo que la Tanda 14 hizo para productos sin escribirlo como ADR, y lo aplica a clientes (`ClientAccount.isActive`, Tanda 16). Ver `docs/historial/auditorias/AUDIT_2026-10-07_clientes-inactivos.md`.

## Problema

Dos entidades maestras tienen hoy una baja lógica: `InventoryItem.status: 'active' | 'inactive'` (Tanda 12) y `ClientAccount.isActive` (Tanda 16). En los dos casos la baja se persistió sin que nada la leyera, y la Tanda 14 tuvo que cerrar después la migración a medias de productos. Esta sesión cierra la de clientes. Quedan tres preguntas que ningún ADR responde:

1. ¿Dónde se filtran los inactivos: en el service del catálogo o en el componente de alta?
2. ¿Cómo informa el service el rechazo: con una excepción o con un resultado `{ success:false, reason }`?
3. ¿Cómo se evita que la regla "se puede elegir" quede escrita dos veces, una en la UI y otra en el service?

## Opción elegida

### 1. Se filtra en el punto de alta, no en el catálogo

`fetchClientsCatalog`/`fetchProducts` siguen devolviendo **también** los inactivos, porque tienen otros consumidores que los necesitan:
- `OrderDetailPanel.tsx` resuelve el cliente de un pedido **existente** con el mismo `'clients-catalog'`. Un pedido de un cliente que se dio de baja después tiene que seguir mostrando su cliente.
- `InventoryPage`/`ComprasPage` administran el catálogo de productos, inactivos incluidos.

El filtro vive en el componente de **alta**, con un `useMemo` sobre el dato cacheado (`CreateOrderModal.tsx`, mismo lugar donde la Tanda 14 filtra productos). La caché sigue siendo una sola (`'clients-catalog'`) y no se parte en dos keys.

### 2. El rechazo es un resultado tipado con `reason`, no una excepción

`createOrder` pasa de `Promise<Order>` a `Promise<CreateOrderResult>`:

```ts
type CreateOrderReason = 'no-items' | 'client-not-found' | 'inactive-client' | 'inactive-product'
type CreateOrderResult =
  | { success: true; order: Order }
  | { success: false; reason: CreateOrderReason; detail?: string }
```

Es la misma forma que ya usan `cancelOrder` (`OrderStatusTransitionReason`), `createPurchaseOrder` (`CreatePurchaseOrderReason`) y `generatePurchaseOrderFromSuggestion`. Los dos rechazos que la Tanda 14 había dejado como `throw new ApiError(400, …)` (`no-items`, `inactive-product`) **se migran al mismo mecanismo en la misma tanda**. Si convivieran excepción y `reason` dentro de una misma función, sería la migración a medias de la trampa 6.2. Además, la excepción perdía el mensaje en la UI, porque `CreateOrderModal` hacía `catch { toast.error('No se pudo guardar el pedido.') }`.

`ApiError` queda reservado para fallas de infraestructura (red, timeout, 5xx), que siguen yendo al `catch` genérico.

### 3. Un predicado único, compartido entre UI y service

`shared/utils/orderEligibility.ts` (lógica pura, sin `httpClient`) exporta `isClientSelectableForOrder` y `getCreateOrderBlockReason`. El selector filtra con el primero. `createOrder` decide el rechazo con el segundo, que también usa el primero. Es el mismo patrón que la Tanda 13 usó para `getStopNoVisitadaBlockReason` (`stopVisitEligibility.ts`): una sola definición de "elegible", así UI y servidor no se separan.

### 4. La validación del cliente en `createOrder` es un lookup de un solo registro

`createOrder` valida el cliente con `getClientById(empresaId, clientId)` (1 registro por id), **no** con `fetchClientsCatalog` (catálogo entero). Así no se repite la parte de la deuda de la Tanda 14 que trae el catálogo sin límite (ver ADR-016). **Limitación conocida:** en el mock, `getClientById` pasa por `httpClient`, así que sigue siendo un request anidado dentro de otro. ADR-016 punto 3 lo cuenta dentro de la misma deuda.

### 5. Las mutaciones del maestro invalidan la caché del catálogo

Guardar un cliente (`ClientsPage#handleSaveClient`) invalida `cachedQueryKey({ queryName: 'clients-catalog', empresaId })`. Sin esto, el filtro del punto 1 trabaja hasta 5 minutos (`CACHE_STALE_TIME.CATALOG`) sobre el `isActive` viejo. Es el equivalente de `InventoryPage#invalidateProductCaches` para productos.

## Alternativas descartadas

1. **Filtrar inactivos dentro de `fetchClientsCatalog`.** Rompe `OrderDetailPanel`: un pedido histórico de un cliente dado de baja dejaría de mostrar su cliente.
2. **Agregar un parámetro `soloActivos` a `fetchClientsCatalog` con su propia key de caché.** Funciona, pero duplica el catálogo en caché, y además ADR-016 ya prevé reemplazar estos catálogos completos por búsqueda server-side con `estado=activo`. Agregar ahora una segunda variante del endpoint que se va a reemplazar sería trabajo que se tira.
3. **Mantener `throw ApiError` y leer `err.message` en el `catch`.** Mezcla errores de negocio con errores de red en el mismo canal, el mensaje pasa a ser contrato implícito (texto libre, no tipado) y contradice el patrón `reason` del resto de los services.

## Qué se rompe si se cambia después

- Si un tercer maestro (proveedores, vehículos, choferes, que ya tienen `activo`) gana baja lógica en un punto de alta, tiene que seguir los mismos 5 puntos. Si solo filtra la UI, el server acepta el alta. Si no invalida la caché, el filtro llega tarde.
- Si se filtra en el service del catálogo, `OrderDetailPanel` deja de resolver clientes de pedidos históricos.
- Agregar un `CreateOrderReason` nuevo obliga a tocar `describeCreateOrderReason` (el `switch` es exhaustivo y `tsc` falla si falta un caso).

## Enmienda 2026-10-07b — `product-not-found` (Tanda 21)

`CreateOrderReason` gana `'product-not-found'`: un ítem cuyo SKU no resuelve a ningún producto del catálogo. Antes, `products.find(sku)?.status === 'inactive'` daba `false` con `undefined` y el pedido se persistía con una línea huérfana. La verificación V17 lo demostró contra el código previo: el pedido se creaba y consumía número.

- **Precedencia:** `no-items` → `client-not-found` → `inactive-client` → **`product-not-found`** → `inactive-product`. Un producto que no existe ni siquiera tiene estado, así que preguntar si está inactivo no tiene sentido.
- **`detail`:** `"<nombre>" (<sku>)` del primer ítem ofensor, igual que `inactive-product`.
- **UI:** mismo tratamiento que `inactive-product`. Toast con el texto de `describeCreateOrderReason` e invalidación de `'products'`.
- **Sin cambios** en los puntos 1-5. La validación sigue usando `fetchProducts` completo (deuda de ADR-016): solo cambió la forma de buscar, un `Map` por SKU en vez de un `.find()` anidado.

## Enmienda 2026-10-07

Los rechazos de negocio pasan a **4xx con `{code, message, details?}`** (422 para reglas); el adaptador `http` traduce `code` a la misma unión `{success:false, reason}` que usa la UI — [ADR-BE-004](../../../BackEnd/docs/adr/ADR-BE-004-contrato-http.md).
