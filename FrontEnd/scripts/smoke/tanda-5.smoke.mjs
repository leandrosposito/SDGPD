// ============================================================
// Smoke script — Tanda 5 (corrida completa): IDs tipados (ADR-006) y
// relacion Order.clientId -> ClientAccount. Ejercita:
//   1. Parseo valido de cada branded type (as*Id no lanza).
//   2. Parseo invalido que falla explicito (as*Id lanza InvalidIdError).
//   3. Resolucion de la relacion pedido->cliente (caso encontrado y
//      caso no encontrado).
//
// Sin framework de testing: Node 24 ejecuta este archivo directo, con
// type-stripping nativo de TypeScript para los `import type` (se
// eliminan en tiempo de carga, sin transformacion de codigo real) —
// se importan las funciones/tipos reales en vez de duplicar su logica
// aca, para que un cambio real en ids.types.ts/resolveOrderClient.ts
// rompa este script en vez de quedar desincronizado en silencio.
//
// Correr con: node scripts/smoke/tanda-5.smoke.mjs (desde FrontEnd/).
// ============================================================

import {
  asOrderId,
  asBranchId,
  asClientId,
  asOrderLineId,
  InvalidIdError,
} from '../../src/shared/types/ids.types.ts';
import { resolveOrderClient } from '../../src/shared/utils/resolveOrderClient.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

function throws(fn) {
  try {
    fn();
    return false;
  } catch (err) {
    return err instanceof InvalidIdError;
  }
}

// ------------------------------------------------------------
// 1. Parseo valido
// ------------------------------------------------------------
check("asOrderId('ord-001') no lanza y devuelve el valor", asOrderId('ord-001') === 'ord-001');
check("asBranchId('branch-001') no lanza y devuelve el valor", asBranchId('branch-001') === 'branch-001');
check("asClientId('cli-001') no lanza y devuelve el valor", asClientId('cli-001') === 'cli-001');
check("asOrderLineId('oi-101') no lanza y devuelve el valor", asOrderLineId('oi-101') === 'oi-101');

// ------------------------------------------------------------
// 2. Parseo invalido que falla explicito (nunca en silencio)
// ------------------------------------------------------------
check("asOrderId('cli-001') lanza InvalidIdError (id de otro dominio)", throws(() => asOrderId('cli-001')));
check("asOrderId('') lanza InvalidIdError (vacio)", throws(() => asOrderId('')));
check("asOrderId('cualquier-cosa') lanza InvalidIdError (formato ajeno)", throws(() => asOrderId('cualquier-cosa')));
check("asBranchId('sucursal-1') lanza InvalidIdError (prefijo incorrecto)", throws(() => asBranchId('sucursal-1')));
check("asClientId('ord-001') lanza InvalidIdError (id de otro dominio)", throws(() => asClientId('ord-001')));
check("asOrderLineId('ord-001') lanza InvalidIdError (id de pedido, no de linea)", throws(() => asOrderLineId('ord-001')));

// ------------------------------------------------------------
// 3. Resolucion de la relacion Order.clientId -> ClientAccount
// ------------------------------------------------------------
const clients = [
  { id: asClientId('cli-001'), clientName: 'Almacen La Esquina' },
  { id: asClientId('cli-002'), clientName: 'Distribuidora San Martin' },
];

const orderWithMatch = { clientId: asClientId('cli-002') };
const resolved = resolveOrderClient(orderWithMatch, clients);
check(
  'resolveOrderClient encuentra el cliente real cuando existe',
  resolved !== undefined && resolved.clientName === 'Distribuidora San Martin'
);

const orderWithoutMatch = { clientId: asClientId('cli-999') };
const notResolved = resolveOrderClient(orderWithoutMatch, clients);
check('resolveOrderClient devuelve undefined cuando el cliente no esta en la lista', notResolved === undefined);

// ------------------------------------------------------------
if (failures > 0) {
  console.log(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
process.exit(0);
