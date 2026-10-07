# Verificación Tanda 17 — Clientes dados de baja fuera del alta de pedidos (ADR-015)

**Fecha:** 2026-10-07. Cierra la migración a medias de la Tanda 16: `ClientAccount.isActive` se guardaba y se editaba, pero ningún consumidor lo leía. Hallazgos ALTO-1, ALTO-2 y MEDIO-3 de `docs/historial/auditorias/AUDIT_2026-10-07_clientes-inactivos.md`.

## Qué cambió

- **`shared/utils/orderEligibility.ts` (nuevo):** predicado único `isClientSelectableForOrder`, `getCreateOrderBlockReason` (motivos en orden de precedencia: `no-items` → `client-not-found` → `inactive-client` → `inactive-product`) y `describeCreateOrderReason` (texto del toast, `switch` exhaustivo).
- **`clients.service.ts#getClientById` (nuevo):** lookup de un solo cliente por id. Devuelve `null` si recibe un 404. A propósito no usa `fetchClientsCatalog` (ADR-016).
- **`orders.service.ts#createOrder`:** pasa de `Promise<Order>` a `Promise<CreateOrderResult>` (`{success:true, order}` | `{success:false, reason, detail?}`). Valida el cliente server-side. Los 2 rechazos de la Tanda 14 que eran `throw ApiError(400)` (`no-items`, `inactive-product`) se migran a `reason` en la misma tanda, así no conviven los dos mecanismos. Si el cliente es inválido, ya no se pide el catálogo de productos.
- **`CreateOrderModal.tsx`:** el selector filtra con `isClientSelectableForOrder` (`useMemo`, igual que el filtro de productos de la Tanda 14). Ante un rechazo, el toast muestra el motivo real (antes decía siempre "No se pudo guardar el pedido."). Si el rechazo es por cliente, limpia la selección e invalida `'clients-catalog'`. Si es por producto, invalida `'products'`.
- **`ClientsPage.tsx#handleSaveClient`:** además del `refetch()` del Directorio, invalida `'clients-catalog'` (ALTO-2: antes la baja tardaba hasta 5 minutos en llegar al selector).
- **`docs/ARQUITECTURA.md`:** el renglón de `shared/utils/` decía 6 utilidades y hay 13 (gate 8).

## Gates

| Gate | Resultado |
|---|---|
| 1 `tsc -b` | exit 0 (línea base: 0 errores) |
| 2 `eslint .` | 0 errores, 1 warning (`react-hooks/incompatible-library`, preexistente, idéntico a la línea base) |
| 3 `vite build` | `✓ built in 4.63s` |
| 4 smoke | `node scripts/smoke/tanda-17.smoke.mjs` → 14 `OK`, exit 0 |
| 5 conexión | `isClientSelectableForOrder` y `describeCreateOrderReason` → `CreateOrderModal.tsx`. `getCreateOrderBlockReason` y `getClientById` → `createOrder` (mock del servidor), al que llama `CreateOrderModal.tsx#handleConfirm`. **Llegan a la UI de forma transitiva, sin un call-site directo en un componente**: es lógica server-side por diseño. Se marca como decisión en el informe. |
| 6 autorrevisión | sin `any`/`as`/`@ts-ignore` en el diff. Todo service nuevo recibe `empresaId`. Las 2 invalidaciones usan `cachedQueryKey({queryName, empresaId})`. No se agregó ninguna lectura sin límite (el lookup del cliente es de un registro). |
| 8 arquitectura | `ARQUITECTURA.md` actualizado (ver arriba) |

## Qué verificar en el navegador (en orden de riesgo)

**Preparación:** el seed no tiene clientes inactivos (los 30 tienen `isActive: true`). Hay que dar uno de baja a mano.

1. **La baja llega al selector sin esperar 5 minutos (ALTO-2).** `/pedidos` → "Nuevo Pedido" → abrir el selector de cliente y confirmar que aparece "Almacen La Esquina" (esto carga la caché) → cerrar. Ir a `/clientes` → editar "Almacen La Esquina" → tab Ajustes → "Cliente Inactivo" → Guardar. Volver **enseguida** a `/pedidos` → "Nuevo Pedido" → buscar "Almacen". **Esperado:** no aparece.
2. **Rechazo server-side (ALTO-1).** Con un cliente activo elegido en "Nuevo Pedido" y el modal abierto, en otra pestaña dar de baja ese mismo cliente. Volver, cargar un producto y confirmar. **Esperado:** toast rojo "El cliente elegido esta dado de baja y no puede recibir pedidos nuevos.", el selector de cliente se vacía, el pedido **no** aparece en el listado. *(El mock vive en memoria por pestaña: si las dos pestañas no comparten el store, este paso no se puede reproducir así. En ese caso alcanza con el paso 3 como evidencia de que el rechazo funciona.)*
3. **El motivo de producto inactivo ahora se ve (MEDIO-3).** Repetir el paso 2 con un producto: elegirlo en el pedido y darlo de baja en `/inventario` antes de confirmar. **Esperado:** toast con el nombre y SKU del producto (antes: "No se pudo guardar el pedido.").
4. **Pedidos históricos de un cliente dado de baja.** Con "Almacen La Esquina" inactivo (paso 1), abrir en `/pedidos` el detalle de `PED-00391` (es de ese cliente). **Esperado:** sigue mostrando el cliente. El filtro no se aplica al catálogo, solo al alta.
5. **Reactivar.** Volver a marcarlo "Cliente Activo" → Guardar → "Nuevo Pedido" → vuelve a aparecer.
6. **Regresión: alta normal.** Pedido con un cliente activo y productos activos → toast "Pedido guardado con exito!" y el pedido aparece en el listado.

## Qué NO se verificó

- Nada de esto se abrió en un navegador: la verificación fue estática (gates + smoke + lectura de código).
- El escenario de dos pestañas del paso 2 depende de si el store en memoria del mock se comparte entre pestañas (no se comparte: cada pestaña es un proceso JS con su propio módulo). El rechazo server-side se reproduce de forma confiable cuando la caché del modal quedó vieja **dentro de la misma pestaña**, y eso es justo lo que la invalidación de ALTO-2 hace difícil de provocar. Queda cubierto por el smoke (lógica pura) y por la lectura del código de `createOrder`.
- `deliveryAddressSameAsFiscal` (el otro booleano de la Tanda 16 sin consumidor) queda fuera de alcance, documentado en `PENDIENTES.md` (ver Tanda 19).
