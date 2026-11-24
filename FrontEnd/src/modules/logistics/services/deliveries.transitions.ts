import type {
  Delivery,
  DeliveryStatus,
  DeliveryHistoryEvent,
  ReprogramacionEvent,
} from '@/shared/types/logistics.types'
import type { DeliveryId } from '@/shared/types/ids.types'
import { asDeliveryHistoryEventId } from '@/shared/types/ids.types'
import { puedeTransicionar } from '@/shared/types/deliveryStatus.types'
import { getMotivoCatalog } from '@/shared/api/motivos/motivos.service'
import { MOTIVO_OTRO_CODIGO } from '@/shared/types/motivo.types'
import { httpClient } from '@/shared/api/httpClient'

// Tanda 10B: withIdempotency se extrajo a shared/utils/idempotency.ts
// (antes vivia solo aca) para que trips.service.ts#registerPod pueda
// usar el mismo mecanismo sin duplicar el mapa clave->resultado — ver
// ese archivo para el razonamiento completo (sin cambios de
// comportamiento, mismo codigo, otro archivo).
import { withIdempotency } from '@/shared/utils/idempotency'
// Tanda 11 (ADR-013): dependencia de import EN LA DIRECCION CONTRARIA a
// la que ya existe en este archivo hacia deliveries<-orders (arriba) y
// a la que trips.service.ts ya tiene hacia este mismo archivo
// (getDeliveryById/getDeliveryIdsMatchingFilter/transitionDelivery) —
// mismo patron ya verificado seguro en Tanda 9 para
// orders.service.ts<->deliveries.service.ts: ninguno de los dos lados
// consume el import a nivel de MODULO, solo dentro del cuerpo de una
// funcion invocada despues de que ambos modulos terminaron de cargar.
import { releaseDeliveryFromTrip } from './trips.service'
import type {
  DeliveryTransitionResult,
  ReprogramDeliveryInput,
  ReprogramDeliveryResult,
} from './deliveries.types'
import { findDelivery, updateDelivery } from './deliveries.store'

// ============================================================
// Maquina de estados del viaje (ADR-002, Tanda 8). Reemplaza al viejo
// advanceDeliveryStatus (mapa lineal pending->in_transit->delivered):
// toda transicion pasa por `puedeTransicionar` antes de aplicarse, y
// queda registrada en `historial` (append-only). Contrato de
// resultado sin excepciones ni texto de UI — quien llama decide el
// toast y vuelve a pedir la pagina actual (P10).
// ============================================================

export function appendHistoryEvent(
  delivery: Delivery,
  hasta: DeliveryStatus,
  quien: string,
  cuando: string
): Delivery {
  const event: DeliveryHistoryEvent = {
    id: asDeliveryHistoryEventId(`dh-${Date.now()}-${delivery.historial.length}`),
    desde: delivery.status,
    hasta,
    quien,
    cuando,
  }
  return { ...delivery, status: hasta, historial: [...delivery.historial, event] }
}

