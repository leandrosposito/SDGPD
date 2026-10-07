# Auditoría de entrada — clientes inactivos + deuda de `fetchProducts` (sesión 2026-10-07)

**Verificado contra el filesystem el 2026-10-07**, rama `sesion-clientes-inactivos-2026-10-07` (desde `lean` = `origin/lean` = `be8e1d7`). Regla 2.10: si leés esto después de esa fecha, reverificá los archivo:línea antes de confiar en ellos.

Alcance acotado a las 2 tareas del día. No se re-audita el proyecto.

## Tarea 1 — `ClientAccount.isActive` sin consumidor (migración a medias de Tanda 16)

### Rastreo D1: mock → service → hook → componente

| Capa | Archivo:línea | Qué hace con `isActive` |
|---|---|---|
| Tipo | `src/shared/types/client.types.ts:90` | `isActive: boolean` (obligatorio, Tanda 16) |
| Mock | `src/data/mock/clients.data.ts` | los 30 clientes con `isActive: true` (backfill uniforme) |
| DTO/mapper | `src/modules/clients/api/mapper.ts:61,101,132` | `cuenta.activo` ↔ `isActive`, ida y vuelta |
| Service (lectura catálogo) | `src/modules/clients/api/clients.service.ts:165-173` | `fetchClientsCatalog` → `structuredClone(clientsStore)`, **sin filtrar** |
| Service (listado) | `clients.service.ts:80-87` (`matchesDirectoryFilters`) | no lo mira (ni filtro ni columna) |
| Service (alta pedido) | `src/modules/orders/api/orders.service.ts:284-334` | `createOrder` **no valida el cliente** (ni existencia ni estado) |
| Hook | `CreateOrderModal.tsx:63-68` | `useCachedQuery('clients-catalog')`, `clients = clientsData ?? EMPTY_CLIENTS` sin filtrar |
| Componente selector | `OrderClientSection.tsx:52-53` | filtra solo por texto (nombre/CUIT) |
| Componente listado | `ClientDirectoryTable.tsx` | no muestra el estado |
| Export | `ClientsPage.tsx:59-69` (`DIRECTORY_EXPORT_COLUMNS`) | no exporta el estado |
| Escritura | `ClientSettingsTab.tsx:36-40`, `CreateClientModal.tsx:48,92,138` | se edita, se guarda y se relee (único consumidor real) |

**Hallazgo ALTO-1 (el pedido de la tarea):** un cliente dado de baja sigue en el selector de `CreateOrderModal` y `createOrder` lo acepta. Confirmado: ningún `.isActive` se lee fuera de `create-client/` y del mapper (`grep -rn "isActive" src` → solo esos archivos).

**Hallazgo ALTO-2 (nuevo, encontrado al rastrear el hook):** aunque se filtre el selector, la baja no llegaría a verse en la sesión. `ClientsPage.tsx:162-172` (`handleSaveClient`) hace `refetch()` del Directorio pero **no invalida** `['cached','clients-catalog',empresaId]`, que `CreateOrderModal` cachea con `CACHE_STALE_TIME.CATALOG` = 5 min (`useCachedQuery.ts:51`). Si el usuario da de baja un cliente y abre "Nuevo Pedido" antes de que pasen 5 minutos, el selector usa el catálogo viejo con `isActive: true`. El rechazo server-side lo frenaría igual, pero el filtro del selector no serviría. Es el mismo tipo de hueco que `InventoryPage.tsx:132-149` (`invalidateProductCaches`) cubre para productos.

**Hallazgo MEDIO-3 (mensaje perdido, heredado de Tanda 14):** `createOrder` rechaza un producto inactivo con `throw new ApiError(400, …, 'El producto "X" está dado de baja…')` (`orders.service.ts:298-302`), pero `CreateOrderModal.tsx:170-171` hace `catch { toast.error('No se pudo guardar el pedido.') }` y **descarta el mensaje**. Hoy el usuario no se entera de por qué falló. Si agrego `inactive-client` con el mismo mecanismo, hereda el mismo problema. Además, el resto del proyecto informa los rechazos de negocio con `{ success:false, reason }` (`cancelOrder`, `createPurchaseOrder`, `generatePurchaseOrderFromSuggestion`), no con excepciones. Usar los dos mecanismos dentro de `createOrder` sería otra migración a medias.

### ¿Quedó algún otro booleano de Tandas 14-16 sin consumidor?

`git diff 0891a33 7a02cd7 -- src | grep -E "^\+.*(: boolean|is[A-Z]\w*:|activo)"`: las Tandas 14 y 15 no agregaron ningún campo booleano (son cambios de comportamiento). La Tanda 16 agregó exactamente 2: `isActive` y `deliveryAddressSameAsFiscal`.

