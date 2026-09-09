// ============================================================
// Smoke script — Tanda 9 (modelo logistico base, ADR-010). Ejercita
// las funciones PURAS agregadas en esta tanda (sin httpClient, que lee
// import.meta.env y no corre con `node` puro): computeAllowedTransitions
// (contrato de transiciones, seccion 3), las derivaciones de
// orderLogistics.ts (seccion 1) y el branding de DeliveryNoteId/
// DeliveryHistoryEventId (AUDIT_15 hallazgo #13).
//
// Correr con: node scripts/smoke/tanda-9.smoke.mjs (desde FrontEnd/).
// ============================================================

import { computeAllowedTransitions } from '../../src/shared/types/deliveryStatus.types.ts';
import { deriveOrderLogisticStatus, deriveOrderFinancialStatus } from '../../src/shared/utils/orderLogistics.ts';
import { asDeliveryNoteId, asDeliveryHistoryEventId, InvalidIdError } from '../../src/shared/types/ids.types.ts';

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
// 1. computeAllowedTransitions — un objeto por cada estado distinto
// del actual, con motivo SOLO cuando permitida es false (ADR-010
// seccion 3, correccion 2026-09-09).
// ------------------------------------------------------------
const desdeCreado = computeAllowedTransitions('CREADO');
check('CREADO tiene 4 transiciones evaluadas (todas menos si misma)', desdeCreado.length === 4);
check(
  'CREADO -> EN_TRANSITO viene permitida y sin motivo',
  desdeCreado.find((t) => t.transicion === 'EN_TRANSITO')?.permitida === true &&
    desdeCreado.find((t) => t.transicion === 'EN_TRANSITO')?.motivo === undefined
);
check(
  'CREADO -> FINALIZADO viene no permitida CON motivo (nunca solo un booleano)',
  desdeCreado.find((t) => t.transicion === 'FINALIZADO')?.permitida === false &&
    typeof desdeCreado.find((t) => t.transicion === 'FINALIZADO')?.motivo === 'string'
);

const desdeFinalizado = computeAllowedTransitions('FINALIZADO');
check(
  'FINALIZADO: las 4 transiciones vienen no permitidas (estado terminal)',
  desdeFinalizado.every((t) => t.permitida === false)
);
check(
  'FINALIZADO: todas traen motivo (ninguna permitida queda sin explicar)',
  desdeFinalizado.every((t) => typeof t.motivo === 'string' && t.motivo.length > 0)
);

const desdeReprogramado = computeAllowedTransitions('REPROGRAMADO');
check(
  'REPROGRAMADO -> CREADO permitida (unica salida, nunca queda "parado")',
  desdeReprogramado.find((t) => t.transicion === 'CREADO')?.permitida === true
);

// ------------------------------------------------------------
// 2. deriveOrderLogisticStatus — nunca persistido, siempre recalculado
// (ADR-010 seccion 1). 0 entregas -> 'Pendiente'; con entregas, la del
// evento de historial mas reciente decide (hallazgo A15#4: un pedido
// puede tener mas de una Delivery).
// ------------------------------------------------------------
check('sin entregas: logisticoResumen es Pendiente', deriveOrderLogisticStatus([]) === 'Pendiente');

const deliveryVieja = {
  status: 'CREADO',
  historial: [{ cuando: '2026-09-01T10:00:00Z' }],
};
const deliveryReciente = {
  status: 'EN_TRANSITO',
  historial: [{ cuando: '2026-09-09T08:00:00Z' }],
};
check(
  'con 2 entregas, gana la del evento de historial mas reciente (no la primera del array)',
  deriveOrderLogisticStatus([deliveryVieja, deliveryReciente]) === 'EN_TRANSITO'
);
check(
  'el orden de entrada no importa (mismo resultado invertido)',
  deriveOrderLogisticStatus([deliveryReciente, deliveryVieja]) === 'EN_TRANSITO'
);

// ------------------------------------------------------------
// 3. deriveOrderFinancialStatus — proyeccion de solo lectura (stub
// honesto sobre `status` legado, ADR-010 seccion 1).
// ------------------------------------------------------------
check('status invoiced -> Facturado', deriveOrderFinancialStatus({ status: 'invoiced' }) === 'Facturado');
check('status pending -> Sin facturar', deriveOrderFinancialStatus({ status: 'pending' }) === 'Sin facturar');
check('status delivered (sin comprobante) -> Sin facturar', deriveOrderFinancialStatus({ status: 'delivered' }) === 'Sin facturar');

// ------------------------------------------------------------
// 4. Branding DeliveryNoteId/DeliveryHistoryEventId (AUDIT_15 #13):
// antes string plano, ahora valida formato o lanza.
// ------------------------------------------------------------
check('asDeliveryNoteId acepta el formato remito-', asDeliveryNoteId('remito-123') === 'remito-123');
check('asDeliveryHistoryEventId acepta el formato dh-', asDeliveryHistoryEventId('dh-abc-0') === 'dh-abc-0');

let lanzoNote = false;
try {
  asDeliveryNoteId('nota-123');
} catch (e) {
  lanzoNote = e instanceof InvalidIdError;
}
check('asDeliveryNoteId rechaza un formato invalido (lanza InvalidIdError)', lanzoNote);

let lanzoHistEvent = false;
try {
  asDeliveryHistoryEventId('evento-123');
} catch (e) {
  lanzoHistEvent = e instanceof InvalidIdError;
}
check('asDeliveryHistoryEventId rechaza un formato invalido (lanza InvalidIdError)', lanzoHistEvent);

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
