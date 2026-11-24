import type { Delivery } from '@/shared/types/logistics.types'
import type { DeliveryId } from '@/shared/types/ids.types'
import type { DeliveryNote } from '@/shared/types/deliveryNote.types'
import { LOGISTICS_MOCK_DATA } from '@/data/mock/logistics.data'

// ============================================================
// deliveries.store — Unica fuente de verdad de entregas y remitos (mock).
// Los arreglos viven aca y NUNCA se exportan: el resto de los archivos
// los lee y los modifica solo a traves de estas funciones.
// (P10, DECISIONES_TECNICAS.md: variable de modulo, no un store de
// zustand — mismo patron que productsStore/stockStore.)
// ============================================================

let deliveriesStore: Delivery[] = structuredClone(LOGISTICS_MOCK_DATA)

// Remitos (Tanda 8, ADR-001): append-only, nunca se edita uno
// existente — registrarEntrega solo agrega.
let deliveryNotesStore: DeliveryNote[] = []

export function listDeliveries(): Delivery[] {
  return deliveriesStore
}

export function findDelivery(deliveryId: DeliveryId): Delivery | undefined {
  return deliveriesStore.find(d => d.id === deliveryId)
}

// Reemplaza la entrega con ese id por lo que devuelva `update`.
export function updateDelivery(deliveryId: DeliveryId, update: (d: Delivery) => Delivery): void {
  deliveriesStore = deliveriesStore.map(d => (d.id === deliveryId ? update(d) : d))
}

export function addDelivery(delivery: Delivery): void {
  deliveriesStore = [...deliveriesStore, delivery]
}

export function listDeliveryNotes(): DeliveryNote[] {
  return deliveryNotesStore
}

export function addDeliveryNote(note: DeliveryNote): void {
  deliveryNotesStore = [...deliveryNotesStore, note]
}
