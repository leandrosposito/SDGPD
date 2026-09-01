import type { BadgeVariant } from '@/shared/components/ui/Badge';
import type { PurchaseOrderStatus } from '@/shared/types/purchaseOrder.types';

// ============================================================
// Etiquetas y variantes de estado de OrdenDeCompra (O7). Separado del
// componente por react-refresh/only-export-components, mismo criterio
// que agingLabels.ts (clients) / deliveryStatusLabels.ts (logistics).
// ============================================================

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

export const PURCHASE_ORDER_STATUS_VARIANT: Record<PurchaseOrderStatus, BadgeVariant> = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
};

export const PURCHASE_ORDER_STATUS_ORDER: readonly PurchaseOrderStatus[] = [
  'draft',
  'sent',
  'received',
  'cancelled',
];
