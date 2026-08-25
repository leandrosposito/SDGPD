import { type FC } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import type { CashFlowData } from '../../../shared/types/analytics.types';
import './ChartCard.css';

// ============================================================
// CashFlowDonut — Income vs Expenses doughnut chart
// ============================================================

interface CashFlowDonutProps {
  data: CashFlowData;
}

const COLORS = { income: '#8b5cf6', expenses: '#4b5563' };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function renderTooltip(props: unknown) {
  const { active, payload } = props as { active: boolean; payload: Array<{ name: string; value: number }> };
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{payload[0].name}</span>
      <span className="chart-tooltip__value">{formatCurrency(payload[0].value ?? 0)}</span>
    </div>
  );
}

export const CashFlowDonut: FC<CashFlowDonutProps> = ({ data }) => {
  const chartData = [
    { name: 'Ingresos',  value: data.income },
    { name: 'Egresos',   value: data.expenses },
  ];

  const total = data.income + data.expenses;

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Ingresos vs Egresos</h3>
      </div>
      <div className="cashflow-donut__layout">
        <div className="cashflow-donut__chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="82%"
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name === 'Ingresos' ? COLORS.income : COLORS.expenses}
                  />
                ))}
              </Pie>
              <Tooltip content={renderTooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="cashflow-donut__center-label" aria-hidden="true">
            <span className="cashflow-donut__center-pct">
              {total > 0 ? Math.round((data.income / total) * 100) : 0}%
            </span>
            <span className="cashflow-donut__center-sub">Ingresos</span>
          </div>
        </div>

        <div className="chart-legend">
          <div className="chart-legend__item">
            <span className="chart-legend__dot" style={{ backgroundColor: COLORS.income }} />
            <span className="chart-legend__label">Ingresos</span>
            <span className="chart-legend__value">{formatCurrency(data.income)}</span>
          </div>
          <div className="chart-legend__item">
            <span className="chart-legend__dot" style={{ backgroundColor: COLORS.expenses }} />
            <span className="chart-legend__label">Egresos</span>
            <span className="chart-legend__value">{formatCurrency(data.expenses)}</span>
          </div>
          <div className="chart-legend__item cashflow-donut__net">
            <span className="chart-legend__dot" style={{ backgroundColor: 'transparent' }} />
            <span className="chart-legend__label">Resultado Neto</span>
            <span className="chart-legend__value">{formatCurrency(data.income - data.expenses)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
