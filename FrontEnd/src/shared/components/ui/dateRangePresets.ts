// ============================================================
// Presets y calculo de rangos de DateRangeFilter.tsx. Separado del
// componente porque ese archivo solo puede exportar componentes
// (react-refresh/only-export-components) — mismo criterio que
// agingLabels.ts/deliveryStatusLabels.ts/purchaseOrderLabels.ts.
// ============================================================

import { toLocalDateString as toISODateString } from '@/shared/utils/date';

export type DateRangePreset = 'all' | 'today' | 'last7days' | 'thisMonth' | 'thisQuarter' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  dateFrom?: string; // ISO yyyy-MM-dd, undefined si preset es 'all' (o 'custom' sin completar)
  dateTo?: string;
}

export const PRESET_LABEL: Record<DateRangePreset, string> = {
  all: 'Todos',
  today: 'Hoy',
  last7days: 'Ultimos 7 dias',
  thisMonth: 'Este mes',
  thisQuarter: 'Este trimestre',
  custom: 'Personalizado',
};

export const PRESET_ORDER: readonly DateRangePreset[] = [
  'all',
  'today',
  'last7days',
  'thisMonth',
  'thisQuarter',
  'custom',
];

type FixedPreset = 'today' | 'last7days' | 'thisMonth' | 'thisQuarter';

// Re-exportado con el nombre historico (Fase 0.2 de la corrida completa,
// delegado al helper unico de shared/utils/date.ts) para no tocar los
// call-sites existentes (ExportButton.tsx y los de mas abajo).
export { toISODateString };

// Rango [dateFrom, dateTo] de uno de los 4 presets fijos (no 'all', no
// 'custom' — esos dos no tienen un rango calculado, ver defaultDateRangeValue).
// dateTo es siempre HOY: el rango se abre hacia atras, nunca incluye
// fechas futuras.
export function computeDateRangeForPreset(
  preset: FixedPreset,
  today: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const dateTo = toISODateString(today);
  switch (preset) {
    case 'today':
      return { dateFrom: dateTo, dateTo };
    case 'last7days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { dateFrom: toISODateString(from), dateTo };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: toISODateString(from), dateTo };
    }
    case 'thisQuarter': {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const from = new Date(today.getFullYear(), quarterStartMonth, 1);
      return { dateFrom: toISODateString(from), dateTo };
    }
  }
}

// Valor inicial listo para useState(() => defaultDateRangeValue(...)).
// Default 'all' para listados que hoy no filtran por fecha (Compras,
// Cuentas Corrientes, Morosos); LogisticsPage pasa 'today' explicito
// para preservar su comportamiento actual (antes fijo a todayISO, ahora
// seleccionable con "Hoy" como default).
export function defaultDateRangeValue(preset: DateRangePreset = 'all'): DateRangeValue {
  if (preset === 'all' || preset === 'custom') {
    return { preset, dateFrom: undefined, dateTo: undefined };
  }
  return { preset, ...computeDateRangeForPreset(preset) };
}
