import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { ClientsPage } from '@/modules/clients/ClientsPage';
import { InventoryPage } from '@/modules/inventory/InventoryPage';
import { LogisticsPage } from '@/modules/logistics/LogisticsPage';
import { CashPage } from '@/modules/cash/CashPage';
import { SuppliersPage } from '@/modules/suppliers/SuppliersPage';
import { ComprasPage } from '@/modules/compras/ComprasPage';
import { OrdersPage } from '@/modules/orders/OrdersPage';
import { AnalyticsPage } from '@/modules/analytics/AnalyticsPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';


// ============================================================
// AppRoutes — Application routes (React Router v6)
// Each module gets its own route. Placeholder pages are
// replaced with real module components as they are built.
// ============================================================

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
      </ErrorBoundary>
    </BrowserRouter>
  );
}
