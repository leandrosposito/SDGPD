// ============================================================
// Smoke script — Tanda 10B (operacion logistica: vehiculos, choferes,
// viajes, asignacion, POD, ADR-011). Ejercita las funciones PURAS
// agregadas en esta tanda (sin httpClient, que lee import.meta.env y
// no corre con `node` puro) — mismo criterio que tanda-9.smoke.mjs:
// computeAllowedTripTransitions/puedeTransicionarViaje (maquina de
// estados del viaje), computeCapacidadUsada/excedeCapacidad
// (capacidad, ADR-011 seccion 2), withIdempotency (ADR-010 seccion 4,
// extraido a shared/utils/idempotency.ts esta tanda) y el branding de
// VehicleId/DriverId/TripId/StopId/PodId.
//
// La integridad referencial de los mocks (D2 del protocolo) esta en
// scripts/verificacion/v12-trips-referential-integrity.mjs, no aca —
// mismo criterio que v11-referential-integrity.mjs: ese script SI
// importa los mocks reales (asTripId/asVehicleId son imports de VALOR
// via `@/`, no de tipo) y necesita el loader inline que resuelve ese
// alias para Node; este script se mantiene libre de esa dependencia.
//
// Correr con: node scripts/smoke/tanda-10b.smoke.mjs (desde FrontEnd/).
// ============================================================

import { puedeTransicionarViaje, computeAllowedTripTransitions } from '../../src/shared/types/tripStatus.types.ts';
import { computeCapacidadUsada, excedeCapacidad } from '../../src/shared/utils/tripCapacity.ts';
import { withIdempotency } from '../../src/shared/utils/idempotency.ts';
import {
  asVehicleId,
  asDriverId,
  asTripId,
  asStopId,
  asPodId,
  isVehicleId,
  isDriverId,
  isTripId,
  isStopId,
  isPodId,
  InvalidIdError,
} from '../../src/shared/types/ids.types.ts';

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
// 1. TRIP_TRANSITIONS / puedeTransicionarViaje (ADR-011): flujo normal
// Planificado -> Despachado -> EnTransito -> Rendido, Cancelado
// alcanzable desde Planificado/Despachado pero NO desde EnTransito (un
// viaje ya en la calle se rinde, no se cancela).
// ------------------------------------------------------------
check('Planificado -> Despachado permitida', puedeTransicionarViaje('Planificado', 'Despachado'));
check('Planificado -> Cancelado permitida', puedeTransicionarViaje('Planificado', 'Cancelado'));
check('Planificado -> EnTransito NO permitida (salteando Despachado)', !puedeTransicionarViaje('Planificado', 'EnTransito'));
check('Despachado -> EnTransito permitida', puedeTransicionarViaje('Despachado', 'EnTransito'));
check('EnTransito -> Rendido permitida', puedeTransicionarViaje('EnTransito', 'Rendido'));
check('EnTransito -> Cancelado NO permitida (ya salio a la calle)', !puedeTransicionarViaje('EnTransito', 'Cancelado'));
check('Rendido: estado terminal, ninguna salida', puedeTransicionarViaje('Rendido', 'Planificado') === false);
check('Cancelado: estado terminal, ninguna salida', puedeTransicionarViaje('Cancelado', 'Planificado') === false);

const desdePlanificado = computeAllowedTripTransitions('Planificado');
check('Planificado tiene 4 transiciones evaluadas', desdePlanificado.length === 4);
check(
  'Planificado -> EnTransito viene no permitida CON motivo (nunca solo un booleano)',
  desdePlanificado.find((t) => t.transicion === 'EnTransito')?.permitida === false &&
    typeof desdePlanificado.find((t) => t.transicion === 'EnTransito')?.motivo === 'string'
);

const desdeEnTransito = computeAllowedTripTransitions('EnTransito');
check(
  'EnTransito -> Cancelado viene no permitida con motivo especifico',
  desdeEnTransito.find((t) => t.transicion === 'Cancelado')?.permitida === false
);

