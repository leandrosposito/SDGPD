import type { DeliveryStatus } from '@/shared/types/logistics.types';
import type { BadgeVariant } from '@/shared/components/ui/Badge';

// ============================================================
// Etiquetas y variantes de presentacion para DeliveryStatus.
// Separado de DeliveriesTable.tsx porque ese archivo solo puede
// exportar componentes (react-refresh/only-export-components).
// ============================================================

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pendiente',
  in_transit: 'En Ruta',
  delivered: 'Completada',
};

export const DELIVERY_STATUS_VARIANT: Record<DeliveryStatus, BadgeVariant> = {
  pending: 'warning',
  in_transit: 'info',
  delivered: 'success',
};
