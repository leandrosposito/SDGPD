import type { FC } from 'react';
import type { KpiMetric } from '../../../types/dashboard.types';
import { StatCard, StatCardSkeleton } from '../../../components/ui/StatCard';
import './KpiGrid.css';

// ============================================================
// KpiGrid — Responsive grid of KPI metric cards
// ============================================================

interface KpiGridProps {
  metrics: KpiMetric[];
  isLoading: boolean;
}

const SKELETON_COUNT = 4;

export const KpiGrid: FC<KpiGridProps> = ({ metrics, isLoading }) => {
  if (isLoading) {
    return (
      <div className="kpi-grid" aria-busy="true" aria-label="Cargando metricas">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-grid" role="list" aria-label="Metricas principales">
      {metrics.map((metric) => (
        <div key={metric.id} role="listitem">
          <StatCard metric={metric} />
        </div>
      ))}
    </div>
  );
};
