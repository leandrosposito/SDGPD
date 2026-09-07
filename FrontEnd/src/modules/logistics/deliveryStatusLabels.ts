import type { DeliveryStatus } from '@/shared/types/logistics.types';
import type { BadgeVariant } from '@/shared/components/ui/Badge';

// ============================================================
// Etiquetas y variantes de presentacion para DeliveryStatus.
// Separado de DeliveriesTable.tsx porque ese archivo solo puede
// exportar componentes (react-refresh/only-export-components).
//
// 5 estados de ADR-002 (Tanda 8, corrida completa) — REPROGRAMADO
// prácticamente nunca se ve en la tabla (es transitorio, vuelve a
// CREADO en la misma operacion, ver deliveryStatus.types.ts) pero
// tiene su propio label/variant por completitud del tipo.
// ============================================================

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  CREADO: 'Creada',
  EN_TRANSITO: 'En Ruta',
  FINALIZADO: 'Finalizada',
  REPROGRAMADO: 'Reprogramada',
  CANCELADO: 'Cancelada',
};

export const DELIVERY_STATUS_VARIANT: Record<DeliveryStatus, BadgeVariant> = {
  CREADO: 'neutral',
  EN_TRANSITO: 'info',
  FINALIZADO: 'success',
  REPROGRAMADO: 'warning',
  CANCELADO: 'danger',
};
