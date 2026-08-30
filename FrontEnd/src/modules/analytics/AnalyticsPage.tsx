import { useState, type FC } from 'react';
import { ANALYTICS_DATA } from '@/data/mock/analytics.data';
import type { TimePeriod } from '@/shared/types/analytics.types';
import { TimeFilter } from './components/TimeFilter';
import { KpiCard } from './components/KpiCard';
import { SalesLineChart } from './components/SalesLineChart';
import { TopProductsChart } from './components/TopProductsChart';
import { CashFlowDonut } from './components/CashFlowDonut';
import { TopDebtorsTable } from './components/TopDebtorsTable';
import './AnalyticsPage.css';

// ============================================================
// AnalyticsPage — Advanced analytics & reporting panel
// (El componente no incluye Sidebar; es envuelto dinámicamente
// por AppShell a través de react-router en AppRouter.tsx)
// ============================================================

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

const IconRevenue: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.88 14.76V18h-1.75v-1.29c-.96-.2-1.79-.76-2.2-1.68l1.46-.85c.28.64.79 1.01 1.44 1.01.58 0 1.01-.31 1.01-.81 0-.49-.35-.76-1.28-1.05-1.3-.4-2.42-1.01-2.42-2.37 0-1.06.72-1.9 1.99-2.15V8h1.75v1.27c.8.2 1.5.73 1.89 1.5l-1.42.83c-.25-.52-.68-.82-1.23-.82-.51 0-.88.26-.88.71 0 .46.36.71 1.29.99 1.4.42 2.42 1.06 2.42 2.47 0 1.11-.76 2.01-2.07 2.31z" fill="currentColor"/>
  </svg>
);

const IconGrowth: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconOrders: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconDebt: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const AnalyticsPage: FC = () => {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const data = ANALYTICS_DATA[period];
  const { kpis } = data;

  return (
    <div className="analytics-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Analitica y Reportes</h2>
          <p className="page-header__subtitle">Panel de control avanzado para administracion</p>
        </div>
        <TimeFilter activePeriod={period} onChange={setPeriod} />
      </header>

      {/* KPI Row */}
      <div className="analytics-page__kpis">
        <KpiCard
          label="Facturacion del Periodo"
          value={formatCurrency(kpis.monthlyRevenue)}
          subtext={`${kpis.growthPercent > 0 ? '+' : ''}${kpis.growthPercent}% vs periodo anterior`}
          trend={kpis.growthPercent >= 0 ? 'up' : 'down'}
          icon={<IconRevenue />}
          variant="accent"
        />
        <KpiCard
          label="Crecimiento"
          value={`${kpis.growthPercent > 0 ? '+' : ''}${kpis.growthPercent}%`}
          subtext="Comparado con el periodo previo"
          trend={kpis.growthPercent >= 0 ? 'up' : 'down'}
          icon={<IconGrowth />}
        />
        <KpiCard
          label="Pedidos Entregados"
          value={kpis.deliveredOrders.toLocaleString('es-AR')}
          subtext="En el periodo seleccionado"
          icon={<IconOrders />}
        />
        <KpiCard
          label="Deuda Total en la Calle"
          value={formatCurrency(kpis.totalDebt)}
          subtext="Saldo pendiente de cobranza"
          trend="down"
          icon={<IconDebt />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="analytics-page__charts-primary">
        <div className="analytics-page__chart-main">
          <SalesLineChart data={data.salesTrend} />
        </div>
        <div className="analytics-page__chart-side">
          <TopProductsChart data={data.topProducts} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="analytics-page__charts-secondary">
        <div className="analytics-page__chart-donut">
          <CashFlowDonut data={data.cashFlow} />
        </div>
        <div className="analytics-page__chart-debtors">
          <TopDebtorsTable data={data.topDebtors} />
        </div>
      </div>
    </div>
  );
};
