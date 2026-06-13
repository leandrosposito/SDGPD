import type { FC } from 'react';
import type { RecentOrder } from '../../../types/dashboard.types';
import { Badge, type BadgeVariant } from '../../../components/ui/Badge';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import './RecentOrdersTable.css';

// ============================================================
// RecentOrdersTable — Latest orders with status badges
// ============================================================

interface RecentOrdersTableProps {
  orders: RecentOrder[];
  isLoading: boolean;
}

const STATUS_CONFIG: Record<
  RecentOrder['status'],
  { label: string; variant: BadgeVariant }
> = {
  pending:    { label: 'Pendiente',   variant: 'warning' },
  preparing:  { label: 'Preparando',  variant: 'info'    },
  dispatched: { label: 'Despachado',  variant: 'accent'  },
  delivered:  { label: 'Entregado',   variant: 'success' },
  cancelled:  { label: 'Cancelado',   variant: 'danger'  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RecentOrdersTable: FC<RecentOrdersTableProps> = ({ orders, isLoading }) => {
  return (
    <section className="recent-orders" aria-labelledby="recent-orders-title">
      <div className="recent-orders__header">
        <div>
          <h2 id="recent-orders-title" className="recent-orders__title">
            Pedidos Recientes
          </h2>
          <p className="recent-orders__subtitle">Ultimos ingresos al sistema</p>
        </div>
        <a
          href="/pedidos"
          className="recent-orders__view-all"
          aria-label="Ver todos los pedidos"
        >
          Ver todos
        </a>
      </div>

      <div className="recent-orders__body">
        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : (
          <table
            className="recent-orders__table"
            aria-label="Tabla de pedidos recientes"
          >
            <thead>
              <tr>
                <th scope="col" className="recent-orders__th">Numero</th>
                <th scope="col" className="recent-orders__th">Cliente</th>
                <th scope="col" className="recent-orders__th">Zona</th>
                <th scope="col" className="recent-orders__th recent-orders__th--right">Total</th>
                <th scope="col" className="recent-orders__th recent-orders__th--right">Items</th>
                <th scope="col" className="recent-orders__th">Estado</th>
                <th scope="col" className="recent-orders__th">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status];
                return (
                  <tr key={order.id} className="recent-orders__row">
                    <td className="recent-orders__td">
                      <span className="recent-orders__order-num">{order.orderNumber}</span>
                    </td>
                    <td className="recent-orders__td recent-orders__td--client">
                      {order.clientName}
                    </td>
                    <td className="recent-orders__td">
                      <span className="recent-orders__zone">{order.zone}</span>
                    </td>
                    <td className="recent-orders__td recent-orders__td--right recent-orders__td--amount">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="recent-orders__td recent-orders__td--right">
                      {order.itemCount}
                    </td>
                    <td className="recent-orders__td">
                      <Badge label={statusCfg.label} variant={statusCfg.variant} />
                    </td>
                    <td className="recent-orders__td recent-orders__td--date">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