// ------------------------------------------------------------
// 2. computeCapacidadUsada / excedeCapacidad (ADR-011 seccion 2): la
// capacidad se calcula sobre TODAS las paradas del viaje, nunca sobre
// una sola — y la comparacion es estrictamente "mayor que", no
// "mayor o igual" (llenar el vehiculo exacto no es sobrecarga).
// ------------------------------------------------------------
const paradasVacias = [];
check('sin paradas: capacidadUsada.bultos es 0', computeCapacidadUsada(paradasVacias).bultos === 0);

const paradas = [
  { deliveryIds: ['del-001', 'del-002'] },
  { deliveryIds: ['del-003'] },
];
check('2 paradas con 2+1 entregas: capacidadUsada.bultos suma las 3', computeCapacidadUsada(paradas).bultos === 3);
check('pesoKg/volumenM3 quedan en 0 (sin dato real en el dominio, documentado)', computeCapacidadUsada(paradas).pesoKg === 0 && computeCapacidadUsada(paradas).volumenM3 === 0);

check('capacidadUsada.bultos === capacidad.bultos NO es sobrecarga (limite exacto)', excedeCapacidad({ bultos: 10 }, { bultos: 10 }) === false);
check('capacidadUsada.bultos > capacidad.bultos SI es sobrecarga', excedeCapacidad({ bultos: 11 }, { bultos: 10 }) === true);

// ------------------------------------------------------------
// 3. withIdempotency (ADR-010 seccion 4, extraido de
// deliveries.service.ts a shared/utils/idempotency.ts esta tanda):
// una clave repetida devuelve el MISMO resultado guardado sin volver a
// ejecutar `compute` — y solo se cachea `success: true`.
// ------------------------------------------------------------
let vecesEjecutado = 0;
async function runIdempotencyChecks() {
  const key = 'test-key-1';
  const r1 = await withIdempotency(key, () => {
    vecesEjecutado += 1;
    return { success: true, valor: 42 };
  });
  const r2 = await withIdempotency(key, () => {
    vecesEjecutado += 1;
    return { success: true, valor: 999 };
  });
  check('withIdempotency: compute se ejecuto UNA sola vez para la misma clave', vecesEjecutado === 1);
  check('withIdempotency: el segundo llamado devuelve el resultado GUARDADO de la primera vez', r2.valor === 42 && r1.valor === 42);

  const failKey = 'test-key-fail';
  let intentosFail = 0;
  const rFail1 = await withIdempotency(failKey, () => {
    intentosFail += 1;
    return { success: false, reason: 'algo-transitorio' };
  });
  const rFail2 = await withIdempotency(failKey, () => {
    intentosFail += 1;
    return { success: true, reason: undefined };
  });
  check('withIdempotency: un success:false NO se cachea (se recalcula en el siguiente intento)', intentosFail === 2);
  check('withIdempotency: tras el fallo, un segundo intento legitimo SI puede tener exito', rFail1.success === false && rFail2.success === true);
}
await runIdempotencyChecks();

// ------------------------------------------------------------
// 4. Branding de VehicleId/DriverId/TripId/StopId/PodId (Tanda 10B).
// ------------------------------------------------------------
check('asVehicleId acepta el formato veh-', asVehicleId('veh-001') === 'veh-001');
check('asDriverId acepta el formato drv-', asDriverId('drv-001') === 'drv-001');
check('asTripId acepta el formato trip-', asTripId('trip-001') === 'trip-001');
check('asStopId acepta el formato stop-', asStopId('stop-001') === 'stop-001');
check('asPodId acepta el formato pod-', asPodId('pod-001') === 'pod-001');

check('isVehicleId rechaza un id de otro dominio', isVehicleId('drv-001') === false);
check('isDriverId rechaza un id de otro dominio', isDriverId('veh-001') === false);
check('isTripId rechaza un id de otro dominio', isTripId('stop-001') === false);
check('isStopId rechaza un id de otro dominio', isStopId('trip-001') === false);
check('isPodId rechaza un id de otro dominio', isPodId('veh-001') === false);

let lanzoVehicle = false;
try {
  asVehicleId('camion-123');
} catch (e) {
  lanzoVehicle = e instanceof InvalidIdError;
}
check('asVehicleId rechaza un formato invalido (lanza InvalidIdError)', lanzoVehicle);

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
