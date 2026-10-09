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

// DateRangeValue completo para un preset: 'all'/'custom' sin fechas, los
// 4 presets fijos con su rango calculado al momento (`today` inyectable
// para el smoke). Lo usa readDateRangeFromUrl.
export function defaultDateRangeValue(preset: DateRangePreset = 'all', today: Date = new Date()): DateRangeValue {
  if (preset === 'all' || preset === 'custom') {
    return { preset, dateFrom: undefined, dateTo: undefined };
  }
  return { preset, ...computeDateRangeForPreset(preset, today) };
}

// ============================================================
// Rango de fechas en la URL (Tanda 24; regla en PROTOCOLO 3.8). UNICO
// lugar que lee y escribe preset/from/to — los 5 listados con
// DateRangeFilter (Logistica, Compras, Pendientes de Recepcion, Cuentas
// Corrientes, Morosos) pasan por aca, ninguno arma el rango a mano.
//
// - La URL es la fuente de verdad. `preset` va siempre que no sea el
//   default del listado; `from`/`to` van SOLO con preset=custom.
// - Preset fijo (today, last7days, thisMonth, thisQuarter): el rango se
//   calcula al renderizar; si la URL trae from/to junto a un preset fijo
//   (o a 'all'), se ignoran — un link viejo de "Este mes" filtra por el
//   mes actual, no por el del link.
// - preset=custom: from/to salen de la URL.
// - from/to sin preset: se interpreta como custom.
// - Sin nada (o con un preset que no existe): el default del listado.
// ============================================================

export interface DateRangeUrlParams {
  preset?: string;
  from?: string;
  to?: string;
}

function isDateRangePreset(raw: string): raw is DateRangePreset {
  return (PRESET_ORDER as readonly string[]).includes(raw);
}

export function readDateRangeFromUrl(
  params: DateRangeUrlParams,
  defaultPreset: DateRangePreset,
  today: Date = new Date()
): DateRangeValue {
  const urlPreset = params.preset && isDateRangePreset(params.preset) ? params.preset : undefined;
  const hasDates = Boolean(params.from || params.to);
  const preset: DateRangePreset = urlPreset ?? (hasDates ? 'custom' : defaultPreset);
  if (preset === 'custom') {
    return { preset, dateFrom: params.from || undefined, dateTo: params.to || undefined };
  }
  return defaultDateRangeValue(preset, today);
}

export function dateRangeToUrlParams(
  value: DateRangeValue,
  defaultPreset: DateRangePreset
): { preset: string | undefined; from: string | undefined; to: string | undefined } {
  const isCustom = value.preset === 'custom';
  return {
    preset: value.preset === defaultPreset ? undefined : value.preset,
    from: isCustom ? value.dateFrom : undefined,
    to: isCustom ? value.dateTo : undefined,
  };
}
