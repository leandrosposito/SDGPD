import type { FC } from 'react';
import type { KpiMetric } from '../../types/dashboard.types';
import { SkeletonLoader } from './SkeletonLoader';
import './StatCard.css';

// ============================================================
// StatCard — KPI metric display card
// ============================================================

interface StatCardProps {
  metric: KpiMetric;
}

const TrendArrowUp: FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 3L13 8H10V13H6V8H3L8 3Z"
      fill="currentColor"
    />
  </svg>
);

const TrendArrowDown: FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 13L3 8H6V3H10V8H13L8 13Z"
      fill="currentColor"
    />
  </svg>
);

export const StatCard: FC<StatCardProps> = ({ metric }) => {
  const { label, value, delta, deltaLabel, trend } = metric;
  const isPositive = trend === 'up';
  const isNeutral = trend === 'neutral';
  const trendClass = isNeutral
    ? 'stat-card__delta--neutral'
    : isPositive
    ? 'stat-card__delta--up'
    : 'stat-card__delta--down';

  return (
    <article className="stat-card" aria-label={`Metrica: ${label}`}>
      <header className="stat-card__header">
        <span className="stat-card__label">{label}</span>
      </header>

      <div className="stat-card__body">
        <span className="stat-card__value">{value}</span>
      </div>

      <footer className="stat-card__footer">
        <span className={`stat-card__delta ${trendClass}`} aria-label={`Cambio: ${delta > 0 ? '+' : ''}${delta}%`}>
          {!isNeutral && (isPositive ? <TrendArrowUp /> : <TrendArrowDown />)}
          <span>{Math.abs(delta)}%</span>
        </span>
        <span className="stat-card__delta-label">{deltaLabel}</span>
      </footer>
    </article>
  );
};

export const StatCardSkeleton: FC = () => (
  <article className="stat-card stat-card--skeleton" aria-busy="true" aria-label="Cargando metrica">
    <SkeletonLoader height="0.875rem" width="55%" />
    <SkeletonLoader height="2.5rem" width="45%" style={{ marginTop: 'var(--space-3)' }} />
    <SkeletonLoader height="0.75rem" width="70%" style={{ marginTop: 'var(--space-4)' }} />
  </article>
);
