import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../modules/dashboard/DashboardPage';
import { PlaceholderPage } from '../components/layout/PlaceholderPage';

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
            element={
              <PlaceholderPage
                title="Pedidos y Ventas"
                description="Gestion de pedidos en tiempo real, detalle de cada pedido, estado de preparacion y seguimiento de ventas."
              />
            }
          />

          {/* Inventario */}
          <Route
            path="inventario"
            element={
              <PlaceholderPage
                title="Inventario y Categorias"
                description="ABM de productos, control de stock, alertas de bajo inventario, actualizacion de precios y categorizacion."
              />
            }
          />

          {/* Clientes */}
          <Route
            path="clientes"
            element={
              <PlaceholderPage
                title="Directorio de Clientes"
                description="Fichas individuales, historial de compras, nivel de deuda y asociacion a zonas geograficas."
              />
            }
          />

          {/* Proveedores */}
          <Route
            path="proveedores"
            element={
              <PlaceholderPage
                title="Gestion de Proveedores"
                description="Base de datos de fabricantes, seguimiento de ordenes de compra para reponer stock y contactos comerciales."
              />
            }
          />

          {/* Logistica */}
          <Route
            path="logistica"
            element={
              <PlaceholderPage
                title="Logistica y Rutas"
                description="Asignacion de pedidos a repartidores, organizacion de zonas de reparto y seguimiento de entregas."
              />
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
