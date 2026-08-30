import { create } from 'zustand';
import type { ReplenishmentStatus } from '../../../shared/types/inventory.types';

// ============================================================
// useReplenishmentStore — Estado de solicitudes de reposicion
// por producto (inventory).
//
// Sigue la convencion fijada en DECISIONES_TECNICAS.md a partir del
// primer store real del proyecto (useDeliveriesStore, logistics):
// - Vive en modules/<modulo>/state/use<Nombre>Store.ts.
// - La accion devuelve un resultado estructurado, no texto de UI;
//   quien llama decide como mostrarlo (aca, con un toast de sonner).
// - Nombres genericos, no acoplados al modulo actual (ReplenishmentStatus,
//   no InventoryReplenishmentStatus), pensando en el futuro vinculo con
//   suppliers.
// ============================================================

export type ReplenishmentActionReason = 'already-requested';

export interface ReplenishmentActionResult {
  success: boolean;
  productId: string;
  status: ReplenishmentStatus;
  reason?: ReplenishmentActionReason;
}

interface ReplenishmentState {
  statusByProductId: Record<string, ReplenishmentStatus>;
  requestReplenishment: (productId: string) => ReplenishmentActionResult;
}

export const useReplenishmentStore = create<ReplenishmentState>()((set, get) => ({
  // Nada solicitado al arrancar; es estado de sesion, no viene del mock.
  statusByProductId: {},

  requestReplenishment: (productId) => {
    const currentStatus = get().statusByProductId[productId] ?? 'not_requested';

    if (currentStatus === 'requested') {
      return { success: false, productId, status: currentStatus, reason: 'already-requested' };
    }

    set((state) => ({
      statusByProductId: { ...state.statusByProductId, [productId]: 'requested' },
    }));

    return { success: true, productId, status: 'requested' };
  },
}));