**Hallazgo MEDIO-4: `deliveryAddressSameAsFiscal` (+ `deliveryAddress`/`deliveryReferences`) tampoco tiene consumidor.** `grep -rn "deliveryAddressSameAsFiscal\|deliveryAddress\b" src` → solo tipo, DTO, mapper y `CreateClientModal`. `CreateOrderModal.tsx:148` arma el pedido con `clientAddress: selectedClient.address` (la dirección **fiscal**), aunque el cliente tenga una dirección de entrega distinta cargada. Un pedido de un cliente con depósito aparte sale hacia la dirección fiscal. **No se corrige en esta sesión:** qué dirección toma el pedido (y si `OrderDeliverySection` puede sobreescribirla, ver MEDIO-5) es una decisión de producto, no una conexión mecánica como `isActive`. Queda documentado en `PENDIENTES.md`.

**Hallazgo MEDIO-5 (preexistente, se anota al pasar):** `OrderDeliverySection` captura `address/locality/contact/phone` (`CreateOrderModal.tsx:97-101,219-229`) y `buildInput` no los usa: son campos fantasma, el mismo patrón que la Tanda 16 cerró en clientes. Está relacionado con MEDIO-4 y se documenta junto a él.

### Qué está bien y no hay que romper

- `OrderDetailPanel.tsx:104-115` usa el **mismo** `'clients-catalog'` para resolver el cliente de un pedido existente. **El catálogo NO se puede filtrar en el service**: un pedido viejo de un cliente que se dio de baja después tiene que seguir mostrando su cliente. Hay que filtrar en el punto de alta, igual que hizo la Tanda 14 con productos (`CreateOrderModal.tsx:54`).
- `createOrder` ya es el único punto que persiste pedidos (un solo llamador: `CreateOrderModal.tsx:168`), así que cambiar su firma tiene un radio de impacto de un archivo.

## Tarea 2 — `fetchProducts` sin límite dentro de caminos paginados (Tanda 14)

`fetchProducts` (`src/shared/api/products/products.service.ts:88-96`) devuelve el catálogo entero (`productsDTOStore.map(productFromDTO)`), sin `limit` ni filtro. Se llama desde adentro del mock de 4 operaciones del lado del servidor:

| Llamador | Archivo:línea | Camino |
|---|---|---|
| `getActiveProductIds` → `getPurchaseSuggestionsPage` | `purchase-suggestions.service.ts:19-21,65` | listado paginado |
| `getActiveProductIds` → `exportPurchaseSuggestions` | `purchase-suggestions.service.ts:94` | export (tope `MAX_EXPORT_ROWS`, pero el join previo no tiene tope) |
| `createOrder` | `orders.service.ts:298` | alta (valida N ítems contra el catálogo entero) |
| `hasInactiveProduct` → `createPurchaseOrder`/`generatePurchaseOrderFromSuggestion` | `services/mock/purchaseOrders.service.ts:28-32` | alta |

**MEDIO-6:** contradice las reglas 3.1 (listado sin paginar: el join previo trae el catálogo completo) y 3.11 (request sin límite explícito). En el mock no tiene costo real porque son 19 productos en memoria, pero el patrón **está escrito como contrato**: llama a un endpoint HTTP (`GET /products`) desde adentro de otro request, y el día que haya backend esa llamada cruzaría la red con el catálogo entero en cada página de sugerencias. Hay un agravante: como cada `fetchProducts` anidado vuelve a pasar por `httpClient`, también suma latencia simulada y el `VITE_MOCK_FAILURE_RATE` (`httpClient.ts:152-155`) dentro de otro request.

Se suman 2 llamadores del lado del cliente que no forman parte de la tarea pero tienen la misma forma, y entran en el mismo ADR: `fetchProducts` en los combobox (`CreateOrderModal.tsx:46`, `ComprasPage.tsx:195`, `InventoryPage.tsx:89`) y `fetchClientsCatalog` (`clients.service.ts:165`, Tanda 5). Son catálogos enteros para buscar en memoria.

**Decisión de alcance (tarea literal):** documentar como ADR. No se reescribe el mock. **Condición para el código nuevo de esta sesión:** la validación del cliente en `createOrder` **no** puede repetir el patrón. Tiene que ser un lookup de un solo registro por id, no un `fetchClientsCatalog` completo.

## Plan de tandas

| Tanda | Qué | Depende de |
|---|---|---|
| **17** | Predicado único `isClientSelectableForOrder` + `CreateOrderResult` con `reason` (`no-items`/`client-not-found`/`inactive-client`/`inactive-product`; migra también los 2 rechazos de Tanda 14 que hoy son `throw`) + `getClientById` (lookup de 1 registro) + filtro del selector + toast con el motivo real + invalidación de `'clients-catalog'` al guardar un cliente. Cierra ALTO-1, ALTO-2 y MEDIO-3. | — |
| **18** | Estado Activo/Inactivo visible en el Directorio (columna con badge) y en su export. | 17 (mismo predicado) |
| **19** | ADR-015 (filtro de estado server-side, forma del contrato) + `PENDIENTES.md` (MEDIO-4/5/6). Solo documentación. | — |
