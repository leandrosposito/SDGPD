import type { Trip, Stop, TripStatus } from '@/shared/types/trip.types';
import type { Delivery } from '@/shared/types/logistics.types';

// ============================================================
// stopVisitEligibility — Tanda 13. HALLAZGO ALTO (ADR-013, enmienda):
// markStopNoVisitada (trips.service.ts) no validaba nada antes de
// intentar reprogramar las entregas de la Parada — se podia llamar
// sobre una Parada ya 'Visitada' (con POD ya registrado) o sobre un
// viaje 'Planificado'/'Rendido'/'Cancelado', y devolvia `success: true`
// aunque TODAS las reprogramaciones fallaran.
//
// Esta funcion es la UNICA fuente de la regla "puede intentarse marcar
// esta Parada como no visitada" — la usan los dos lados (mismo
// criterio que ADR-010 seccion 3 pide para las maquinas de transicion:
// nunca dos implementaciones del mismo chequeo):
// - trips.service.ts#markStopNoVisitada la llama server-side,
//   AUTORITATIVA — rechaza la operacion si devuelve un motivo.
// - TripDetailPanel.tsx la llama client-side, solo para no mostrar un
//   boton que el servidor va a rechazar igual (mismo criterio que
//   canCancel en OrderDetailPanel.tsx, has-active-deliveries en Tanda
//   9, etc.) — nunca la unica barrera real.
//
// Extraida a su propio modulo (sin dependencia de httpClient) para
// poder ejercitarse con un smoke script puro, mismo criterio que
// tripCapacity.ts/orderNumber.ts/patente.ts/lotExpiration.ts.
// ============================================================

// "En curso" = el vehiculo ya salio del deposito — recien ahi tiene
// sentido que el chofer haya "llegado" (o no) a una Parada puntual.
// 'Planificado' (todavia no goes ni siquiera Despachado) no puede
// tener una visita fallida porque no hubo visita posible; 'Rendido'/
// 'Cancelado' son terminales, el viaje ya se cerro.
export const TRIP_EN_CURSO_STATUSES: readonly TripStatus[] = ['Despachado', 'EnTransito'];

const DELIVERY_TERMINAL_STATUSES: readonly Delivery['status'][] = ['FINALIZADO', 'CANCELADO'];

export type StopNoVisitadaBlockReason =
  | 'trip-not-en-curso'
  | 'stop-not-pendiente'
  | 'no-deliveries'
  | 'delivery-en-estado-terminal';

// `deliveries` son las Delivery REALES de `stop.deliveryIds` (no solo
// los ids) — quien llama las resuelve (getDeliveryById server-side,
// el mapa `deliveriesById` ya cargado client-side). Si alguna no se
// pudo resolver, se omite de la lista en vez de romper: el llamador ya
// maneja "no-found" por su cuenta en otro lado.
export function getStopNoVisitadaBlockReason(trip: Trip, stop: Stop, deliveries: Delivery[]): StopNoVisitadaBlockReason | null {
  if (!TRIP_EN_CURSO_STATUSES.includes(trip.estado)) return 'trip-not-en-curso';
  if (stop.estado !== 'Pendiente') return 'stop-not-pendiente';
  if (stop.deliveryIds.length === 0) return 'no-deliveries';
  if (deliveries.some((d) => DELIVERY_TERMINAL_STATUSES.includes(d.status))) return 'delivery-en-estado-terminal';
  return null;
}

export const STOP_NO_VISITADA_BLOCK_MESSAGE: Record<StopNoVisitadaBlockReason, string> = {
  'trip-not-en-curso': 'El viaje todavía no salió (o ya se rindió/canceló) — solo se puede marcar una parada como no visitada con el viaje en curso.',
  'stop-not-pendiente': 'Esta parada ya no está Pendiente (ya se visitó o ya está marcada como no visitada).',
  'no-deliveries': 'Esta parada no tiene entregas.',
  'delivery-en-estado-terminal': 'Alguna entrega de esta parada ya está Finalizada o Cancelada — no se puede reprogramar.',
};