export async function transitionDelivery(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  hasta: DeliveryStatus,
  quien: string
): Promise<DeliveryTransitionResult> {
  return httpClient.request<DeliveryTransitionResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/transition`,
    body: { empresaId, idempotencyKey, hasta, quien },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const delivery = findDelivery(deliveryId)
        if (!delivery) {
          return { success: false, deliveryId, reason: 'not-found' }
        }
        if (!puedeTransicionar(delivery.status, hasta)) {
          return {
            success: false,
            deliveryId,
            previousStatus: delivery.status,
            reason: 'invalid-transition',
          }
        }

        const previousStatus = delivery.status
        const now = new Date().toISOString()
        updateDelivery(deliveryId, d => appendHistoryEvent(d, hasta, quien, now))

        return { success: true, deliveryId, previousStatus, newStatus: hasta }
      }),
  })
}

// ------------------------------------------------------------
// Reprogramacion (ADR-002): valida la transicion a REPROGRAMADO y de
// inmediato la de vuelta a CREADO en la misma llamada — REPROGRAMADO
// nunca queda "parado" (ver deliveryStatus.types.ts). Ambos pasos
// quedan en el historial; el evento de reprogramacion en si
// (fecha anterior/nueva, motivo, responsable) vive aparte, en
// `reprogramaciones`, porque no es una transicion de estado mas, es
// el detalle de negocio de POR QUE se reprogramo.
// ------------------------------------------------------------

export async function reprogramDelivery(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  input: ReprogramDeliveryInput
): Promise<ReprogramDeliveryResult> {
  return httpClient.request<ReprogramDeliveryResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/reprogram`,
    body: { empresaId, idempotencyKey, ...input },
    idempotencyKey,
    mock: async () =>
      withIdempotency(idempotencyKey, async () => {
        // Tanda 15 (hallazgo MEDIO, mismo patron corregido en
        // trips.service.ts#markStopNoVisitada — ver el comentario
        // completo ahi): las precondiciones tienen que correr ADENTRO
        // de withIdempotency. Antes corrian afuera; un segundo llamado
        // con la misma clave (reintento de httpClient o del usuario)
        // volvia a leer `delivery` YA reprogramado por el primer
        // intento exitoso y devolvia 'invalid-transition' (REPROGRAMADO
        // no puede volver a transicionar a REPROGRAMADO) en vez del
        // resultado cacheado de exito — violando el contrato de
        // ADR-010 seccion 4.
        const delivery = findDelivery(deliveryId)
        if (!delivery) {
          return { success: false, deliveryId, reason: 'not-found' as const }
        }
        if (!puedeTransicionar(delivery.status, 'REPROGRAMADO')) {
          return { success: false, deliveryId, reason: 'invalid-transition' as const }
        }
        if (!input.motivoCodigo) {
          return { success: false, deliveryId, reason: 'motivo-invalido' as const }
        }
        if (input.motivoCodigo === MOTIVO_OTRO_CODIGO && !input.motivoOtroTexto?.trim()) {
          return { success: false, deliveryId, reason: 'motivo-invalido' as const }
        }

        // Resuelve motivoCodigo -> texto server-side, mismo criterio que
        // registrarEntrega (nunca confia en texto que mande el cliente).
        const catalogo = await getMotivoCatalog(empresaId, input.motivoTipo)
        const motivoTexto =
          input.motivoCodigo === MOTIVO_OTRO_CODIGO
            ? input.motivoOtroTexto!.trim()
            : catalogo.find(m => m.codigo === input.motivoCodigo)?.descripcion
        if (!motivoTexto) {
          return { success: false, deliveryId, reason: 'motivo-invalido' as const }
        }

        const now = new Date().toISOString()
        const reprogEvent: ReprogramacionEvent = {
          fechaAnterior: delivery.date,
          fechaNueva: input.fechaNueva,
          motivo: motivoTexto,
          motivoCodigo: input.motivoCodigo,
          responsable: input.responsable,
          timestamp: now,
          tripId: input.tripId,
          stopId: input.stopId,
        }

        updateDelivery(deliveryId, d => {
          const withReprogramado = appendHistoryEvent(d, 'REPROGRAMADO', input.responsable, now)
          const withCreado = appendHistoryEvent(withReprogramado, 'CREADO', input.responsable, now)
          return {
            ...withCreado,
            date: input.fechaNueva,
            reprogramaciones: [...d.reprogramaciones, reprogEvent],
          }
        })

        // ADR-013 seccion 1: si esta entrega estaba asignada a la
        // Parada de algun viaje, la libera (recalcula capacidadUsada/
        // sobrecargado, incrementa version) — sin esto quedaba
        // "fantasma" en el viaje pese a tener fecha/estado nuevos.
        // "Volver a la cola de pendientes" no es una cola nueva: con la
        // entrega en CREADO (arriba) y sin ningun viaje que la
        // referencie (aca), ya vuelve a cumplir las dos condiciones que
        // CreateTripModal/getDeliveryIdsMatchingFilter usan para
        // considerarla candidata.
        releaseDeliveryFromTrip(deliveryId)

        return { success: true, deliveryId }
      }),
  })
}
