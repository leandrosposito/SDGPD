# Verificación — sesión avance-2026-09-30, Tanda 4: Reposición (residual de Tanda 3f)

**Fecha:** 2026-09-30. Checklist para Leandro en navegador.

## Contexto: qué ya estaba hecho y qué se hizo acá

La tarea pedía "Tanda 3f: migrar Reposición a `api/` con paginación, `empresaId` + `branchId` y joins con `Map`", más resolver el filtro client-side por `branchId` de `InventoryPage.tsx` (AUDITORIA_ESCALABILIDAD B3). Contrastado con el código (ver `docs/historial/auditorias/AUDIT_2026-09-30_avance.md`):

- **Ya hecho en Tanda 3f:** capa `modules/inventory/api/purchase-suggestions/` (dto, mapper, filterSort, service); `getPurchaseSuggestionsPage` paginado server-side con `empresaId` + `branchId` en los filtros (y por lo tanto en la query key); `TabPurchases` con `usePagedQuery` y estado en la URL (`rep_`). **No se tocó.**
- **B3 ya no existe:** `InventoryPage.tsx` no tiene ningún `.filter(` (`grep` da 0). El filtro por sucursal vive en `filterSort.ts` (lado "servidor" del mock).
- **Hecho en esta tanda:** el join sugerencia → producto → proveedor de "Generar OC" (`TabPurchases.tsx`, `handleGenerateOrder`) pasa de 2 `.find()` lineales sobre los catálogos completos a 2 `Map` por id memoizados (`productsById`, `suppliersById`).

Gates: `tsc` 0, lint 0 errores (1 warning preexistente), build OK, los 13 smoke scripts con exit 0, incluido `tanda-3f.smoke.mjs` (paginación y filtro de Reposición, sin cambios). No hay lógica pura nueva que extraer (el cambio es un índice inline en el componente), así que no hay smoke propio.

## Pasos

1. **Generar OC, caso feliz:** `/inventario` → tab **Reposición** → "Generar OC" sobre una sugerencia cuyo producto tenga proveedor válido.
   - **Esperado:** toast de éxito, se crea la orden (visible en `/compras`) y el botón no queda en "Generando...". Es el mismo punto P-03 de `docs/VERIFICACION_PENDIENTE_UNIFICADA.md`.
2. **El proveedor es el correcto:** abrí la OC recién creada en `/compras`.
   - **Esperado:** el proveedor de la OC es el que figura como proveedor del producto en su ficha (Stock Actual → "Editar", campo proveedor). Esto prueba que el lookup por `Map` resuelve el mismo registro que resolvía `.find()`.
3. **Producto sin proveedor válido:** si alguna sugerencia apunta a un producto sin proveedor válido (o editá un producto para dejarlo así), probá "Generar OC".
   - **Esperado:** toast de error "... no tiene un proveedor valido asociado ..." y no se crea ninguna OC.
4. **Cambio de sucursal:** con Reposición abierta, cambiá de sucursal.
   - **Esperado:** cambian las sugerencias (alcance sucursal) y "Generar OC" sigue funcionando en la sucursal nueva.
5. **Producto editado y después Generar OC:** editá un producto (Stock Actual → "Editar", cambiale el nombre), volvé a Reposición y generá una OC para ese producto.
   - **Esperado:** la OC usa el producto actualizado. Los `Map` se recalculan cuando cambia la referencia del catálogo, y editar invalida el catálogo en `InventoryPage`.

## No cubierto

- El caso de ids duplicados en los catálogos (con `.find()` ganaba el primero, con `Map` gana el último). La integridad del mock (ids únicos) se verifica por script en la Fase D (D2) y no se reproduce en el navegador.
