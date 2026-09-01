import type { AgingBucket } from '@/shared/types/client.types';
import type { BadgeVariant } from '@/shared/components/ui/Badge';

// ============================================================
// Etiquetas y variantes de presentacion para AgingBucket. Separado de
// ClientOverdueTable.tsx porque ese archivo solo puede exportar
// componentes (react-refresh/only-export-components) — mismo criterio
// que deliveryStatusLabels.ts respecto de DeliveriesTable.tsx.
// ============================================================

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  '1-30': '1-30 dias',
  '31-60': '31-60 dias',
  '61-90': '61-90 dias',
  '90+': '+90 dias',
};

export const AGING_BUCKET_VARIANT: Record<AgingBucket, BadgeVariant> = {
  '1-30': 'info',
  '31-60': 'warning',
  '61-90': 'danger',
  '90+': 'danger',
};

export const AGING_BUCKET_ORDER: readonly AgingBucket[] = ['1-30', '31-60', '61-90', '90+'];
