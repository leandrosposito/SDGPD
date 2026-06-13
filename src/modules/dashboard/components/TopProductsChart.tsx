import type { FC } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TopProduct } from '../../../types/dashboard.types';
import { SkeletonLoader } from '../../../components/ui/SkeletonLoader';
import './TopProductsChart.css';

// ============================================================
// TopProductsChart — Horizontal bar chart of top 5 products
// ============================================================

interface TopProductsChartProps {
  products: TopProduct[];
  isLoading: boolean;
}

const CHART_COLORS = [
  '#8B5CF6',
  '#7C3AED',
  '#A78BFA',
  '#C4B5FD',
  '#6D28D9',
];

function formatUnits(value: number): string {
  return `${value.toLocaleString('es-AR')} u`;
}

const CustomTooltip: FC<{
  active?: boolean;
  payload?: Array<{ value: number; payload: TopProduct }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const product = payload[0].payload;
  return (
    <div className="chart-tooltip" role="tooltip">
      <p className="chart-tooltip__label">{product.name}</p>
      <div className="chart-tooltip__row">
        <span className="chart-tooltip__name">Categoria:</span>
        <span className="chart-tooltip__value">{product.category}</span>
      </div>
      <div className="chart-tooltip__row">
        <span className="chart-tooltip__name">Unidades:</span>
        <span className="chart-tooltip__value">{product.unitsSold.toLocaleString('es-AR')}</span>
      </div>
    </div>
  );
};

export const TopProductsChart: FC<TopProductsChartProps> = ({ products, isLoading }) => {
  return (
    <section className="top-products" aria-labelledby="top-products-title">
      <div className="top-products__header">
        <h2 id="top-products-title" className="top-products__title">
          Productos Mas Vendidos
        </h2>
        <p className="top-products__subtitle">Top 5 por unidades</p>
      </div>

      {isLoading ? (
        <div className="top-products__skeleton" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="top-products__skeleton-row">
              <SkeletonLoader width="45%" height="0.75rem" />
              <SkeletonLoader width="40%" height="0.625rem" style={{ marginTop: 'var(--space-1)' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="top-products__chart" aria-label="Grafico de productos mas vendidos">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={products}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#2E2850"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v / 1000}K`}
                  tick={{ fill: '#6B5F8A', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={0}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="unitsSold" name="Unidades" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {products.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Product list with ranks */}
          <ol className="top-products__list" aria-label="Listado de productos mas vendidos">
            {products.map((product, index) => (
              <li key={product.id} className="top-products__item">
                <span
                  className="top-products__rank"
                  style={{ color: CHART_COLORS[index] }}
                  aria-label={`Puesto ${index + 1}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="top-products__item-info">
                  <span className="top-products__item-name">{product.name}</span>
                  <span className="top-products__item-category">{product.category}</span>
                </div>
                <span className="top-products__item-units">
                  {formatUnits(product.unitsSold)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};
