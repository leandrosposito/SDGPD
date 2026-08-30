import { type FC } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { TopProduct } from '@/shared/types/analytics.types';
import './ChartCard.css';

// ============================================================
// TopProductsChart — Horizontal bar chart for top 5 products
// ============================================================

interface TopProductsChartProps {
  data: TopProduct[];
}

const BAR_COLORS = ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'];

function renderTooltip(props: unknown) {
  const { active, payload } = props as { active: boolean; payload: Array<{ payload: TopProduct }> };
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{d.name}</span>
      <span className="chart-tooltip__value">{d.units.toLocaleString('es-AR')} unidades</span>
    </div>
  );
}

function truncateName(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max - 1) + '.' : name;
}

export const TopProductsChart: FC<TopProductsChartProps> = ({ data }) => {
  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Top 5 Productos Vendidos</h3>
        <span className="chart-card__subtitle">por unidades</span>
      </div>
      <div className="chart-card__body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(167,139,250,0.1)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickFormatter={(v: string) => truncateName(v)}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(167,139,250,0.05)' }} />
            <Bar dataKey="units" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
