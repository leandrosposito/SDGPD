import { type FC } from 'react';

// ============================================================
// OrderDatesSection — Order date, delivery date and status
// ============================================================

interface OrderDatesSectionProps {
  orderDate: string;
  onOrderDateChange: (d: string) => void;
  deliveryDate: string;
  onDeliveryDateChange: (d: string) => void;
  initialStatus: string;
  onInitialStatusChange: (s: string) => void;
}

export const OrderDatesSection: FC<OrderDatesSectionProps> = ({
  orderDate,
  onOrderDateChange,
  deliveryDate,
  onDeliveryDateChange,
  initialStatus,
  onInitialStatusChange,
}) => {
  return (
    <section className="co-section">
      <h3 className="co-section__title">2. Fechas</h3>
      <div className="co-grid co-grid--3-cols">
        <div className="co-form-group">
          <label className="co-label">Fecha Pedido</label>
          <input
            type="date"
            className="co-input"
            value={orderDate}
            onChange={(e) => onOrderDateChange(e.target.value)}
          />
        </div>
        <div className="co-form-group">
          <label className="co-label">Fecha Entrega</label>
          <input
            type="date"
            className="co-input"
            value={deliveryDate}
            onChange={(e) => onDeliveryDateChange(e.target.value)}
          />
        </div>
        <div className="co-form-group">
          <label className="co-label">Estado Inicial</label>
          <select className="co-input" value={initialStatus} onChange={(e) => onInitialStatusChange(e.target.value)}>
            <option value="pending">Pendiente</option>
            <option value="preparing">Preparando</option>
            <option value="dispatched">Despachado</option>
            <option value="delivered">Entregado</option>
          </select>
        </div>
      </div>
    </section>
  );
};
