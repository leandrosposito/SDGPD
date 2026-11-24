import type { Delivery, DeliveryHistoryEvent } from '@/shared/types/logistics.types'
import type { DeliveryId, OrderId } from '@/shared/types/ids.types'
import { asDeliveryId, asDeliveryNoteId, asDeliveryHistoryEventId } from '@/shared/types/ids.types'
import type { DeliveryNote, DeliveryNoteLine } from '@/shared/types/deliveryNote.types'
import { puedeTransicionar, computeAllowedTransitions } from '@/shared/types/deliveryStatus.types'
import { getMotivoCatalog } from '@/shared/api/motivos/motivos.service'
import { MOTIVO_OTRO_CODIGO } from '@/shared/types/motivo.types'
import { httpClient } from '@/shared/api/httpClient'
import { applyDeliveryToOrderLines, getOrderById } from '@/modules/orders/api/orders.service'
// Tanda 10B: withIdempotency se extrajo a shared/utils/idempotency.ts
// (antes vivia solo aca) para que trips.service.ts#registerPod pueda
// usar el mismo mecanismo sin duplicar el mapa clave->resultado — ver
// ese archivo para el razonamiento completo (sin cambios de
// comportamiento, mismo codigo, otro archivo).
import { withIdempotency } from '@/shared/utils/idempotency'
import type {
  RegistrarEntregaLineInput,
  RegistrarEntregaResult,
  CreateDeliveryInput,
  CreateDeliveryResult,
} from './deliveries.types'
import { addDelivery, addDeliveryNote, findDelivery, updateDelivery } from './deliveries.store'
import { appendHistoryEvent } from './deliveries.transitions'

// ============================================================
// Remitos (ADR-001, Tanda 8): registrarEntrega crea el documento
// append-only, acumula `cantidadEntregada` en las lineas del pedido
// (via orders.service.ts#applyDeliveryToOrderLines, la unica funcion
// autorizada a mutar el store de orders) y finaliza el viaje.
// ============================================================

export async function registrarEntrega(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  lines: RegistrarEntregaLineInput[],
  evidenciaIds: string[],
  creadoPor: string
): Promise<RegistrarEntregaResult> {
  return httpClient.request<RegistrarEntregaResult>({
    method: 'POST',
    path: `/deliveries/${deliveryId}/notes`,
    body: { empresaId, idempotencyKey, lines, evidenciaIds, creadoPor },
    idempotencyKey,
    mock: async () =>
      withIdempotency(idempotencyKey, async () => {
        // Tanda 15 (hallazgo MEDIO, mismo patron corregido en
        // trips.service.ts#markStopNoVisitada — ver el comentario
        // completo ahi): las precondiciones tienen que correr ADENTRO
        // de withIdempotency, no antes.
        const delivery = findDelivery(deliveryId)
        if (!delivery) {
          return { success: false, reason: 'not-found' as const }
        }
        if (!puedeTransicionar(delivery.status, 'FINALIZADO')) {
          return { success: false, reason: 'invalid-transition' as const }
        }
        if (lines.length === 0) {
          return { success: false, reason: 'no-lines' as const }
        }

        // Resuelve motivoCodigo -> texto server-side (catalogo real, no
        // lo que mande el cliente) — 'OTRO' usa motivoOtroTexto, siempre
        // que venga cargado (ADR-010 seccion 5: el texto libre bajo
        // 'OTRO' queda guardado en la linea, no se descarta).
        const catalogoRechazo = await getMotivoCatalog(empresaId, 'rechazo')
        for (const line of lines) {
          if (line.cantidadRechazada > 0 && !line.motivoCodigo) {
            return { success: false, reason: 'motivo-invalido' as const }
          }
          if (line.motivoCodigo === MOTIVO_OTRO_CODIGO && !line.motivoOtroTexto?.trim()) {
            return { success: false, reason: 'motivo-invalido' as const }
          }
        }

        const now = new Date().toISOString()
        // Tanda 10B (ADR-010 seccion 6, hallazgo de Fase A: conecta el
        // flag que Tanda 9 dejo declarado sin consumidor): si el motivo
        // elegido tiene disparaLogisticaInversa=true, la porcion
        // rechazada de la linea queda registrada como cantidad "en
        // transito de retorno" — el camion todavia no volvio al
        // deposito, asi que no es stock disponible todavia (eso lo
        // resuelve confirmarRecepcionDevolucion, fuera de alcance de
        // esta tanda), pero tampoco es invisible: existe como dato
        // propio en vez de perderse hasta que el camion vuelva.
        const noteLines: DeliveryNoteLine[] = lines.map(line => {
          const motivoItem = catalogoRechazo.find(m => m.codigo === line.motivoCodigo)
          const motivoTexto =
            line.motivoCodigo === MOTIVO_OTRO_CODIGO
              ? line.motivoOtroTexto
              : motivoItem?.descripcion
          const disparaRetorno =
            line.cantidadRechazada > 0 && (motivoItem?.disparaLogisticaInversa ?? false)
          return {
            orderLineId: line.orderLineId,
            cantidadOfrecida: line.cantidadEntregada + line.cantidadRechazada,
            cantidadEntregada: line.cantidadEntregada,
            cantidadRechazada: line.cantidadRechazada,
            motivoCodigo: line.motivoCodigo,
            motivoRechazo: motivoTexto,
            cantidadEnTransitoDeRetorno: disparaRetorno ? line.cantidadRechazada : 0,
          }
        })

        const note: DeliveryNote = {
          id: asDeliveryNoteId(`remito-${Date.now()}`),
          orderId: delivery.orderId,
          deliveryId,
          fecha: now,
          lines: noteLines,
          evidenciaIds,
          creadoEn: now,
          creadoPor,
        }

        addDeliveryNote(note)
        updateDelivery(deliveryId, d => appendHistoryEvent(d, 'FINALIZADO', creadoPor, now))

        // Fix post-Fase 2 (hallazgo A15#3 reintroducido): antes era
        // `void applyDeliveryToOrderLines(...)`, sin await ni catch —
        // la funcion devolvia `success: true` sin esperar a que la
        // propagacion terminara, asi que un fallo ahi (ej. el pedido ya
        // no existe) quedaba silencioso: el usuario veia "Entrega
        // registrada correctamente" con las lineas del pedido sin
        // actualizar. Ahora se espera, y si falla, el resultado lo dice
        // (`propagation-failed`) en vez de mentir un exito.
        //
        // El remito y la transicion a FINALIZADO de arriba NO se
        // deshacen si esto falla: son el hecho fisico ya ocurrido (la
        // entrega paso, el remito se emitio) — revertirlos simularia
        // que nunca pasaron. Lo que falla es la contabilidad derivada
        // (cuanto quedo pendiente en el pedido), que necesita
        // corregirse — quien llama a esta funcion ve
        // `reason: 'propagation-failed'` y puede avisar/reintentar en
        // vez de cerrar el flujo como si nada hubiera fallado.
        try {
          await applyDeliveryToOrderLines(
            delivery.orderId,
            lines
              .filter(l => l.cantidadEntregada > 0)
              .map(l => ({ orderLineId: l.orderLineId, cantidadEntregada: l.cantidadEntregada }))
          )
        } catch {
          return { success: false, note, reason: 'propagation-failed' as const }
        }

        return { success: true, note }
      }),
  })
}

