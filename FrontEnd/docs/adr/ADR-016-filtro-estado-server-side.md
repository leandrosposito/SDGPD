# ADR-016 — Filtro y validación de estado (activo/inactivo) server-side: contrato objetivo y deuda del mock

**Estado:** Decidido sin consultar (regla 2.9 del protocolo). **Solo documenta: no cambia código.** **Fecha:** 2026-10-07. Verificado contra el código ese día (regla 2.10). Ver `docs/historial/auditorias/AUDIT_2026-10-07_clientes-inactivos.md`, MEDIO-6.

## Problema

La Tanda 14 resolvió "excluir productos inactivos" llamando a `fetchProducts(empresaId)` (`shared/api/products/products.service.ts:88-96`) desde adentro del mock de 4 operaciones del servidor. `fetchProducts` devuelve el catálogo **entero**, sin `limit` ni filtro:

| Operación | Dónde | Para qué usa el catálogo |
|---|---|---|
| `getPurchaseSuggestionsPage` | `purchase-suggestions.service.ts:65` (vía `getActiveProductIds`, `:19-21`) | construir un `Set` de ids activos y filtrar la página |
| `exportPurchaseSuggestions` | `purchase-suggestions.service.ts:94` | ídem, antes de recortar a `MAX_EXPORT_ROWS` |
| `createOrder` | `orders.service.ts` (bloque `fetchProducts` dentro del `mock`) | ver si alguno de los N ítems apunta a un sku inactivo |
| `createPurchaseOrder` / `generatePurchaseOrderFromSuggestion` | `services/mock/purchaseOrders.service.ts:28-32` (`hasInactiveProduct`) | ídem, por `productId` |

Esto contradice dos reglas del protocolo:
- **3.1** (ningún listado se consume sin paginar): el listado paginado de sugerencias depende de una lectura completa del catálogo en cada página.
- **3.11** (todo request tiene un límite explícito): `GET /products` no tiene límite.

En el mock no cuesta nada (19 productos en memoria). Pero el patrón quedó escrito **como contrato**: es una llamada `httpClient` a `GET /products` hecha desde adentro de otro request. Si alguien conecta el adaptador real "tal cual", cada página de sugerencias pediría el catálogo entero por la red. Además, cada llamada anidada vuelve a pasar por `httpClient`, así que suma latencia simulada y `VITE_MOCK_FAILURE_RATE` dentro de otro request: un request de alta puede fallar por la falla simulada del catálogo.

## Opción elegida

### 1. Ninguna operación del servidor consulta el catálogo entero de otro recurso

En el backend real, el estado del producto o del cliente lo resuelve **la propia consulta** del recurso que se pide, con un join o un `WHERE` en la base. Nunca un segundo request HTTP al catálogo. El contrato público de estos endpoints **no gana parámetros**, porque el filtro es parte de la regla de negocio y no una opción del cliente:

| Endpoint | Regla server-side (implícita, no parametrizable) |
|---|---|
| `GET /inventory/purchase-suggestions` y `GET /inventory/purchase-suggestions/export` | solo sugerencias cuyo producto tiene `estado = 'active'` (join en la consulta paginada; el `total` ya viene filtrado) |
| `GET /products/low-stock` (Bajo Stock Mínimo, `filterAndSortLowStock`) | ídem. Este ya lo cumple en el mock: lee `product.estado` del mismo store, sin llamada anidada |
| `POST /orders` | `SELECT … WHERE empresa_id = :e AND sku IN (:skus)`, acotado por la cantidad de ítems del pedido, en la misma transacción que el alta |
| `POST /purchase-orders` y `POST /purchase-orders/from-suggestion` | ídem, por `id IN (:productIds)` |

**Forma del rechazo:** sin cambios respecto de lo que ya existe. `reason: 'inactive-product'` en `CreatePurchaseOrderResult`/`GeneratePurchaseOrderResult`, y en `CreateOrderResult` desde la Tanda 17 (ADR-015). El backend puede sumar `detail` con el sku ofensor; `CreateOrderResult` ya lo prevé.

### 2. Los selectores de alta pasan a búsqueda server-side acotada

El patrón de "combobox con el catálogo completo" (`fetchProducts` en `CreateOrderModal`/`ComprasPage`/`InventoryPage`, `fetchClientsCatalog` en `CreateOrderModal`) se reemplaza, cuando exista backend, por:

