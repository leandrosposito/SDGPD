import type { Trip } from '@/shared/types/trip.types'
import type { Delivery } from '@/shared/types/logistics.types'
import type { TripId, StopId, DeliveryId } from '@/shared/types/ids.types'
import { getStopNoVisitadaBlockReason } from '@/shared/utils/stopVisitEligibility'
import { httpClient } from '@/shared/api/httpClient'
import { withIdempotency } from '@/shared/utils/idempotency'
import { getDeliveryById, transitionDelivery, reprogramDelivery } from './deliveries.service'
import { registerPodEvidence, type PodInput } from './pod.service'
import type {
  RegisterPodResult,
  MarkStopNoVisitadaInput,
  MarkStopNoVisitadaDeliveryResult,
  MarkStopNoVisitadaResult,
} from './trips.types'
import { findTrip, saveTrip, nowISO, withComputedFields } from './trips.store'

// ============================================================
// POD (ADR-010 seccion 7 / ADR-011): graba el POD (delegado a
// pod.service.ts, que ya tiene el store propio) y dispara la
// confirmacion de entrega fisica — marca la Delivery FINALIZADO si
// todavia no lo estaba (via transitionDelivery, deliveries.service.ts)
// y la Parada 'Visitada'.
// ============================================================

export async function registerPod(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  deliveryId: DeliveryId,
  stopId: StopId,
  input: PodInput,
  quien: string
): Promise<RegisterPodResult> {
  return httpClient.request<RegisterPodResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/pod`,
    body: { empresaId, idempotencyKey, deliveryId, stopId, ...input, creadoPor: quien },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, async () => {
        const trip = findTrip(tripId)
        const stop = trip?.paradas.find(s => s.id === stopId)
        if (!trip || !stop || !stop.deliveryIds.includes(deliveryId)) {
          return { success: false, reason: 'not-found' as const, deliveryFinalized: false }
        }
        const delivery = getDeliveryById(deliveryId)
        if (!delivery) {
          return { success: false, reason: 'delivery-not-found' as const, deliveryFinalized: false }
        }

        await registerPodEvidence(empresaId, deliveryId, stopId, input, quien)

        // "si no lo estaba" (tarea): FINALIZADO ya alcanzado (ej. via
        // registrarEntrega) no se reintenta — transitionDelivery con la
        // misma clave ya es idempotente igual, pero se evita el llamado
        // de mas cuando el estado actual ya no admite la transicion.
        //
        // Fase C (hallazgo propio): si la Delivery todavia esta CREADO
        // (nunca salio a EN_TRANSITO), transitionDelivery a FINALIZADO
        // no esta permitido (deliveryStatus.types.ts) y el intento
        // falla — antes esto se ignoraba en silencio y el POD reportaba
        // `success: true` sin aclarar que el efecto derivado (finalizar
        // la entrega) no se aplico. El POD (evidencia fisica) se
        // guarda igual — es un hecho ya ocurrido, mismo criterio que
        // 'propagation-failed' en registrarEntrega — pero
        // `deliveryFinalized` ahora dice la verdad sobre ese efecto.
        const deliveryFinalized =
          delivery.status === 'FINALIZADO' ||
          (
            await transitionDelivery(
              empresaId,
              `${idempotencyKey}-finalizar`,
              deliveryId,
              'FINALIZADO',
              quien
            )
          ).success

        const paradas = trip.paradas.map(s =>
          s.id === stopId ? { ...s, estado: 'Visitada' as const } : s
        )
        const updated: Trip = { ...trip, paradas, updatedAt: nowISO() }
        saveTrip(updated)

        return {
          success: true,
          trip: structuredClone(withComputedFields(updated)),
          deliveryFinalized,
        }
      }),
  })
}

// ============================================================
// "Entrega no realizada" (ADR-013 seccion 3): el chofer llego a la
// direccion de la Parada y no pudo entregar nada — es un hecho de la
// PARADA (ADR-010: "una visita fisica"), no de una Delivery aislada,
// por eso el disparador vive en TripDetailPanel.tsx, no en
// DeliveriesTable.tsx (que sigue siendo ReprogramarModal, una
// reprogramacion "administrativa" sin viaje en curso).
//
// Reusa reprogramDelivery (motivoTipo 'no-entrega') por cada entrega de
// la Parada en vez de duplicar la maquina de transiciones — eso ya
// libera cada entrega de esta misma Parada como efecto secundario
// (ADR-013 seccion 1), asi que no hace falta vaciar `deliveryIds` a
// mano aca. Sin campo de motivo propio en Stop: el motivo real queda
// en Delivery.reprogramaciones de cada entrega (ver ADR-013,
// "alternativas descartadas" — duplicarlo en Stop seria una segunda
// fuente de verdad para el mismo hecho).
// ============================================================

export async function markStopNoVisitada(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  stopId: StopId,
  input: MarkStopNoVisitadaInput,
  quien: string
): Promise<MarkStopNoVisitadaResult> {
  return httpClient.request<MarkStopNoVisitadaResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/no-visitada`,
    body: { empresaId, idempotencyKey, ...input },
    idempotencyKey,
    mock: async () =>
      withIdempotency(idempotencyKey, async () => {
        // Tanda 15 (hallazgo MEDIO): las precondiciones tienen que
        // correr ADENTRO de withIdempotency, no antes — withIdempotency
        // consulta el cache ANTES de llamar a `compute`, asi que
        // ponerlas aca garantiza que un segundo llamado con la MISMA
        // clave (httpClient reintenta POST con DEFAULT_RETRIES=2, y
        // nada impide ademas un reintento manual del usuario con la
        // clave todavia vigente) devuelva el resultado cacheado de
        // exito ANTES de volver a evaluarlas contra el estado ya
        // mutado. El comentario anterior ("revalidar aca o adentro es
        // funcionalmente identico") era la parte que estaba mal: es
        // cierto que un `success: false` nunca se cachea (ver
        // withIdempotency), pero si la PRIMERA llamada tuvo exito, la
        // Parada ya quedo en 'NoVisitada' — un reintento con las
        // precondiciones afuera volveria a leer el trip/stop ya mutados y
        // getStopNoVisitadaBlockReason devolveria 'stop-not-pendiente'
        // en vez de nunca ejecutarse (el cache de withIdempotency ni se
        // llega a consultar), violando el contrato de ADR-010 seccion 4
        // ("el servidor devuelve el resultado ya guardado de la primera
        // vez — nunca un error"). Mismo patron corregido en
        // deliveries.service.ts#reprogramDelivery/registrarEntrega/
        // createDelivery (ver ese archivo).
        const trip = findTrip(tripId)
        const stop = trip?.paradas.find(s => s.id === stopId)
        if (!trip || !stop) {
          return { success: false, reason: 'not-found' as const }
        }

        const deliveries: Delivery[] = stop.deliveryIds
          .map(id => getDeliveryById(id))
          .filter((d): d is Delivery => d !== undefined)
        const blockReason = getStopNoVisitadaBlockReason(trip, stop, deliveries)
        if (blockReason) {
          return { success: false, reason: blockReason }
        }

        // Sub-clave por entrega, mismo criterio que registerPod
        // (`${idempotencyKey}-finalizar`) — cada llamado a
        // reprogramDelivery necesita su propia clave, la misma clave
        // repetida N veces cachearia solo el primer resultado para las
        // N entregas.
        const resultadosPorEntrega: MarkStopNoVisitadaDeliveryResult[] = []
        for (const deliveryId of stop.deliveryIds) {
          const result = await reprogramDelivery(
            empresaId,
            `${idempotencyKey}-${deliveryId}`,
            deliveryId,
            {
              fechaNueva: input.fechaNueva,
              motivoCodigo: input.motivoCodigo,
              motivoOtroTexto: input.motivoOtroTexto,
              motivoTipo: 'no-entrega',
              responsable: quien,
              tripId,
              stopId,
            }
          )
          resultadosPorEntrega.push({ deliveryId, success: result.success })
        }

        // Tanda 13 (hallazgo ALTO): si CUALQUIER reprogramacion fallo,
        // la Parada NO se marca NoVisitada — un "exito parcial" no es
        // un hecho real de negocio ("no se pudo entregar NADA en esta
        // parada"), es una mezcla ambigua. Las entregas que SI tuvieron
        // exito quedan reprogramadas igual (reprogramDelivery ya aplico
        // ese cambio, es un hecho fisico — mismo criterio de "no se
        // deshace" que registrarEntrega/registerPod en Tanda 8/10B):
        // no hay rollback real en este mock, y agregar uno solo para
        // este caso de borde no fue pedido. `resultadosPorEntrega`
        // queda en la respuesta para que quien llama sepa exactamente
        // que entregas reprogramo y cuales no, y pueda reintentar sobre
        // las que fallaron.
        if (resultadosPorEntrega.some(r => !r.success)) {
          return { success: false, reason: 'reprogram-failed' as const, resultadosPorEntrega }
        }

        // trip pudo cambiar (capacidadUsada/version) por cada
        // liberacion de entrega de arriba (releaseDeliveryFromTrip,
        // ADR-013 seccion 1) — se relee del store, no se reusa la
        // referencia `trip` de antes del loop.
        const tripActualizado = findTrip(tripId)!
        const paradas = tripActualizado.paradas.map(s =>
          s.id === stopId ? { ...s, estado: 'NoVisitada' as const } : s
        )
        const updated: Trip = { ...tripActualizado, paradas, updatedAt: nowISO() }
        saveTrip(updated)

        return {
          success: true,
          trip: structuredClone(withComputedFields(updated)),
          resultadosPorEntrega,
        }
      }),
  })
}
