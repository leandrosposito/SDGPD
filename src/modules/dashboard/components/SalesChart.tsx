import { useState, type FC } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { SalesDataPoint } from '../../../types/dashboard.types';
import { SkeletonLoader } from '../../../components/ui/SkeletonLoader';
import './SalesChart.css';

// ============================================================
// SalesChart — Monthly revenue evolution with view toggle
// ============================================================

interface SalesChartProps {
  data: SalesDataPoint[];
  isLoading: boolean;
}

type ChartView = 'area' | 'bar';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRevenue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const CustomTooltip: FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip" role="tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip__row">
          <span
            className="chart-tooltip__dot"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          <span className="chart-tooltip__name">{entry.name}:</span>
          <span className="chart-tooltip__value">
            {entry.name === 'Ingresos' ? formatCurrency(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SalesChart: FC<SalesChartProps> = ({ data, isLoading }) => {
  const [view, setView] = useState<ChartView>('area');

  const chartStyle = {
    '--color-chart-1': 'var(--color-chart-1)',
    '--color-chart-2': 'var(--color-chart-2)',
  } as React.CSSProperties;

  return (
    <section className="sales-chart" aria-labelledby="sales-chart-title">
      <div className="sales-chart__header">
        <div>
          <h2 id="sales-chart-title" className="sales-chart__title">
            Evolucion de Ingresos
          </h2>
          <p className="sales-chart__subtitle">Comparativo anual mensual</p>
        </div>
        <div className="sales-chart__toggle" role="group" aria-label="Tipo de grafico">
          <button
            id="sales-chart-area-btn"
            className={`sales-chart__toggle-btn${view === 'area' ? ' sales-chart__toggle-btn--active' : ''}`}
            onClick={() => setView('area')}
            aria-pressed={view === 'area'}
          >
            Area
          </button>
          <button
            id="sales-chart-bar-btn"
            className={`sales-chart__toggle-btn${view === 'bar' ? ' sales-chart__toggle-btn--active' : ''}`}
            onClick={() => setView('bar')}
            aria-pressed={view === 'bar'}
          >
            Barras
          </button>
        </div>
      </div>

      <div className="sales-chart__body" style={chartStyle} aria-label="Grafico de ventas mensuales">
        {isLoading ? (
          <SkeletonLoader height="100%" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {view === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2E2850" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6B5F8A', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatRevenue}
                  tick={{ fill: '#6B5F8A', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#9B8EC4', fontSize: '0.8rem' }}>{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ingresos"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8B5CF6', stroke: '#0C0A14', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#2E2850" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6B5F8A', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatRevenue}
                  tick={{ fill: '#6B5F8A', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#9B8EC4', fontSize: '0.8rem' }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="revenue"
                  name="Ingresos"
                  fill="#7C3AED"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="orders"
                  name="Pedidos"
                  fill="#A78BFA"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};
