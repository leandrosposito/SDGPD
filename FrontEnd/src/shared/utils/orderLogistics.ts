import type { Order } from '@/shared/types/order.types';
import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types';

// ============================================================
// orderLogistics — Tanda 9 (modelo logistico base, ADR-010 secciones
// 1 y 8). Mismo principio que shared/utils/orderFulfillment.ts
// (cantidadPendiente/OrderFulfillmentStatus): el eje logistico y el
// eje financiero de un pedido NUNCA se persisten ni se copian a un
// campo de Order — se derivan siempre, con una funcion pura, a partir
// de datos que ya viven en su entidad real (Delivery para el
// logistico, el propio Order para el financiero-stub).
//
// Por que son funciones puras en shared/utils/ y NO un campo en el
// contrato de getOrderById/getOrdersPage: evita que orders.service.ts
// tenga que importar deliveries.service.ts (o viceversa) para calcular
// esto server-side — ambos servicios seguirian sin conocerse entre si
// (mismo criterio "servidor a servidor" ya documentado en el resto del
// proyecto), y quien consume esto (hoy: OrderDetailPanel.tsx) ya tiene
// que pedir las entregas del pedido por otro motivo de todas formas.
// ============================================================

// Vocabulario INTERIM (Tanda 9): 'Pendiente' + los 5 valores reales de
// DeliveryStatus — no los 11 estados de Parada que define ADR-010
// seccion 2, porque Parada/Viaje son explicitamente la tanda
// siguiente, no esta. El dia que Parada exista, este tipo (y la
// funcion de abajo) se reemplazan por la derivacion real desde
// Parada.status — ver ADR-010 seccion 2, "Como se deriva el estado
// hacia arriba".
export type OrderLogisticoResumen = 'Pendiente' | DeliveryStatus;

// Un pedido puede tener 0, 1 o mas Delivery asociadas (AUDIT_15
// hallazgo #4 — sin Parada, siguen sin relacion explicita entre si en
// esta tanda). Regla de esta version interina: sin ninguna entrega,
// 'Pendiente'; si hay una o mas, se toma la de la transicion de
// historial mas reciente (la que efectivamente cambio de estado hace
// menos tiempo) como representativa — es la entrega en la que "esta
// pasando algo" ahora mismo para ese pedido.
export function deriveOrderLogisticStatus(deliveries: readonly Delivery[]): OrderLogisticoResumen {
  if (deliveries.length === 0) return 'Pendiente';

  let masReciente = deliveries[0];
  let masRecienteCuando = masReciente.historial.at(-1)?.cuando ?? '';
  for (const delivery of deliveries.slice(1)) {
    const cuando = delivery.historial.at(-1)?.cuando ?? '';
    if (cuando > masRecienteCuando) {
      masReciente = delivery;
      masRecienteCuando = cuando;
    }
  }
  return masReciente.status;
}

// Eje financiero (ADR-010 seccion 1): proyeccion de solo lectura,
// derivada de comprobantes reales — Facturacion no existe todavia como
// dominio (AUDIT_15 no lo revisa, es otro alcance), asi que esta
// version es un STUB explicito: usa la unica senal ya disponible hoy
// (el `status` legado, que incluia 'invoiced' como uno de sus 6
// valores mezclados) en vez de inventar un valor fijo sin sentido. El
// dia que exista un dominio real de comprobantes, esta funcion es la
// UNICA que hay que reescribir — nada que la consuma cambia.
export type OrderEstadoFinanciero = 'Sin facturar' | 'Facturado' | 'Cobrado' | 'Con nota de crédito';

export function deriveOrderFinancialStatus(order: Pick<Order, 'status'>): OrderEstadoFinanciero {
  return order.status === 'invoiced' ? 'Facturado' : 'Sin facturar';
}
