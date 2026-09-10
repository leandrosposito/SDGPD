// ============================================================
// V12 (verificacion adversarial de Tanda 10B, ADR-011) — integridad
// referencial de los mocks nuevos de la capa operativa de logistica.
// Importa los mocks reales (mismo resolve hook de @/ que
// v11-referential-integrity.mjs, no se reimplementan los datos).
//
// Relaciones verificadas:
//   1. Viaje -> vehiculo (Trip.vehicleId existe en VEHICLES_MOCK_DATA).
//   2. Viaje -> chofer (Trip.driverId existe en DRIVERS_MOCK_DATA).
//   3. Viaje -> sucursal (Trip.branchId existe en session.branches).
//   4. Parada -> entregas (Stop.deliveryIds existen en LOGISTICS_MOCK_DATA,
//      el dataset REAL de Delivery de Tanda 9 — no una copia).
//   5. Minimos de mock pedidos por la tarea: >=4 vehiculos, >=3
//      choferes, >=2 viajes con >=2 paradas multi-pedido cada uno, al
//      menos un vehiculo refrigerado y uno con zona restringida.
//
// Correr con: node scripts/verificacion/v12-trips-referential-integrity.mjs
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

const { TRIPS_MOCK_DATA } = await import('../../src/data/mock/trips.data.ts');
const { VEHICLES_MOCK_DATA } = await import('../../src/data/mock/vehicles.data.ts');
const { DRIVERS_MOCK_DATA } = await import('../../src/data/mock/drivers.data.ts');
const { LOGISTICS_MOCK_DATA } = await import('../../src/data/mock/logistics.data.ts');
const { SESSION_MOCK_DATA } = await import('../../src/data/mock/session.mock.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const vehicleIds = new Set(VEHICLES_MOCK_DATA.map((v) => v.id));
const driverIds = new Set(DRIVERS_MOCK_DATA.map((d) => d.id));
const branchIds = new Set(SESSION_MOCK_DATA.branches.map((b) => b.id));
const deliveryIds = new Set(LOGISTICS_MOCK_DATA.map((d) => d.id));

console.log(`Vehiculos: ${vehicleIds.size} | Choferes: ${driverIds.size} | Viajes: ${TRIPS_MOCK_DATA.length} | Entregas (Tanda 9): ${deliveryIds.size}`);
console.log('');

console.log('--- Minimos de mock pedidos por la tarea ---');
check('TRIPS_MOCK_DATA tiene al menos 2 viajes sembrados', TRIPS_MOCK_DATA.length >= 2);
check('VEHICLES_MOCK_DATA tiene al menos 4 vehiculos', VEHICLES_MOCK_DATA.length >= 4);
check('DRIVERS_MOCK_DATA tiene al menos 3 choferes', DRIVERS_MOCK_DATA.length >= 3);
check('al menos un vehiculo es refrigerado', VEHICLES_MOCK_DATA.some((v) => v.capacidad.refrigerado));
check('al menos un vehiculo tiene zona restringida (< 3 zonas)', VEHICLES_MOCK_DATA.some((v) => v.capacidad.zonasHabilitadas.length < 3));

console.log('');
console.log('--- Viajes: relacion a vehiculo, chofer, sucursal y entregas ---');
for (const trip of TRIPS_MOCK_DATA) {
  check(`${trip.id}: vehicleId "${trip.vehicleId}" existe en VEHICLES_MOCK_DATA`, vehicleIds.has(trip.vehicleId));
  check(`${trip.id}: driverId "${trip.driverId}" existe en DRIVERS_MOCK_DATA`, driverIds.has(trip.driverId));
  check(`${trip.id}: branchId "${trip.branchId}" existe en sucursales`, branchIds.has(trip.branchId));
  check(`${trip.id}: tiene al menos 2 paradas (multi-pedido pedido por la tarea)`, trip.paradas.length >= 2);
  for (const stop of trip.paradas) {
    check(`${trip.id}/${stop.id}: tiene al menos 1 deliveryId`, stop.deliveryIds.length >= 1);
    for (const deliveryId of stop.deliveryIds) {
      check(`${trip.id}/${stop.id}: deliveryId "${deliveryId}" existe en LOGISTICS_MOCK_DATA (Tanda 9, dataset real)`, deliveryIds.has(deliveryId));
    }
  }
}

console.log('');
console.log('--- Estados sembrados (para ejercitar la UI sin depender de una transicion manual primero) ---');
check('al menos un viaje esta EnTransito con posicionActual', TRIPS_MOCK_DATA.some((t) => t.estado === 'EnTransito' && t.posicionActual !== undefined));
check('al menos un viaje esta Planificado', TRIPS_MOCK_DATA.some((t) => t.estado === 'Planificado'));

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad referencial fallaron.`);
  process.exit(1);
} else {
  console.log('Toda la integridad referencial verificada paso.');
  process.exit(0);
}