// ============================================================
// Alta de Delivery desde un pedido (Tanda 9, hallazgo A15#1 — el item
// mas importante de esta tanda: hasta ahora no existia ninguna forma
// de que un pedido generara una entrega, las 18 del mock eran
// estaticas). Llamada "servidor a servidor" hacia
// orders.service.ts#getOrderById (misma direccion ya establecida,
// deliveries -> orders, nunca al reves — ver applyDeliveryToOrderLines
// mas arriba) para tomar clientName/direccion del pedido en vez de que
// el formulario los vuelva a tipear.
//
// collectionAmount/date/estimatedTime/zone/priority/branchId quedan a
// cargo de quien crea la entrega (formulario): no se derivan del
// pedido porque un pedido puede repartirse en mas de una entrega
// (hallazgo A15#4) y el monto a cobrar por CADA una no es un dato que
// el pedido tenga partido por entrega — inventar esa division esta
// fuera del alcance de esta tanda (eje financiero, ADR-010 seccion 1).
// ============================================================

export async function createDelivery(
  empresaId: string,
  idempotencyKey: string,
  orderId: OrderId,
  input: CreateDeliveryInput,
  quien: string
): Promise<CreateDeliveryResult> {
  return httpClient.request<CreateDeliveryResult>({
    method: 'POST',
    path: '/deliveries',
    body: { empresaId, idempotencyKey, orderId, ...input },
    idempotencyKey,
    mock: async () =>
      withIdempotency(idempotencyKey, async () => {
        // Tanda 15 (hallazgo MEDIO, mismo patron corregido en
        // trips.service.ts#markStopNoVisitada — ver el comentario
        // completo ahi): las precondiciones tienen que correr ADENTRO
        // de withIdempotency, no antes.
        const order = await getOrderById(empresaId, orderId)
        if (!order) {
          return { success: false, reason: 'order-not-found' as const }
        }
        // Solo un pedido con el eje comercial en 'Confirmado' genera
        // entrega — 'Borrador'/'Cancelado' no salen a reparto (ADR-010
        // seccion 1: se valida contra `comercial`, el campo real, nunca
        // contra el `status` deprecado).
        if (order.comercial !== 'Confirmado') {
          return { success: false, reason: 'order-not-confirmado' as const }
        }

        const now = new Date().toISOString()
        const firstEvent: DeliveryHistoryEvent = {
          id: asDeliveryHistoryEventId(`dh-${Date.now()}-0`),
          desde: null,
          hasta: 'CREADO',
          quien,
          cuando: now,
        }
        const delivery: Delivery = {
          id: asDeliveryId(`del-${Date.now()}`),
          orderId,
          branchId: input.branchId,
          clientName: order.clientName,
          address: order.clientAddress,
          date: input.date,
          estimatedTime: input.estimatedTime,
          status: 'CREADO',
          zone: input.zone,
          priority: input.priority,
          collectionAmount: input.collectionAmount,
          historial: [firstEvent],
          reprogramaciones: [],
        }

        addDelivery(delivery)
        return {
          success: true,
          delivery: { ...delivery, allowedTransitions: computeAllowedTransitions(delivery.status) },
        }
      }),
  })
}
