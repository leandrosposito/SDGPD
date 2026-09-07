import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, ListChecks, AlertCircle } from 'lucide-react';
import type { OrderStatus } from '@/shared/types/order.types';
import { formatMoney } from '@/shared/utils/money';
import { useDashboardAggregates } from '../hooks/useDashboardAggregates';
import './DashboardAggregatesSection.css';

// ============================================================
// DashboardAggregatesSection — Tanda 7 de la corrida completa.
// Seccion NUEVA del tablero (ventas por zona, pedidos por estado del
// periodo, cuentas por cobrar vencidas, link a pendientes de
// preparacion) — se agrega AL LADO de KpiGrid/SalesChart/etc.
// existentes, sin tocarlos.
// ============================================================

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  dispatched: 'Despachado',
  delivered: 'Entregado',
  invoiced: 'Facturado',
  cancelled: 'Cancelado',
};

export const DashboardAggregatesSection: FC = () => {
  const { data, isLoading, error } = useDashboardAggregates();

  if (isLoading) {
    return (
      <section className="dashboard-aggregates" aria-label="Agregados del periodo">
        <div className="dashboard-aggregates__loading">Cargando agregados...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="dashboard-aggregates" aria-label="Agregados del periodo">
        <div className="dashboard-aggregates__loading">No se pudieron cargar los agregados del periodo.</div>
      </section>
    );
  }

  const pendingCount = data.ordersByStatus.find((row) => row.status === 'pending')?.cantidad ?? 0;

  return (
    <section className="dashboard-aggregates" aria-label="Agregados del periodo">
      <div className="dashboard-aggregates__grid">
        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <MapPin size={16} aria-hidden="true" /> Ventas por zona
          </div>
          {data.salesByZone.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin ventas registradas.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.salesByZone.map((row) => (
                <li key={row.zone} className="dashboard-aggregates__row">
                  <span>{row.zone}</span>
                  <span className="dashboard-aggregates__row-value">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(row.totalVentas)}
                    <small> ({row.cantidadPedidos})</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <ListChecks size={16} aria-hidden="true" /> Pedidos por estado
          </div>
          {data.ordersByStatus.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin pedidos en el periodo.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.ordersByStatus.map((row) => (
                <li key={row.status} className="dashboard-aggregates__row">
                  <span>{STATUS_LABEL[row.status]}</span>
                  <span className="dashboard-aggregates__row-value">{row.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-aggregates__card">
          <div className="dashboard-aggregates__card-title">
            <AlertCircle size={16} aria-hidden="true" /> Cuentas por cobrar vencidas
          </div>
          {data.overdueTotals.length === 0 ? (
            <p className="dashboard-aggregates__empty">Sin cuentas vencidas.</p>
          ) : (
            <ul className="dashboard-aggregates__list">
              {data.overdueTotals.map((total) => (
                <li key={total.moneda} className="dashboard-aggregates__row">
                  <span>{total.moneda}</span>
                  <span className="dashboard-aggregates__row-value">{formatMoney(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/pedidos?status=pending" className="dashboard-aggregates__card dashboard-aggregates__card--link">
          <div className="dashboard-aggregates__card-title">Pedidos pendientes de preparacion</div>
          <div className="dashboard-aggregates__big-number">
            {pendingCount}
            <ArrowRight size={18} aria-hidden="true" />
          </div>
          <p className="dashboard-aggregates__empty">Ver listado filtrado</p>
        </Link>
      </div>
    </section>
  );
};
