import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '../layouts/AppShell';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { queryClient } from '@/shared/api/queryClient';

// ============================================================
// AppRoutes — Application routes (React Router v6)
// Cada modulo pesa un chunk propio (Tanda 10A, code-splitting por
// ruta, ADR-012): import() dinamico en vez de import estatico. El
// <Suspense> que cubre la carga vive en AppShell (alrededor de
// <Outlet/>), no aca — ver el comentario en AppShell.tsx sobre por
// que no se pone al nivel de <Routes>.
// ============================================================

const DashboardPage = lazy(() =>
  import('@/modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage }))
);
const ClientsPage = lazy(() =>
  import('@/modules/clients/ClientsPage').then(m => ({ default: m.ClientsPage }))
);
const InventoryPage = lazy(() =>
  import('@/modules/inventory/InventoryPage').then(m => ({ default: m.InventoryPage }))
);
const LogisticsPage = lazy(() =>
  import('@/modules/logistics/LogisticsPage').then(m => ({ default: m.LogisticsPage }))
);
// Tanda 10B (ADR-011): capa operativa de logistica — chunks propios,
// mismo criterio de code-splitting por ruta que el resto (ADR-012).
const TripsPage = lazy(() =>
  import('@/modules/logistics/TripsPage').then(m => ({ default: m.TripsPage }))
);
const VehiclesPage = lazy(() =>
  import('@/modules/logistics/VehiclesPage').then(m => ({ default: m.VehiclesPage }))
);
const DriversPage = lazy(() =>
  import('@/modules/logistics/DriversPage').then(m => ({ default: m.DriversPage }))
);
const CashPage = lazy(() =>
  import('@/modules/cash/CashPage').then(m => ({ default: m.CashPage }))
);
const SuppliersPage = lazy(() =>
  import('@/modules/suppliers/SuppliersPage').then(m => ({ default: m.SuppliersPage }))
);
const ComprasPage = lazy(() =>
  import('@/modules/compras/ComprasPage').then(m => ({ default: m.ComprasPage }))
);
const OrdersPage = lazy(() =>
  import('@/modules/orders/OrdersPage').then(m => ({ default: m.OrdersPage }))
);
const AnalyticsPage = lazy(() =>
  import('@/modules/analytics/AnalyticsPage').then(m => ({ default: m.AnalyticsPage }))
);
const SettingsPage = lazy(() =>
  import('@/modules/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))
);

export function AppRoutes() {
  return (
    <BrowserRouter>
      {/* Boundary global (D4, DECISIONES_TECNICAS.md): red de seguridad
          de ultima instancia si algo rompe fuera de una ruta puntual
          (ej. el propio AppShell/Sidebar/Header). Vive DENTRO de
          BrowserRouter para que su fallback pueda usar <Link> (el
          boton "Volver al inicio" necesita contexto de Router). Sin
          resetKey: no esta atado a una ruta, se resetea solo por
          "Reintentar"/"Volver al inicio". */}
      <ErrorBoundary
        fallbackTitle="Ocurrio un error inesperado."
        fallbackMessage="Algo fallo al mostrar la aplicacion. Podes reintentar o volver al inicio."
      >
        {/* QueryClientProvider (Tanda 2 de escalabilidad): DENTRO del
            boundary global a proposito — si el propio provider o algo
            que dependa de el rompe, el fallback de arriba lo atrapa
            igual que cualquier otro error de render. Por encima de
            <Routes> para que TODOS los modulos (no solo los que ya
            usan usePagedQuery) compartan una unica instancia de
            queryClient. */}
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route element={<AppShell />}>
              {/* Dashboard */}
              <Route index element={<DashboardPage />} />

              {/* Pedidos y Ventas */}
              <Route
                path="pedidos"
                element={<OrdersPage />}
              />

              {/* Inventario */}
              <Route
                path="inventario"
                element={<InventoryPage />}
              />

              {/* Clientes */}
              <Route
                path="clientes"
                element={<ClientsPage />}
              />

              {/* Proveedores */}
              <Route
                path="proveedores"
                element={<SuppliersPage />}
              />

              {/* Compras */}
              <Route
                path="compras"
                element={<ComprasPage />}
              />

              {/* Logistica */}
              <Route
                path="logistica"
                element={<LogisticsPage />}
              />
              <Route
                path="logistica/viajes"
                element={<TripsPage />}
              />
              <Route
                path="logistica/vehiculos"
                element={<VehiclesPage />}
              />
              <Route
                path="logistica/choferes"
                element={<DriversPage />}
              />

              {/* Caja */}
              <Route
                path="caja"
                element={<CashPage />}
              />

              {/* Analitica */}
              <Route
                path="analitica"
                element={<AnalyticsPage />}
              />

              {/* Configuración */}
              <Route
                path="settings"
                element={<SettingsPage />}
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
