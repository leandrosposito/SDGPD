import type { FC } from 'react';
import type { Order } from '../../../types/order.types';
import './OrderKpis.css';

// ============================================================
// OrderKpis — Mini-Dashboard superior para métricas
// ============================================================

interface OrderKpisProps {
  orders: Order[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const OrderKpis: FC<OrderKpisProps> = ({ orders }) => {
  // Filtramos por una fecha falsa simulada "hoy" (ejemplo 2026-06-13)
  // En un sistema real se usa new Date()
  const today = '2026-06-13';
  
  const todayOrders = orders.filter(o => o.date.startsWith(today));
  
  const countToday = todayOrders.length;
  const countPending = orders.filter(o => o.status === 'pending').length;
  const countPreparing = orders.filter(o => o.status === 'preparing').length;
  const countDispatched = orders.filter(o => o.status === 'dispatched').length;
  
  // Facturación de hoy: Sumamos aquellos facturados, entregados o que sumen caja hoy
  const billingToday = todayOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.totalAmount, 0);

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
