import type { FC } from 'react';
import type { OrdersAggregates } from '../api/orders.service';
import './OrderKpis.css';

// ============================================================
// OrderKpis — Mini-Dashboard superior para métricas
//
// Tanda 3a: recibe `aggregates`, ya calculados server-side (P3,
// DECISIONES_TECNICAS.md), en vez de recorrer el array de pedidos en
// memoria — antes de esta tanda calculaba esto sobre `orders`
// completo, que ahora (paginado) solo trae la página actual. Puede
// venir `undefined` mientras `usePagedQuery` todavía no resolvió la
// primera carga.
// ============================================================

interface OrderKpisProps {
  aggregates: OrdersAggregates | undefined;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const OrderKpis: FC<OrderKpisProps> = ({ aggregates }) => {
  const countToday = aggregates?.todayCount ?? 0;
  const countPending = aggregates?.pendingCount ?? 0;
  const countPreparing = aggregates?.preparingCount ?? 0;
  const countDispatched = aggregates?.dispatchedCount ?? 0;
  const billingToday = aggregates?.todayBilling ?? 0;

  return (
    <div className="order-kpis">
      <div className="order-kpis__card">
        <p className="order-kpis__label">Pedidos Hoy</p>
        <p className="order-kpis__value">{countToday}</p>
      </div>
      <div className="order-kpis__card">
        <p className="order-kpis__label">Pendientes</p>
        <p className="order-kpis__value text-warning">{countPending}</p>
      </div>
      <div className="order-kpis__card">
        <p className="order-kpis__label">Preparando</p>
        <p className="order-kpis__value text-accent">{countPreparing}</p>
      </div>
      <div className="order-kpis__card">
        <p className="order-kpis__label">Despachados</p>
        <p className="order-kpis__value text-secondary">{countDispatched}</p>
      </div>
      <div className="order-kpis__card">
        <p className="order-kpis__label">Facturacion Hoy</p>
        <p className="order-kpis__value text-success">{formatCurrency(billingToday)}</p>
      </div>
    </div>
  );
};
