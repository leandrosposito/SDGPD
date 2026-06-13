import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../modules/dashboard/DashboardPage';
import { ClientsPage } from '../modules/clients/ClientsPage';
import { InventoryPage } from '../modules/inventory/InventoryPage';
import { LogisticsPage } from '../modules/logistics/LogisticsPage';
import { CashPage } from '../modules/cash/CashPage';
import { SuppliersPage } from '../modules/suppliers/SuppliersPage';
import { OrdersPage } from '../modules/orders/OrdersPage';
import { AnalyticsPage } from '../modules/analytics/AnalyticsPage';


// ============================================================
// AppRouter — Application routes (React Router v6)
// Each module gets its own route. Placeholder pages are
// replaced with real module components as they are built.
// ============================================================

export function AppRouter() {
  return (
    <BrowserRouter>
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

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
