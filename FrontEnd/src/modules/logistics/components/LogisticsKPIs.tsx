import { type FC } from 'react';
import { type LogisticsOrder } from '../../../shared/types/logistics.types';
import '../LogisticsPage.css';

interface LogisticsKPIsProps {
  orders: LogisticsOrder[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const LogisticsKPIs: FC<LogisticsKPIsProps> = ({ orders }) => {
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const deliveryProgress = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

  const pendingCollection = orders
    .filter(o => o.status === 'in_transit' || o.status === 'pending')
    .reduce((acc, order) => acc + order.collectionAmount, 0);

  return (
    <div className="logistics-kpis">
      <div className="logistics-kpi-card">
        <div className="logistics-kpi-content">
          <span className="logistics-kpi-label">Entregas del Dia</span>
          <span className="logistics-kpi-value">{deliveredOrders} / {totalOrders}</span>
          <div className="logistics-kpi-progress-bg">
            <div 
              className="logistics-kpi-progress-bar" 
              style={{ width: `${deliveryProgress}%` }}
            ></div>
          </div>
        </div>
        <div className="logistics-kpi-icon logistics-kpi-icon--blue">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
      </div>

      <div className="logistics-kpi-card">
        <div className="logistics-kpi-content">
          <span className="logistics-kpi-label">Efectivo en la Calle</span>
          <span className="logistics-kpi-value text-accent">{formatCurrency(pendingCollection)}</span>
          <span className="logistics-kpi-subtext">Cobros pendientes en ruta</span>
        </div>
        <div className="logistics-kpi-icon logistics-kpi-icon--accent">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};
