import { type FC } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { SalesDataPoint } from '@/shared/types/analytics.types';
import './ChartCard.css';

// ============================================================
// SalesLineChart — Revenue trend line chart
// ============================================================

interface SalesLineChartProps {
  data: SalesDataPoint[];
}

const CHART_COLORS = {
  line:     '#a78bfa',
  grid:     'rgba(167, 139, 250, 0.1)',
  tooltip:  '#1e1b2e',
};

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function renderTooltip(props: unknown) {
  const { active, payload, label } = props as { active: boolean; payload: Array<{ value: number }>; label: string };
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label}</span>
      <span className="chart-tooltip__value">
        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(payload[0].value ?? 0)}
      </span>
    </div>
  );
}

export const SalesLineChart: FC<SalesLineChartProps> = ({ data }) => {
  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Evolucion de Ventas</h3>
      </div>
      <div className="chart-card__body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrencyShort}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: CHART_COLORS.line, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={CHART_COLORS.line}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: CHART_COLORS.line, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
