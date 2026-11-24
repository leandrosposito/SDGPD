import type { Delivery } from '@/shared/types/logistics.types'
import type { DeliveryId, OrderId, BranchId } from '@/shared/types/ids.types'
import type { DeliveryNote } from '@/shared/types/deliveryNote.types'
import type { DeliveryQueryFilters } from './deliveries.types'
import { findDelivery, listDeliveries, listDeliveryNotes } from './deliveries.store'
import { matchesScope } from './deliveries.scope'

// ------------------------------------------------------------
// getOrderBranchLinksForAggregation — ADR-009 (alcance del dashboard).
// Llamada "servidor a servidor" (dashboardAggregates.service.ts, otro
// modulo, la invoca) — mismo criterio que
// orders.service.ts#getOrdersSnapshotForAggregation/applyDeliveryToOrderLines:
// el arreglo del store (deliveries.store.ts) nunca se exporta,
// solo funciones que la leen bajo control de este service. No pasa
// por httpClient a proposito, mismo motivo ya documentado ahi.
//
// Es la relacion real que permite filtrar pedidos por sucursal sin
// agregarle branchId a Order (Order es alcance EMPRESA, decision ya
// cerrada) — un pedido "pertenece" a una sucursal si tiene al menos
// una Delivery con ese branchId.
// ------------------------------------------------------------
export function getOrderBranchLinksForAggregation(): { orderId: OrderId; branchId: BranchId }[] {
  return listDeliveries().map(d => ({ orderId: d.orderId, branchId: d.branchId }))
}

// ------------------------------------------------------------
// getActiveDeliveriesForOrder — Fix del hallazgo ALTO de Fase 3
// (VERIFICACION_TANDA_9.md): orders.service.ts#cancelOrder necesita
// saber, ANTES de cancelar, si el pedido tiene alguna entrega en curso.
// "Activa" = CREADO o EN_TRANSITO (las mismas que dejan botones de
// accion en DeliveriesTable) — REPROGRAMADO no aplica porque
// reprogramDelivery lo resuelve a CREADO en la misma llamada, nunca
// queda "parado" ahi (deliveryStatus.types.ts); FINALIZADO/CANCELADO
// son terminales, no bloquean cancelar el pedido.
//
// Llamada "servidor a servidor" en la direccion CONTRARIA a la ya
// documentada en este archivo (applyDeliveryToOrderLines/getOrderById
// van deliveries -> orders): a partir de este fix, orders.service.ts
// importa de este archivo tambien. Es segura — ninguno de los dos
// lados consume el import a nivel de MODULO, solo dentro del cuerpo de
// una funcion (misma razon por la que un ciclo de imports de solo
// funciones no rompe con ESM/Vite) — pero es una desviacion real de
// "una sola direccion" que no se pudo evitar sin duplicar acá el
// criterio de "que es una entrega activa" dentro de orders.service.ts.
// ------------------------------------------------------------
export function getActiveDeliveriesForOrder(orderId: OrderId): Delivery[] {
  return listDeliveries().filter(
    d => d.orderId === orderId && (d.status === 'CREADO' || d.status === 'EN_TRANSITO')
  )
}

// ------------------------------------------------------------
// getDeliveryById / getDeliveryIdsMatchingFilter — Tanda 10B: llamadas
// "servidor a servidor" (mismo criterio que getActiveDeliveriesForOrder
// y getOrderBranchLinksForAggregation) que trips.service.ts necesita:
// - getDeliveryById: registerPod confirma el estado actual de la
//   Delivery antes de finalizarla.
// - getDeliveryIdsMatchingFilter: assignDeliveriesToStop, modo
//   'filtro' (ADR-011 seccion 1) — reusa el MISMO matchesScope que
//   getDeliveriesPage en vez de reinterpretar el filtro en
//   trips.service.ts, y ademas exige status CREADO (solo lo que
//   todavia no salio a reparto es candidato a asignarse a un viaje).
// ------------------------------------------------------------
export function getDeliveryById(deliveryId: DeliveryId): Delivery | undefined {
  return findDelivery(deliveryId)
}

export function getDeliveryIdsMatchingFilter(filters: DeliveryQueryFilters): DeliveryId[] {
  return listDeliveries()
    .filter(d => matchesScope(d, filters) && d.status === 'CREADO')
    .map(d => d.id)
}

// Historial de remitos de una entrega puntual — usado por el panel de
// historial de la UI (Tanda 8). No pasa por httpClient: es una
// lectura chica y sincronica sobre un array que ya vive en memoria del
// navegador (no hay latencia real que simular para esto, a diferencia
// de un GET real).
//
// empresaId explicito por regla 3.5 del protocolo, aunque el cuerpo no
// lo use para filtrar: es un punto de entrada real (lo llama
// DeliveryHistoryModal.tsx directo, no es una llamada interna
// servidor-a-servidor), y el mock de una sola empresa no necesita
// aplicarlo — mismo criterio ya usado en el resto del proyecto para
// parametros aceptados por contrato pero no aplicados al mock.
export function getDeliveryNotesForDelivery(
  empresaId: string,
  deliveryId: DeliveryId
): DeliveryNote[] {
  void empresaId
  return listDeliveryNotes().filter(note => note.deliveryId === deliveryId)
}
