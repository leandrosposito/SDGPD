import { lazy, Suspense, type FC } from 'react'
import { useDashboard } from '@/shared/hooks/useDashboard'
import { KpiGrid } from './components/KpiGrid'
import { SkeletonLoader } from '@/shared/components/ui/SkeletonLoader'
import { RecentOrdersTable } from './components/RecentOrdersTable'
import { DashboardAggregatesSection } from './components/DashboardAggregatesSection'
import './DashboardPage.css'

// Los graficos usan recharts (~340 kB): se cargan aparte para que los KPIs y la
// tabla de pedidos se pinten sin esperar esa descarga. Mientras llegan se muestra
// un esqueleto con la altura aproximada del grafico, para que la pagina no salte.
const SalesChart = lazy(() =>
  import('./components/SalesChart').then(m => ({ default: m.SalesChart }))
)
const TopProductsChart = lazy(() =>
  import('./components/TopProductsChart').then(m => ({ default: m.TopProductsChart }))
)

// ============================================================
// DashboardPage — Main overview screen
// Composes all dashboard widgets, driven by useDashboard hook.
// ============================================================

export const DashboardPage: FC = () => {
  const { data, isLoading, error, refetch } = useDashboard()

  if (error) {
    return (
      <div className="dashboard-error" role="alert">
        <div className="dashboard-error__content">
          <div className="dashboard-error__icon" aria-hidden="true">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 8v4M12 16h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="dashboard-error__title">Error al cargar el Dashboard</h2>
          <p className="dashboard-error__message">{error}</p>
          <button id="dashboard-retry-btn" className="dashboard-error__retry" onClick={refetch}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard page-enter">
      {/* KPI Row */}
      <section className="dashboard__section" aria-label="Metricas clave">
        <KpiGrid metrics={data?.kpis ?? []} isLoading={isLoading} />
      </section>

      {/* Charts Row */}
      <div className="dashboard__charts-row">
        <div className="dashboard__chart-main">
          <Suspense fallback={<SkeletonLoader height="24rem" />}>
            <SalesChart data={data?.salesSeries ?? []} isLoading={isLoading} />
          </Suspense>
        </div>
        <div className="dashboard__chart-side">
          <Suspense fallback={<SkeletonLoader height="24rem" />}>
            <TopProductsChart products={data?.topProducts ?? []} isLoading={isLoading} />
          </Suspense>
        </div>
      </div>

      {/* Orders Table */}
      <section className="dashboard__section" aria-label="Pedidos recientes">
        <RecentOrdersTable orders={data?.recentOrders ?? []} isLoading={isLoading} />
      </section>

      {/* Agregados server-side nuevos (Tanda 7, corrida completa) */}
      <DashboardAggregatesSection />
    </div>
  )
}
