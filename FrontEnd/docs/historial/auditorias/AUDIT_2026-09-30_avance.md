# Auditoría de entrada (Fase A) — sesión `avance-2026-09-30`

**Verificado contra el filesystem y el código:** 2026-09-30, rama `sesion-avance-2026-09-30` (derivada de `lean` en `0891a33`, tag `pre-avance-2026-09-30`). Cada afirmación estructural de abajo vale para esa fecha (regla 2.10).

**Alcance:** solo lo que tocan las 6 tareas pedidas. No se re-audita el proyecto.

## Hallazgo de entrada principal: 3 de las 6 tareas ya estaban resueltas en `lean`

El pedido describe como pendientes cosas que `docs/ESTADO.md` ya da por cerradas. Antes de implementar nada se contrastó cada una con el código:

| Tarea | Estado real hoy | Evidencia |
|---|---|---|
| 3. Botón "Editar" en Proveedores (PENDIENTES #1) | **Ya hecha** (Tanda 12, 2026-09-10) | `SupplierDetailPanel.tsx:244-245`, botón "Editar" con `onClick={onEdit}`; `SuppliersPage.tsx:255` `onEdit={handleEditSelectedSupplier}`; PENDIENTES #1 dice "CERRADO (Tanda 12)". La tabla resumen de PENDIENTES todavía decía "Vigente": es una inconsistencia del doc, no del código. |
| 4. Tanda 3f: Reposición a `api/` + paginación + `empresaId`/`branchId` | **Ya hecha en lo principal** (Tanda 3f) | `modules/inventory/api/purchase-suggestions/{dto,mapper,filterSort,purchase-suggestions.service}.ts`; `getPurchaseSuggestionsPage` recibe `empresaId`+`branchId` en `filters` (`purchase-suggestions.service.ts:30-33`); `TabPurchases.tsx:93` usa `usePagedQuery`. **Pendiente real:** los 2 `.find()` de `TabPurchases.tsx:122,128`. |
| 4b. Filtro client-side por `branchId` en `InventoryPage.tsx` (AUDITORIA_ESCALABILIDAD B3) | **Ya no existe** | `grep -n "filter(" src/modules/inventory/InventoryPage.tsx` da 0 resultados. El único `.find` (`:80`) resuelve el nombre de la sucursal activa desde `session.branches`: no filtra datos de negocio. |
| 5. Code-splitting por ruta + ErrorBoundary por ruta | **Ya hecha** (Tanda 10A, ADR-012) | `AppRoutes.tsx:17-57`, 13 páginas con `lazy()`; `AppShell.tsx:49-64`, `<ErrorBoundary resetKey={location.pathname}>` que envuelve `<Suspense>` + `<Outlet/>`. Es un boundary que se resetea en cada cambio de ruta, o sea que cumple la función de "uno por ruta". Además hay un boundary global en `AppRoutes.tsx:69`. |

Consecuencia: esas tareas **no se reimplementan**. Se re-verifican, se documenta la evidencia y se hace solo lo que realmente faltaba (los `.find()` de Tanda 4 y la medición de bundle de Tanda 5).

## Hallazgos dentro del alcance

| # | Sev. | Archivo:línea | Hallazgo |
|---|---|---|---|
| F1 | MEDIO | `shared/api/products/products.service.ts:141` (antes del fix) | `updateProduct` arma `{ ...form, id, lotes: [] }`, así que editar un producto con lotes los borra (PENDIENTES #13). La edición llega desde `InventoryPage.tsx:156`. |
| F2 | BAJO | `modules/inventory/components/TabPurchases.tsx:122,128` | Join sugerencia→producto→proveedor con 2 `.find()` lineales sobre los catálogos completos en cada click de "Generar OC". |
| F3 | BAJO | `docs/PENDIENTES.md` (tabla resumen) | El ítem 1 figura "Vigente" en la tabla aunque su sección dice "CERRADO". Además, la tabla no lista el ítem 15. |
| F4 | INFO | `docs/historial/verificaciones/VERIFICACION_TANDA_0_1.md` #1 | La instrucción cita `OrdersPage.tsx` línea 54 y `useState<Order[]>(ORDERS_MOCK_DATA)`, y los dos quedaron viejos (hoy el componente arranca en la `:69` y usa el service). `VERIFICACION_TANDA_3A.md` #6 dice "Cancelar funciona siempre", y eso cambió con Tandas 9 y 12. Se corrige en el checklist unificado, sin tocar los originales. |

## Qué está bien y no hay que romper

- `ProductFormModal` arma los valores con `productFormDefaultValues` campo por campo (`ProductFormModal.schema.ts:105-131`), sin `lots`, y `z.object` descarta claves extra. El fix de F1 puede apoyarse en "`input.lots === undefined` ⇒ el formulario no los editó".
- `productsDTOStore` se reemplaza de forma inmutable (`.map` a un array nuevo). El fix mantiene ese patrón.
- Los catálogos `products` y `suppliers` de `TabPurchases` vienen por props sin paginar **a propósito** (PENDIENTES #7: son para dropdowns y joins). Pasarlos a `Map` no cambia ese contrato.
- ADR-012: el `Suspense` vive en `AppShell` y no alrededor de `<Routes>`. No se mueve.

## Hallazgos previos (`AUDIT_00_RESUMEN` / ESTADO) que caen en el alcance

- AUDIT_8 #1/#2 (bundle único): cerrado en Tanda 10A. Se re-mide en esta sesión.
- AUDIT_2 #1, AUDIT_3 #1, AUDIT_14 #5 (Reposición sin service ni paginación): cerrados en Tanda 3f.
- Ningún ALTO abierto de ESTADO.md (analytics sin service, Money fuera del dashboard, impuesto sin redondeo, formularios sin Zod) cae en el alcance de estas tareas.

## Choques con "fuera de alcance / decisión de producto"

- Tarea 2 (lotes) vs "Mover ProductLot a alcance sucursal (PENDIENTES #9)": **no choca**. El fix conserva los lotes donde ya viven (catálogo, alcance empresa) y no cambia su modelo ni su alcance.
- Tarea 6 (auditoría IAM/notificaciones) vs "Multi-empresa por usuario": la auditoría **describe** el estado de `SessionUser.company` (singular) sin proponer ni elegir modelo.
- Ninguna otra tarea toca los puntos listados como fuera de alcance.

## Plan de tandas (en el orden del pedido)

1. **T1:** checklist unificado (`docs/VERIFICACION_PENDIENTE_UNIFICADA.md`), solo docs.
2. **T2:** fix de F1. Pure function `mergeProductUpdate` + conexión en `updateProduct` + smoke con `inv-001`.
3. **T3:** sin cambios de código (ya hecha). Solo re-verificación documentada en el reporte y corrección de F3.
4. **T4:** fix de F2 (`Map` memoizados en `TabPurchases`).
5. **T5:** sin cambios de código (ya hecha). Medición del bundle antes y después (antes = tag `pre-avance-2026-09-30`, después = cierre de sesión).
6. **T6:** auditoría IAM/notificaciones, solo docs.