```
GET /products/search?empresaId=…&q=<texto>&estado=active&limit=20     (limit máx. 50)
GET /clients/search?empresaId=…&q=<texto>&activo=true&limit=20       (limit máx. 50)
```

Con debounce y `AbortController` (regla 3.6), y la query key incluyendo `companyId` y `q` (regla 3.4). `estado`/`activo` **sí** es parámetro acá: el mismo endpoint sirve a un punto de alta (solo activos) y a una pantalla de administración (todos). En el combobox, el filtro de ADR-015 punto 1 (`useMemo` en el modal) pasa a ser este parámetro. **No cambia** la resolución de entidades ya referenciadas (`OrderDetailPanel` resolviendo el cliente de un pedido viejo): eso es un lookup por id (`GET /clients/:id`, ya existe como `getClientById` desde la Tanda 17), que no filtra por estado.

Esto actualiza la postura de `PENDIENTES.md` ítem 7, que en la Tanda 3e consideró "intencional" el catálogo completo en los dropdowns. Sigue siendo aceptable en el mock. Deja de serlo con backend real, por la regla 3.11.

### 3. El mock NO se reescribe ahora

La tarea pide documentar, y reescribir los 4 mocks no cambia ningún comportamiento observable con 19 productos. Queda como deuda explícita (`PENDIENTES.md` ítem 18), con dos condiciones:
- **Código nuevo no repite el patrón del catálogo completo.** La validación de cliente de la Tanda 17 usa un lookup de un registro (`getClientById`), no `fetchClientsCatalog`, así que cumple 3.11. **Pero sigue siendo una llamada `httpClient` anidada dentro del mock de `createOrder`** (Fase D de la sesión 2026-10-07, hallazgo MEDIO): suma latencia simulada y `VITE_MOCK_FAILURE_RATE` al alta. Se arregla junto con el ítem 18 de `PENDIENTES.md`, con el mismo helper interno sin `httpClient`.
- **Cuando se toque cualquiera de las 4 funciones por otro motivo**, se reemplaza su `fetchProducts` por un lookup acotado sin `httpClient` anidado. Hay dos formas válidas: leer `productsDTOStore` con un helper interno de `products.service.ts` que reciba los ids (`getProductStatusByIds(empresaId, ids)`, con un tope igual a la cantidad de ids pedida), o un endpoint `POST /products/status-lookup { ids }` con `ids.length ≤ 200`.

## Alternativas descartadas

1. **Reescribir ahora los 4 mocks con `getProductStatusByIds`.** Es correcto, pero no fue pedido ("sin reescribir el mock si no hace falta") y toca 3 services de dominios distintos (inventory, orders, compras) sin cambio visible. Queda como la forma prevista del arreglo.
2. **Agregar `?estado=active` a `GET /products` y seguir llamándolo desde los services.** Achica la respuesta, pero sigue sin límite (viola 3.11) y sigue siendo un request anidado. Ataca el síntoma, no el patrón.
3. **Desnormalizar el estado del producto dentro de cada sugerencia u orden.** Duplica un dato que cambia (la baja), y el día que alguien da de baja un producto obliga a propagarlo a todas las copias. Es justo la clase de desincronización que ADR-001/ADR-010 evitan derivando en vez de copiar.

## Qué se rompe si se cambia después

- Si el backend real implementa `GET /products` como lo usa hoy el mock (completo, sin límite) y los services lo siguen llamando anidado, el costo de cada página de sugerencias crece con el catálogo, no con la página. Es el anti-patrón que la regla 3.1 prohíbe.
- Si se agrega un quinto lugar que necesite "solo activos" copiando `getActiveProductIds`, la deuda crece. Cualquier lugar nuevo usa el lookup acotado del punto 3.

## Enmienda 2026-10-07

Ninguna lista queda sin límite: los catálogos de selector pasan a búsqueda acotada con `pageSize` máximo según `contracts` ([ADR-BE-004](../../../BackEnd/docs/adr/ADR-BE-004-contrato-http.md)); la validación de productos en el alta de pedido se hace por **`productId`**, no por SKU ([ADR-BE-007](../../../BackEnd/docs/adr/ADR-BE-007-pedido.md)).
