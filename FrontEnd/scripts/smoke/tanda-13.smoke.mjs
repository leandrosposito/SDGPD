// ============================================================
// Smoke script — Tanda 13 (hallazgo ALTO en markStopNoVisitada,
// enmienda ADR-013). Ejercita la funcion PURA agregada en esta tanda
// (sin httpClient, que lee import.meta.env y no corre con `node`
// puro): getStopNoVisitadaBlockReason
// (shared/utils/stopVisitEligibility.ts) — la UNICA fuente de la regla
// "puede intentarse marcar esta Parada como no visitada", compartida
// por trips.service.ts (autoritativa) y TripDetailPanel.tsx (UX).
//
// El resto de la tanda (precondiciones inline en markStopNoVisitada,
// el todo-o-nada post-loop, tripId/stopId en ReprogramacionEvent) es
// wiring de service/UI ya cubierto por tsc/build/lint + lectura de
// codigo + el checklist de navegador de VERIFICACION_TANDA_13.md — no
// hay logica pura adicional que valga la pena extraer aparte de esta.
//
// Correr con: node scripts/smoke/tanda-13.smoke.mjs (desde FrontEnd/).
// ============================================================

import { getStopNoVisitadaBlockReason, TRIP_EN_CURSO_STATUSES } from '../../src/shared/utils/stopVisitEligibility.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.error(`FAIL ${description}`);
    failures += 1;
  }
}

// Fixtures minimos — solo los campos que la funcion realmente lee
// (trip.estado, stop.estado, stop.deliveryIds, delivery.status).
function makeTrip(estado) {
  return { estado };
}

function makeStop(estado, deliveryIds) {
  return { estado, deliveryIds };
}

function makeDelivery(id, status) {
  return { id, status };
}

// ------------------------------------------------------------
// 1. trip-not-en-curso — 'Planificado' (nunca salio) y los dos
// terminales ('Rendido'/'Cancelado') bloquean; 'Despachado'/
// 'EnTransito' no.
// ------------------------------------------------------------
const stopPendienteConEntrega = makeStop('Pendiente', ['d1']);
const entregaCreada = [makeDelivery('d1', 'CREADO')];

check(
  "trip 'Planificado' -> trip-not-en-curso",
  getStopNoVisitadaBlockReason(makeTrip('Planificado'), stopPendienteConEntrega, entregaCreada) === 'trip-not-en-curso'
);
check(
  "trip 'Rendido' -> trip-not-en-curso",
  getStopNoVisitadaBlockReason(makeTrip('Rendido'), stopPendienteConEntrega, entregaCreada) === 'trip-not-en-curso'
);
check(
  "trip 'Cancelado' -> trip-not-en-curso",
  getStopNoVisitadaBlockReason(makeTrip('Cancelado'), stopPendienteConEntrega, entregaCreada) === 'trip-not-en-curso'
);
check(
  "trip 'Despachado' -> no bloquea por este motivo (null)",
  getStopNoVisitadaBlockReason(makeTrip('Despachado'), stopPendienteConEntrega, entregaCreada) === null
);
check(
  "trip 'EnTransito' -> no bloquea por este motivo (null)",
  getStopNoVisitadaBlockReason(makeTrip('EnTransito'), stopPendienteConEntrega, entregaCreada) === null
);
check(
  'TRIP_EN_CURSO_STATUSES es exactamente [Despachado, EnTransito]',
  TRIP_EN_CURSO_STATUSES.length === 2 && TRIP_EN_CURSO_STATUSES.includes('Despachado') && TRIP_EN_CURSO_STATUSES.includes('EnTransito')
);

// ------------------------------------------------------------
// 2. stop-not-pendiente — HALLAZGO ALTO original: antes se podia
// marcar NoVisitada una Parada ya 'Visitada' (con POD).
// ------------------------------------------------------------
const tripEnCurso = makeTrip('EnTransito');

check(
  "HALLAZGO CORREGIDO: stop 'Visitada' (con POD) -> stop-not-pendiente, ya NO null",
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Visitada', ['d1']), entregaCreada) === 'stop-not-pendiente'
);
check(
  "stop 'NoVisitada' (ya marcada) -> stop-not-pendiente",
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('NoVisitada', ['d1']), entregaCreada) === 'stop-not-pendiente'
);
check(
  "stop 'Reprogramada' -> stop-not-pendiente",
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Reprogramada', ['d1']), entregaCreada) === 'stop-not-pendiente'
);
check("stop 'Pendiente' -> no bloquea por este motivo (null)", getStopNoVisitadaBlockReason(tripEnCurso, stopPendienteConEntrega, entregaCreada) === null);

// ------------------------------------------------------------
// 3. no-deliveries
// ------------------------------------------------------------
check(
  'Parada sin entregas -> no-deliveries',
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Pendiente', []), []) === 'no-deliveries'
);

// ------------------------------------------------------------
// 4. delivery-en-estado-terminal — cualquier entrega FINALIZADO o
// CANCELADO en la Parada bloquea, aunque otras esten en CREADO.
// ------------------------------------------------------------
check(
  'una entrega FINALIZADO entre varias -> delivery-en-estado-terminal',
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Pendiente', ['d1', 'd2']), [makeDelivery('d1', 'CREADO'), makeDelivery('d2', 'FINALIZADO')]) ===
    'delivery-en-estado-terminal'
);
check(
  'una entrega CANCELADO -> delivery-en-estado-terminal',
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Pendiente', ['d1']), [makeDelivery('d1', 'CANCELADO')]) === 'delivery-en-estado-terminal'
);
check(
  'entregas EN_TRANSITO (no terminal) -> no bloquea por este motivo (null)',
  getStopNoVisitadaBlockReason(tripEnCurso, makeStop('Pendiente', ['d1']), [makeDelivery('d1', 'EN_TRANSITO')]) === null
);

// ------------------------------------------------------------
// 5. Caso feliz completo — las 4 precondiciones satisfechas -> null
// (la operacion puede intentarse).
// ------------------------------------------------------------
check(
  'viaje en curso + parada pendiente + entregas sin estado terminal -> null (permitido)',
  getStopNoVisitadaBlockReason(makeTrip('Despachado'), makeStop('Pendiente', ['d1', 'd2']), [
    makeDelivery('d1', 'CREADO'),
    makeDelivery('d2', 'EN_TRANSITO'),
  ]) === null
);

// ------------------------------------------------------------
// 6. Precedencia — cuando varias precondiciones fallan a la vez, se
// devuelve siempre la primera en el orden documentado (trip -> stop ->
// no-deliveries -> delivery), nunca una mezcla ambigua.
// ------------------------------------------------------------
check(
  "trip 'Planificado' + stop 'Visitada' a la vez -> gana trip-not-en-curso (se chequea primero)",
  getStopNoVisitadaBlockReason(makeTrip('Planificado'), makeStop('Visitada', ['d1']), entregaCreada) === 'trip-not-en-curso'
);

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
