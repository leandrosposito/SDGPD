import type { FC } from 'react';
import { Calendar } from 'lucide-react';
import { PRESET_LABEL, PRESET_ORDER, computeDateRangeForPreset, type DateRangePreset, type DateRangeValue } from './dateRangePresets';
import './DateRangeFilter.css';

// ============================================================
// DateRangeFilter — Selector de rango de fechas generico y reusable
// (tarea transversal, DECISIONES_TECNICAS.md). Vive en shared/ui/ (no
// es de ningun modulo) porque los listados que lo consumen no pueden
// importarse un componente entre si (R2) — mismo criterio que
// Table/Pagination/Tabs. Presets y calculo de rangos en
// dateRangePresets.ts (react-refresh/only-export-components).
// ============================================================

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  // Prefijo unico para los ids de los inputs (varios DateRangeFilter
  // pueden convivir en la misma pagina, ej. Compras con dos tabs).
  idPrefix: string;
  label?: string;
}

export const DateRangeFilter: FC<DateRangeFilterProps> = ({
  value,
  onChange,
  idPrefix,
  label = 'Rango de fechas',
}) => {
  function handlePresetChange(preset: DateRangePreset) {
    if (preset === 'all') {
      onChange({ preset, dateFrom: undefined, dateTo: undefined });
      return;
    }
    if (preset === 'custom') {
      // Arranca desde el rango actual (si habia uno) en vez de vaciar
      // los inputs — el usuario ajusta desde ahi en vez de completar
      // dos campos vacios de cero.
      onChange({ preset, dateFrom: value.dateFrom, dateTo: value.dateTo });
      return;
    }
    onChange({ preset, ...computeDateRangeForPreset(preset) });
  }

  return (
    <div className="date-range-filter">
      <label className="date-range-filter__label" htmlFor={`${idPrefix}-date-preset`}>
        <Calendar size={14} aria-hidden="true" />
        {label}
      </label>
      <select
        id={`${idPrefix}-date-preset`}
        className="date-range-filter__select"
        value={value.preset}
        onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
      >
        {PRESET_ORDER.map((preset) => (
          <option key={preset} value={preset}>
            {PRESET_LABEL[preset]}
          </option>
        ))}
      </select>

      {value.preset === 'custom' && (
        <div className="date-range-filter__custom">
          <label className="date-range-filter__custom-field">
            <span className="date-range-filter__custom-label">Desde</span>
            <input
              type="date"
              id={`${idPrefix}-date-from`}
              className="date-range-filter__custom-input"
              value={value.dateFrom ?? ''}
              max={value.dateTo || undefined}
              onChange={(e) => onChange({ preset: 'custom', dateFrom: e.target.value || undefined, dateTo: value.dateTo })}
            />
          </label>
          <label className="date-range-filter__custom-field">
            <span className="date-range-filter__custom-label">Hasta</span>
            <input
              type="date"
              id={`${idPrefix}-date-to`}
              className="date-range-filter__custom-input"
              value={value.dateTo ?? ''}
              min={value.dateFrom || undefined}
              onChange={(e) => onChange({ preset: 'custom', dateFrom: value.dateFrom, dateTo: e.target.value || undefined })}
            />
          </label>
        </div>
      )}
    </div>
  );
};
