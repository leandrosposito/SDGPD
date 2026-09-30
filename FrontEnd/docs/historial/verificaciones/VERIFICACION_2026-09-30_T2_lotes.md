# Verificación — sesión avance-2026-09-30, Tanda 2: editar un producto conserva sus lotes

**Fecha:** 2026-09-30. Cierra `docs/PENDIENTES.md` #13. Checklist para Leandro, en el navegador: nada de esto se abrió en uno durante la sesión.

## Qué cambió

`updateProduct` (`shared/api/products/products.service.ts`) armaba el registro editado con `lotes: []`, así que **editar cualquier producto con lotes los borraba**. Ahora usa `mergeProductUpdate` (`shared/api/products/productUpdate.ts`): conserva los lotes del registro anterior, salvo que el formulario mande `lots` de forma explícita. Hoy `ProductFormModal` nunca los manda, así que en la práctica siempre se conservan.

Gates automáticos: `tsc` 0 errores, lint 0 errores (1 warning preexistente), build OK. Smoke `scripts/smoke/avance-2026-09-30-lotes.smoke.mjs`, 14/14 OK, sobre `inv-001` real del mock (2 lotes).

## Pasos

1. **Precondición:** `/inventario` → Stock Actual. Buscá "Aceite de Girasol 1.5L" (`inv-001`, `ACE-GIR-15`) y hacé click en **"Ver Lotes"** en la columna Acciones.
   - **Esperado:** 2 lotes, `L20251101A` (250 u.) y `L20251215B` (200 u.).
2. **Editar sin tocar lotes:** hacé click en **"Editar"** en la misma fila (visible porque `InventoryPage.tsx:69` fija el rol en `ADMIN`), cambiá el precio (ej. 2100 → 2500) y guardá.
   - **Esperado:** toast de éxito y el precio nuevo en la fila.
3. **El punto central:** volvé a abrir el panel de lotes del mismo producto, **sin F5** (F5 resetea el mock).
   - **Esperado:** siguen los **mismos 2 lotes**, con las mismas cantidades y vencimientos. **Antes de esta tanda**, este panel decía "Este producto no tiene lotes registrados actualmente.": si lo ves así, el fix no funcionó.
4. **Editar dos veces seguidas:** repetí el paso 2 cambiando otro campo (ej. la descripción) y volvé a mirar los lotes.
   - **Esperado:** siguen los 2 lotes. La segunda edición parte del registro ya editado, no del original.
5. **Navegar y volver:** andá a Dashboard y volvé a Inventario, sin F5.
   - **Esperado:** el precio editado y los 2 lotes siguen ahí.
6. **Producto sin lotes (control):** editá un producto que no tenga lotes cargados.
   - **Esperado:** guarda normal, y el panel de lotes sigue vacío (no aparecen lotes de otro producto).
7. **Regresión de validaciones:** intentá guardar una edición con un SKU que ya use otro producto.
   - **Esperado:** error "Este SKU ya existe." y nada cambia (tampoco los lotes).

## No cubierto

- Edición de lotes desde el formulario: no existe UI para eso. El parámetro `editedLots` de `mergeProductUpdate` está preparado para cuando exista (el smoke lo ejercita), pero desde la UI actual no se puede probar.
- El alcance de los lotes (catálogo/empresa vs. sucursal, `PENDIENTES.md` #9) no se tocó: es una decisión de producto fuera de alcance.
