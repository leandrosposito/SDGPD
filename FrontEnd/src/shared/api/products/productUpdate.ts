import type { ProductDTO, ProductLotDTO, ProductPayloadDTO } from './dto';

// ============================================================
// productUpdate.ts (products) — Arma el registro resultante de editar
// un producto (sesion avance-2026-09-30, cierra PENDIENTES.md #13).
//
// Antes, `updateProduct` reemplazaba el registro con los campos del
// formulario + `id` + `lotes: []`: editar cualquier producto con lotes
// los dejaba vacios. Regla: los lotes del registro anterior se
// conservan SALVO que el formulario los mande explicitamente
// (`editedLots !== undefined`). Hoy `ProductFormModal` nunca los manda
// (`ProductFormValues` no tiene `lots`), asi que en la practica
// siempre se conservan — el parametro queda para el dia que el
// formulario los edite, sin que ese cambio tenga que volver a tocar
// esta regla. `[]` explicito SI vacia los lotes: "no mandado" y
// "mandado vacio" no son lo mismo.
//
// Funcion pura (sin httpClient, que lee import.meta.env) para poder
// ejercitarla desde un smoke script con `node` — mismo criterio que
// `shared/utils/lotExpiration.ts` (Tanda 12).
// ============================================================

export function mergeProductUpdate(
  previous: ProductDTO,
  payload: ProductPayloadDTO,
  editedLots?: ProductLotDTO[]
): ProductDTO {
  return {
    ...payload,
    id: previous.id,
    lotes: editedLots ?? previous.lotes,
  };
}
