// ============================================================
// Smoke script — Tanda 8 (corrida completa): entrega parcial derivada
// (ADR-001), maquina de estados del viaje (ADR-002), rechazo total
// derivado por linea (ADR-002/remitos). Ejercita las funciones PURAS
// de cada modulo (sin httpClient, que lee import.meta.env y no corre
// con `node` puro) importando el codigo real, no una copia.
//
// Correr con: node scripts/smoke/tanda-8.smoke.mjs (desde FrontEnd/).
// ============================================================

import { derivePendingQuantity, deriveOrderFulfillmentStatus } from '../../src/shared/utils/orderFulfillment.ts';
import { puedeTransicionar, DELIVERY_TRANSITIONS } from '../../src/shared/types/deliveryStatus.types.ts';
import { isRechazoTotal } from '../../src/shared/types/deliveryNote.types.ts';

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
// 1. Caso guia obligatorio de ADR-001: pedido de 100 unidades en una
// linea, remito de 70, luego remito de 30.
// ------------------------------------------------------------
let line = { quantity: 100, cantidadEntregada: 0 };
check('pedido de 100: pendiente inicial es 100', derivePendingQuantity(line) === 100);
check('pedido de 100: estado inicial es pendiente', deriveOrderFulfillmentStatus([line]) === 'pendiente');

// Remito 1: se entregan 70.
line = { ...line, cantidadEntregada: line.cantidadEntregada + 70 };
check('remito de 70: cantidadEntregada acumulada es 70', line.cantidadEntregada === 70);
check('remito de 70: pendiente es 30', derivePendingQuantity(line) === 30);
check('remito de 70: estado del pedido es parcial', deriveOrderFulfillmentStatus([line]) === 'parcial');

// Remito 2: se entregan las 30 restantes.
line = { ...line, cantidadEntregada: line.cantidadEntregada + 30 };
check('remito de 30 mas: cantidadEntregada acumulada es 100', line.cantidadEntregada === 100);
check('remito de 30 mas: pendiente es 0', derivePendingQuantity(line) === 0);
check('remito de 30 mas: estado del pedido es completo', deriveOrderFulfillmentStatus([line]) === 'completo');

// Pedido de 2 lineas, una completa y otra no: debe seguir siendo parcial.
const twoLines = [
  { quantity: 10, cantidadEntregada: 10 },
  { quantity: 5, cantidadEntregada: 2 },
];
check('pedido de 2 lineas (una completa, otra no) es parcial', deriveOrderFulfillmentStatus(twoLines) === 'parcial');

// ------------------------------------------------------------
// 2. Tabla de verdad de transiciones (ADR-002).
// ------------------------------------------------------------
check('CREADO -> EN_TRANSITO es valida', puedeTransicionar('CREADO', 'EN_TRANSITO') === true);
check('EN_TRANSITO -> FINALIZADO es valida', puedeTransicionar('EN_TRANSITO', 'FINALIZADO') === true);
check('EN_TRANSITO -> REPROGRAMADO es valida', puedeTransicionar('EN_TRANSITO', 'REPROGRAMADO') === true);
check('REPROGRAMADO -> CREADO es valida', puedeTransicionar('REPROGRAMADO', 'CREADO') === true);

check('FINALIZADO -> EN_TRANSITO es invalida (terminal)', puedeTransicionar('FINALIZADO', 'EN_TRANSITO') === false);
check('CREADO -> FINALIZADO es invalida (salto de pasos)', puedeTransicionar('CREADO', 'FINALIZADO') === false);
check('CANCELADO -> CREADO es invalida (terminal)', puedeTransicionar('CANCELADO', 'CREADO') === false);

check('FINALIZADO no tiene transiciones de salida', DELIVERY_TRANSITIONS.FINALIZADO.length === 0);
check('CANCELADO no tiene transiciones de salida', DELIVERY_TRANSITIONS.CANCELADO.length === 0);

// ------------------------------------------------------------
// 3. Reprogramacion vuelve a CREADO (secuencia de 2 pasos validada
// contra el mismo mapa que usa deliveries.service.ts#reprogramDelivery).
// ------------------------------------------------------------
function simulateReprogram(estadoActual) {
  if (!puedeTransicionar(estadoActual, 'REPROGRAMADO')) return null;
  if (!puedeTransicionar('REPROGRAMADO', 'CREADO')) return null;
  return 'CREADO';
}
check('reprogramar desde EN_TRANSITO termina en CREADO', simulateReprogram('EN_TRANSITO') === 'CREADO');
check('reprogramar desde CREADO termina en CREADO', simulateReprogram('CREADO') === 'CREADO');
check('reprogramar desde FINALIZADO no es posible (null)', simulateReprogram('FINALIZADO') === null);

// ------------------------------------------------------------
// 4. Rechazo total derivado correctamente (nunca un campo persistido).
// ------------------------------------------------------------
const remitoRechazoTotal = [
  { orderLineId: 'oi-1', cantidadOfrecida: 10, cantidadEntregada: 0, cantidadRechazada: 10, motivoRechazo: 'Dañado' },
  { orderLineId: 'oi-2', cantidadOfrecida: 5, cantidadEntregada: 0, cantidadRechazada: 5, motivoRechazo: 'Vencido' },
];
check('remito con todas las lineas rechazadas es rechazo total', isRechazoTotal(remitoRechazoTotal) === true);

const remitoRechazoParcial = [
  { orderLineId: 'oi-1', cantidadOfrecida: 10, cantidadEntregada: 0, cantidadRechazada: 10, motivoRechazo: 'Dañado' },
  { orderLineId: 'oi-2', cantidadOfrecida: 5, cantidadEntregada: 5, cantidadRechazada: 0 },
];
check('remito con al menos una linea sin rechazo total no es rechazo total', isRechazoTotal(remitoRechazoParcial) === false);

check('remito vacio no es rechazo total', isRechazoTotal([]) === false);

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
