import { type FC } from 'react';
import type { TimePeriod } from '../../../types/analytics.types';
import './TimeFilter.css';

// ============================================================
// TimeFilter — Period selector component
// ============================================================

interface PeriodOption {
  value: TimePeriod;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week',  label: 'Ultimos 7 dias' },
  { value: 'month', label: 'Este Mes' },
  { value: 'year',  label: 'Ano Actual' },
];

interface TimeFilterProps {
  activePeriod: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

export const TimeFilter: FC<TimeFilterProps> = ({ activePeriod, onChange }) => {
  return (
    <div className="time-filter" role="group" aria-label="Periodo de analisis">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`time-filter__btn${activePeriod === opt.value ? ' time-filter__btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={activePeriod === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
