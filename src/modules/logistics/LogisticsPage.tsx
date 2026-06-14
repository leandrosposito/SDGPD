import { useState, type FC } from 'react';
import { LOGISTICS_MOCK_DATA } from '../../data/mock/logistics.data';
import type { DeliveryStatus, LogisticsOrder } from '../../types/logistics.types';
import { LogisticsKPIs } from './components/LogisticsKPIs';
import { LogisticsCard } from './components/LogisticsCard';
import { DeliveryProofModal } from './components/DeliveryProofModal';
import './LogisticsPage.css';

// ============================================================
// LogisticsPage — Logistica y Reparto (Kanban board)
// ============================================================

const STATUS_COLUMNS: { id: DeliveryStatus; label: string; showCapacity?: boolean }[] = [
  { id: 'pending', label: 'Pendiente' },
  { id: 'in_transit', label: 'En Camino', showCapacity: true },
  { id: 'delivered', label: 'Entregado' },
];

export const LogisticsPage: FC = () => {
  const [orders, setOrders] = useState<LogisticsOrder[]>(LOGISTICS_MOCK_DATA);
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState<LogisticsOrder | null>(null);

  const handlePrintRoute = () => {
    // Mock print action
    console.log('Imprimiendo hoja de ruta...');
  };

  const handleMoveToDelivery = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedDeliveryOrder(order);
    }
  };

  const handleConfirmDelivery = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o));
    setSelectedDeliveryOrder(null);
  };

  return (
    <div className="logistics-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Logistica y Reparto</h2>
          <p className="page-header__subtitle">Tablero de control de envios y entregas</p>
        </div>
        <div className="page-header__actions">
          <button className="logistics-header-btn" onClick={handlePrintRoute}>
            Imprimir Hoja de Ruta
          </button>
        </div>
      </header>

      <LogisticsKPIs orders={orders} />

      <div className="logistics-page__board">
        {STATUS_COLUMNS.map((col) => {
          const columnOrders = orders.filter(o => o.status === col.id);
          
          return (
            <div key={col.id} className="logistics-page__column">
              <div className="logistics-page__column-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 className="logistics-page__column-title">{col.label}</h3>
                  <span className="logistics-page__column-count">{columnOrders.length}</span>
                </div>
                
                {col.showCapacity && (
                  <div className="logistics-capacity">
                    <div className="logistics-capacity-header">
                      <span className="logistics-capacity-label">Capacidad del Vehiculo</span>
                      <span className="logistics-capacity-value">85%</span>
                    </div>
                    <div className="logistics-capacity-bg">
                      <div className="logistics-capacity-bar" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="logistics-page__column-list">
                {columnOrders.map(order => (
                  <LogisticsCard 
                    key={order.id} 
                    order={order} 
                    onMoveToDelivery={col.id === 'in_transit' ? handleMoveToDelivery : undefined} 
                  />
                ))}
                {columnOrders.length === 0 && (
                  <div className="logistics-card--empty">Sin pedidos</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DeliveryProofModal
        isOpen={!!selectedDeliveryOrder}
        onClose={() => setSelectedDeliveryOrder(null)}
        order={selectedDeliveryOrder}
        onConfirmDelivery={handleConfirmDelivery}
      />
    </div>
  );
};
