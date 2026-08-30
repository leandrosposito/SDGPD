import { create } from 'zustand';
import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types';
import { LOGISTICS_MOCK_DATA } from '@/data/mock/logistics.data';

// ============================================================
// useDeliveriesStore — Estado global de entregas (logistics)
//
// Convencion de referencia para futuros stores de zustand del
// proyecto (primer uso real, ver DECISIONES_TECNICAS.md):
// - Vive en modules/<modulo>/state/use<Nombre>Store.ts mientras
//   el estado sea especifico de un modulo; shared/state/ usa la
//   misma carpeta "state/" para que promoverlo sea mover el
//   archivo, no reescribirlo.
// - Las acciones de negocio (advanceDeliveryStatus) devuelven un
//   resultado estructurado en vez de lanzar excepciones o incluir
//   texto de UI: quien llama decide como mostrarlo (en este caso,
//   un toast de sonner). Esto mantiene el store generico y
//   reutilizable si en el futuro se mueve a shared/.
// ============================================================

// Transiciones validas: unidireccionales, un paso a la vez.
// No estar en este mapa (ej. 'delivered') implica estado terminal.
const DELIVERY_STATUS_FLOW: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  pending: 'in_transit',
  in_transit: 'delivered',
};

export type DeliveryStatusTransitionReason = 'not-found' | 'terminal-status';

export interface DeliveryStatusTransitionResult {
  success: boolean;
  deliveryId: string;
  previousStatus?: DeliveryStatus;
  newStatus?: DeliveryStatus;
  reason?: DeliveryStatusTransitionReason;
}

interface DeliveriesState {
  deliveries: Delivery[];
  setDeliveries: (deliveries: Delivery[]) => void;
  advanceDeliveryStatus: (deliveryId: string) => DeliveryStatusTransitionResult;
}

export const useDeliveriesStore = create<DeliveriesState>()((set, get) => ({
  // Semilla mock por ahora; el dia que exista API real, un fetch
  // llama a setDeliveries(resultado) sin cambiar el resto del store.
  deliveries: LOGISTICS_MOCK_DATA,

  setDeliveries: (deliveries) => set({ deliveries }),

  advanceDeliveryStatus: (deliveryId) => {
    const delivery = get().deliveries.find((d) => d.id === deliveryId);

    if (!delivery) {
      return { success: false, deliveryId, reason: 'not-found' };
    }

    const nextStatus = DELIVERY_STATUS_FLOW[delivery.status];

    if (!nextStatus) {
      return {
        success: false,
        deliveryId,
        previousStatus: delivery.status,
        reason: 'terminal-status',
      };
    }

    set((state) => ({
      deliveries: state.deliveries.map((d) =>
        d.id === deliveryId ? { ...d, status: nextStatus } : d
      ),
    }));

    return {
      success: true,
      deliveryId,
      previousStatus: delivery.status,
      newStatus: nextStatus,
    };
  },
}));
