import { type FC } from 'react';
import { type LogisticsOrder } from '@/shared/types/logistics.types';
import { Badge } from '@/shared/components/ui/Badge';
import '../LogisticsPage.css';

interface LogisticsCardProps {
  order: LogisticsOrder;
  onMoveToDelivery?: (orderId: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const LogisticsCard: FC<LogisticsCardProps> = ({ order, onMoveToDelivery }) => {
  return (
    <div className={`logistics-card logistics-card--priority-${order.priority}`}>
      <div className="logistics-card__header">
        <span className="logistics-card__id">{order.orderNumber}</span>
        <Badge 
          label={order.zone} 
          variant={order.zone === 'Norte' ? 'info' : order.zone === 'Centro' ? 'warning' : 'accent'} 
        />
      </div>
      <div className="logistics-card__body">
        <p className="logistics-card__client">{order.clientName}</p>
        <p className="logistics-card__address">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          {order.address}
        </p>
      </div>
      <div className="logistics-card__footer">
        <span className="logistics-card__amount">{formatCurrency(order.collectionAmount)}</span>
        
        {order.status === 'in_transit' && onMoveToDelivery && (
          <button 
            className="logistics-card__action-btn"
            onClick={() => onMoveToDelivery(order.id)}
            title="Marcar como Entregado"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Entregar
          </button>
        )}
      </div>
    </div>
  );
};
