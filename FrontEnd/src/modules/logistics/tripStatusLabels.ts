import type { TripStatus } from '@/shared/types/trip.types';
import type { BadgeVariant } from '@/shared/components/ui/Badge';

// ============================================================
// Etiquetas y variantes de presentacion para TripStatus (Tanda 10B).
// Mismo criterio que deliveryStatusLabels.ts: separado de los
// componentes de tabla/panel porque esos archivos solo pueden exportar
// componentes (react-refresh/only-export-components).
// ============================================================

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  Planificado: 'Planificado',
  Despachado: 'Despachado',
  EnTransito: 'En Tránsito',
  Rendido: 'Rendido',
  Cancelado: 'Cancelado',
};

export const TRIP_STATUS_VARIANT: Record<TripStatus, BadgeVariant> = {
  Planificado: 'neutral',
  Despachado: 'info',
  EnTransito: 'info',
  Rendido: 'success',
  Cancelado: 'danger',
};
