# Verificación Tanda 14 — Productos `inactive` en pedidos/OC/reposición (migración a medias de Tanda 12)

**Fecha:** 2026-09-11. Hallazgo reportado por Leandro (Tanda 12 dio de baja lógica a `deleteProduct`, pero nada más en el proyecto trataba `status: 'inactive'` como algo que excluir).

## Qué cambió

- `CreateOrderModal.tsx`: el catálogo que llega a `OrderProductsSection` (buscador/scanner) se filtra a `status === 'active'` antes de pasarse — el catálogo completo (con inactivos) lo sigue usando `InventoryPage` para administración.
- `PurchaseOrderFormModal.tsx`: el buscador de productos (`productMatches`) excluye inactivos — `products` completo se sigue usando en `ComprasPage` para resolver nombres de líneas de OCs ya existentes.
- `orders.service.ts#createOrder`: rechaza server-side (`ApiError 400`, mensaje propio) si algún ítem del pedido referencia (por `sku`) un producto inactivo.
- `purchaseOrders.service.ts#createPurchaseOrder`/`generatePurchaseOrderFromSuggestion`: rechazan (`reason: 'inactive-product'`) si alguna línea referencia (por `productId`) un producto inactivo.
- `products.service.ts#filterAndSortLowStock`: excluye productos inactivos — cierra Bajo Stock Mínimo Y su KPI (`totalItems` de la paginación), son la misma fuente.
- `purchase-suggestions/filterSort.ts` + `purchase-suggestions.service.ts`: `filterAndSortPurchaseSuggestions` gana un parámetro opcional `activeProductIds`; el service lo resuelve "servidor a servidor" contra `fetchProducts` antes de filtrar/exportar — cierra las Sugerencias de Reposición (`TabPurchases.tsx`).
- **Sin cambios, a propósito:** `computeStockAggregates`/`getStockedProductsPage` (Stock Actual) — sigue mostrando TODO con su badge ACTIVO/INACTIVO (es una foto literal del inventario, no una lista accionable) — decisión documentada abajo.

## Qué verificar en el navegador

1. **Dar de baja un producto.** `/inventario` → Stock Actual → elegir un producto con stock (ej. cualquiera de branch-001) → "Eliminar" (baja lógica, `deleteProduct`) → confirmar que queda con badge INACTIVO en la misma tabla, sin desaparecer de la lista.
2. **Selector de Pedido.** `/pedidos` → Nuevo Pedido → en el buscador de productos, escribir el SKU/nombre del producto recién dado de baja — no debe aparecer ni por SKU, ni por nombre, ni por código de barras (scanner).
3. **Selector de OC.** `/compras` → Nueva Orden de Compra → buscador de productos — el mismo producto no debe aparecer en las sugerencias del buscador.
4. **Bajo Stock Mínimo.** `/inventario` → Bajo Stock Mínimo — si el producto dado de baja tenía stock por debajo del mínimo, ya no debe aparecer en la lista, y el contador de la cabecera (`N productos`) debe reflejar un producto menos que antes de la baja.
5. **Sugerencias de Reposición.** `/inventario` → Reposición — si el producto dado de baja tenía una sugerencia activa para la sucursal actual, ya no debe aparecer.
6. **Stock Actual sin cambios.** `/inventario` → Stock Actual — el producto dado de baja SIGUE apareciendo en la lista y en el KPI "Stock Bajo"/"Sin Stock" si corresponde (no se excluyó de acá a propósito) — confirmar que esto es intencional, no un olvido.
7. **Rechazo server-side (defensa en profundidad).** No hay forma directa de forzar esto desde la UI ya filtrada — cubierto por lectura de código (`createOrder`/`createPurchaseOrder`/`generatePurchaseOrderFromSuggestion`) y por el hecho de que ambos puntos de creación son el único lugar que persiste, así que cualquier futuro selector que se agregue y olvide filtrar queda igual cubierto.

## Qué NO se verificó

- El camino de rechazo server-side (punto 7) no se ejercitó en vivo — la UI ya filtrada no permite construir el caso sin manipular el estado a mano (ej. añadir el ítem al formulario antes de que el catálogo se refresque). Cubierto por lectura de código, no por click real.
- No se verificó qué pasa si un producto se da de baja MIENTRAS un pedido/OC ya está abierto en otra pestaña con ese producto ya agregado a la lista de líneas (condición de carrera de UI) — el rechazo server-side sigue protegiendo el dato, pero la UX de ese caso puntual no se probó.

## Decisiones tomadas sin consultar (regla 2.9)

- **Stock Actual NO excluye productos inactivos (ni de la lista ni de sus KPIs).** Es la única vista de las tocadas que se dejó sin cambios — se trata como una foto literal del inventario físico (ya mostraba el badge ACTIVO/INACTIVO desde Tanda 12), mientras que Bajo Stock Mínimo/Sugerencias son listas ACCIONABLES ("qué hay que reponer"), donde un producto discontinuado no aplica. Es la interpretación más consistente con el propio texto del hallazgo ("Stock Actual los sigue mostrando con su badge").
- **`generatePurchaseOrderFromSuggestion` también rechaza inactivos**, aunque el hallazgo original solo nombraba `createOrder`/`createPurchaseOrder` — se encontró al rastrear el camino completo (D1): es el otro punto que persiste una línea de OC (desde "Generar OC" en Sugerencias de Reposición), mismo patrón, mismo riesgo si algún día un selector nuevo no filtra.
- **`filterAndSortPurchaseSuggestions` no exige `activeProductIds`** (parámetro opcional, `undefined` = sin filtrar) — para no romper `scripts/smoke/tanda-3f.smoke.mjs`, que la ejercita sin ese parámetro. El camino real (`purchase-suggestions.service.ts`) siempre lo pasa; `undefined` solo ocurre en el smoke script de Tanda 3f.
