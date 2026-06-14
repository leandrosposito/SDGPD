import { type FC } from 'react';
import { SidePanel } from '../../../components/ui/SidePanel';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import type { Order, OrderStatus } from '../../../types/order.types';
import './OrderDetailPanel.css';

// ============================================================
// OrderDetailPanel — Side panel with order breakdown
// ============================================================

interface OrderDetailPanelProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStatus: (order: Order) => void;
  onCancel: (order: Order) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:    'Pasar a Preparando',
  preparing:  'Despachar Pedido',
  dispatched: 'Confirmar Entrega',
  delivered:  'Facturar Pedido',
};

const SOURCE_LABEL: Record<string, string> = {
  mobile: 'App Movil',
  manual: 'Carga Manual',
};

const SOURCE_VARIANT: Record<string, 'info' | 'neutral'> = {
  mobile: 'info',
  manual: 'neutral',
};

export const OrderDetailPanel: FC<OrderDetailPanelProps> = ({
  order,
  isOpen,
  onClose,
  onAdvanceStatus,
  onCancel,
}) => {
  if (!order) return null;

  const advanceLabel = ADVANCE_LABEL[order.status];
  const canCancel = order.status !== 'delivered' && order.status !== 'invoiced' && order.status !== 'cancelled';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={order.orderNumber}
      subtitle={`${order.clientName} — ${order.clientZone}`}
    >
      <div className="order-detail">
        {/* Header metadata */}
        <div className="order-detail__meta">
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Fecha y Hora</span>
            <span className="order-detail__meta-value">{formatDateFull(order.date)}</span>
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Vendedor</span>
            <span className="order-detail__meta-value">{order.sellerName}</span>
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Direccion</span>
            <span className="order-detail__meta-value">{order.clientAddress}</span>
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Forma de Pago</span>
            <span className="order-detail__meta-value font-medium">{order.paymentMethod}</span>
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Origen</span>
            <Badge label={SOURCE_LABEL[order.source]} variant={SOURCE_VARIANT[order.source]} />
          </div>
          {order.notes && (
            <div className="order-detail__meta-field order-detail__meta-field--full">
              <span className="order-detail__meta-label">Notas</span>
              <span className="order-detail__meta-value order-detail__notes">{order.notes}</span>
            </div>
          )}
        </div>

        {/* Products subtable */}
        <div className="order-detail__products">
          <h4 className="order-detail__section-title">Detalle de Productos</h4>
          <Table
            data={order.items}
            keyExtractor={(item) => item.id}
            columns={[
              { header: 'SKU', accessor: (item) => <span className="font-mono text-xs">{item.sku}</span> },
              { header: 'Producto', accessor: 'name' },
              { header: 'Cant.', align: 'center', accessor: 'quantity' },
              { header: 'Precio Unit.', align: 'right', accessor: (item) => formatCurrency(item.unitPrice) },
              { header: 'Subtotal', align: 'right', accessor: (item) => (
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              )},
            ]}
          />
        </div>

        <div className="order-detail__footer">
          <div className="order-detail__financials">
            <div className="order-detail__financial-row">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="order-detail__financial-row text-success">
                <span>Descuento</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="order-detail__financial-row">
              <span>IVA</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            <div className="order-detail__financial-row order-detail__total">
              <span>Total del Pedido</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>

          {(advanceLabel || canCancel) && (
            <div className="order-detail__actions">
              {canCancel && order.status !== 'delivered' && (
                <button
                  className="order-detail__btn-cancel"
                  onClick={() => onCancel(order)}
                  disabled={order.status === 'cancelled'}
                >
                  {order.status === 'cancelled' ? 'Cancelado' : 'Cancelar'}
                </button>
              )}
              {advanceLabel && (
                <button
                  className="order-detail__btn-advance"
                  onClick={() => onAdvanceStatus(order)}
                >
                  {advanceLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        {order.history && order.history.length > 0 && (
          <div className="order-detail__timeline">
            <h4 className="order-detail__section-title">Historial del Pedido</h4>
            <div className="order-detail__timeline-list">
              {order.history.map((event, index) => (
                <div key={event.id} className="order-detail__timeline-item">
                  <div className="order-detail__timeline-dot"></div>
                  {index !== order.history.length - 1 && <div className="order-detail__timeline-line"></div>}
                  <div className="order-detail__timeline-content">
                    <span className="order-detail__timeline-time">
                      {new Date(event.date).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })} - {event.status.toUpperCase()}
                    </span>
                    <p className="order-detail__timeline-desc">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
};
