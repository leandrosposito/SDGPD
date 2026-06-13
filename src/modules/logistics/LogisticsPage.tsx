import { type FC } from 'react';
import { LOGISTICS_MOCK_DATA } from '../../data/mock/logistics.data';
import type { DeliveryStatus } from '../../types/logistics.types';
import { Badge } from '../../components/ui/Badge';
import './LogisticsPage.css';

// ============================================================
// LogisticsPage — Logistica y Reparto (Kanban board)
// ============================================================

const STATUS_COLUMNS: { id: DeliveryStatus; label: string }[] = [
  { id: 'pending', label: 'Pendiente' },
  { id: 'in_transit', label: 'En Camino' },
  { id: 'delivered', label: 'Entregado' },
];

export const LogisticsPage: FC = () => {
  return (
    <div className="logistics-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Logistica y Reparto</h2>
          <p className="page-header__subtitle">Asignacion de pedidos a rutas y seguimiento</p>
        </div>
      </header>

      <div className="logistics-page__board">
        {STATUS_COLUMNS.map((col) => {
          const columnOrders = LOGISTICS_MOCK_DATA.filter(o => o.status === col.id);
          
          return (
            <div key={col.id} className="logistics-page__column">
              <div className="logistics-page__column-header">
                <h3 className="logistics-page__column-title">{col.label}</h3>
                <span className="logistics-page__column-count">{columnOrders.length}</span>
              </div>
              
              <div className="logistics-page__column-list">
                {columnOrders.map(order => (
                  <div key={order.id} className="logistics-card">
                    <div className="logistics-card__header">
                      <span className="logistics-card__id">{order.orderNumber}</span>
                      <Badge 
                        label={order.zone} 
                        variant={order.zone === 'Norte' ? 'info' : order.zone === 'Centro' ? 'warning' : 'accent'} 
                      />
                    </div>
                    <div className="logistics-card__body">
                      <p className="logistics-card__client">{order.clientName}</p>
                      <p className="logistics-card__address">{order.address}</p>
                    </div>
                  </div>
                ))}
                {columnOrders.length === 0 && (
                  <div className="logistics-card--empty">Sin pedidos</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
