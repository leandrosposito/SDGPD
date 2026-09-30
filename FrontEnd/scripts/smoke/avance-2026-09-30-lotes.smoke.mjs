// ============================================================
// Smoke script — sesion avance-2026-09-30, Tanda 2 (PENDIENTES.md #13):
// editar un producto ya no descarta sus lotes.
//
// Ejercita la funcion PURA `mergeProductUpdate`
// (shared/api/products/productUpdate.ts) — la misma que llama
// `updateProduct` (products.service.ts), que no corre con `node` puro
// porque pasa por httpClient (lee import.meta.env).
//
// Usa un producto REAL del mock con lotes (inv-001, 2 lotes en
// inventory.data.ts) y el mapper real (productToDTO /
// productFormInputToDTO / productFromDTO), no copias — mismo resolve
// hook de @/ que scripts/verificacion/v14-tanda12-integrity.mjs.
//
// Correr con: node scripts/smoke/avance-2026-09-30-lotes.smoke.mjs
// (desde FrontEnd/).
// ============================================================

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const srcBase = new URL('../../src/', import.meta.url).href;
const loaderSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      let mapped = ${JSON.stringify(srcBase)} + specifier.slice(2);
      if (!/\\.(ts|tsx|js|jsx|mjs|json|css)$/i.test(mapped)) mapped += '.ts';
      return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, pathToFileURL('./'));

const { INVENTORY_MOCK_DATA } = await import('../../src/data/mock/inventory.data.ts');
const { productToDTO, productFromDTO, productFormInputToDTO, productLotToDTO } = await import(
  '../../src/shared/api/products/mapper.ts'
);
const { mergeProductUpdate } = await import('../../src/shared/api/products/productUpdate.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.error(`FAIL ${description}`);
    failures += 1;
  }
}

// ------------------------------------------------------------
// Precondicion: el producto elegido tiene lotes de verdad en el mock.
// ------------------------------------------------------------
const original = INVENTORY_MOCK_DATA.items.find((p) => p.id === 'inv-001');
check('precondicion: inv-001 existe en el mock', original !== undefined);
check('precondicion: inv-001 tiene al menos 1 lote', (original?.lots ?? []).length > 0);

const previousDTO = productToDTO(original);
const lotIdsBefore = previousDTO.lotes.map((l) => l.id).join(',');

// Lo que manda ProductFormModal: los campos del formulario, SIN `lots`
// (mismo shape que productFormDefaultValues + un campo editado).
const { lots: _ignored, id: _id, ...formFieldsWithoutLots } = original;
const formInput = { ...formFieldsWithoutLots, name: 'Aceite de Girasol 1.5L (editado)', price: 2500 };
check('el input simulado del formulario no trae `lots`', !('lots' in formInput));

// ------------------------------------------------------------
// 1. Caso real de la UI: edicion sin `lots` -> se conservan.
// ------------------------------------------------------------
const merged = mergeProductUpdate(previousDTO, productFormInputToDTO(formInput), undefined);
check('edicion sin lots: conserva la misma cantidad de lotes', merged.lotes.length === previousDTO.lotes.length);
check(
  'edicion sin lots: conserva los mismos ids de lote, en el mismo orden',
  merged.lotes.map((l) => l.id).join(',') === lotIdsBefore
);
check('edicion sin lots: aplica el nombre editado', merged.nombre === 'Aceite de Girasol 1.5L (editado)');
check('edicion sin lots: aplica el precio editado', merged.precio === 2500);
check('edicion sin lots: conserva el id del registro anterior', merged.id === 'inv-001');

// Ida y vuelta al dominio: lo que veria ProductLotsPanel.
const asDomain = productFromDTO(merged);
check(
  'dominio: InventoryItem.lots sigue teniendo los lotes (ProductLotsPanel no queda vacio)',
  (asDomain.lots ?? []).length === original.lots.length
);

// ------------------------------------------------------------
// 2. Formulario que SI edita lotes explicitamente -> se usan esos.
// ------------------------------------------------------------
const editedLots = [{ id: 'lot-999', lotNumber: 'L-NUEVO', quantity: 10, expirationDate: '2027-01-01T00:00:00Z' }];
const mergedExplicit = mergeProductUpdate(
  previousDTO,
  productFormInputToDTO(formInput),
  editedLots.map(productLotToDTO)
);
check('lots explicitos: reemplazan a los anteriores', mergedExplicit.lotes.length === 1);
check('lots explicitos: el lote nuevo esta', mergedExplicit.lotes[0].id === 'lot-999');

// `[]` explicito vacia (no se confunde con "no mandado").
const mergedEmpty = mergeProductUpdate(previousDTO, productFormInputToDTO(formInput), []);
check('lots explicitos vacios ([]): vacian los lotes', mergedEmpty.lotes.length === 0);

// ------------------------------------------------------------
// 3. Pureza: no muta el registro anterior.
// ------------------------------------------------------------
check(
  'pureza: el registro anterior no se modifico',
  previousDTO.nombre === original.name && previousDTO.lotes.map((l) => l.id).join(',') === lotIdsBefore
);
check('pureza: el array de lotes devuelto es el mismo (no se clona ni se muta)', merged.lotes === previousDTO.lotes);

if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
