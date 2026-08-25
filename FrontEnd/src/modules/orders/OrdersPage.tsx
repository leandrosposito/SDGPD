import { useState, useMemo, type FC } from 'react';
import { ORDERS_MOCK_DATA } from '../../data/mock/orders.data';
import type { Order, OrderStatus } from '../../shared/types/order.types';
import { Table } from '../../shared/components/ui/Table';
import { Badge } from '../../shared/components/ui/Badge';
import { OrderFilters } from './components/OrderFilters';
import { OrderDetailPanel } from './components/OrderDetailPanel';
import { CreateOrderModal } from './components/create-order/CreateOrderModal';
import { OrderKpis } from './components/OrderKpis';
import './OrdersPage.css';

// ============================================================
// OrdersPage — Gestion de Pedidos y Ventas
// ============================================================

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Pendiente',
  preparing:  'Preparando',
  dispatched: 'Despachado',
  delivered:  'Entregado',
  invoiced:   'Facturado',
  cancelled:  'Cancelado',
};

const STATUS_VARIANT: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  pending:    'neutral',
  preparing:  'warning',
  dispatched: 'info',
  delivered:  'success',
  invoiced:   'success',
  cancelled:  'danger',
};

const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:    'preparing',
  preparing:  'dispatched',
  dispatched: 'delivered',
  delivered:  'invoiced',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const OrdersPage: FC = () => {
  const [orders, setOrders] = useState<Order[]>(ORDERS_MOCK_DATA);
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusMatch = activeStatus === 'all' || o.status === activeStatus;
      const searchMatch = o.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const sellerMatch = !seller || o.sellerName === seller;
      const paymentMatch = !paymentMethod || o.paymentMethod === paymentMethod;
      const dateFromMatch = !dateFrom || o.date >= dateFrom;
      const dateToMatch = !dateTo || o.date.split('T')[0] <= dateTo;
      return statusMatch && searchMatch && sellerMatch && paymentMatch && dateFromMatch && dateToMatch;
    });
  }, [orders, activeStatus, searchQuery, seller, paymentMethod, dateFrom, dateTo]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setIsPanelOpen(true);
  };

  const handleAdvanceStatus = (order: Order) => {
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
    );
    setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: next } : prev));
  };

  const handleCancel = (order: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o))
    );
    setSelectedOrder((prev) =>
      prev?.id === order.id ? { ...prev, status: 'cancelled' } : prev
    );
  };

  return (
    <div className="orders-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Pedidos y Ventas</h2>
          <p className="page-header__subtitle">Ingreso, seguimiento y gestion de pedidos</p>
        </div>
        <button
          className="client-modal-btn client-modal-btn--primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          Nuevo Pedido
        </button>
      </header>

      <OrderKpis orders={orders} />

      <OrderFilters
        activeStatus={activeStatus}
        searchQuery={searchQuery}
        onStatusChange={setActiveStatus}
        onSearchChange={setSearchQuery}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        seller={seller}
        onSellerChange={setSeller}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        totalCount={orders.length}
        filteredCount={filteredOrders.length}
      />

      <div className="orders-page__content">
        <Table
          data={filteredOrders}
          keyExtractor={(o) => o.id}
          emptyMessage="No se encontraron pedidos con los filtros aplicados."
          columns={[
            {
              header: 'N Pedido',
              accessor: (o) => (
                <span className="orders-page__order-number">{o.orderNumber}</span>
              ),
            },
            {
              header: 'Fecha',
              accessor: (o) => (
                <span className="font-mono text-xs text-secondary">{formatDate(o.date)}</span>
              ),
            },
            {
              header: 'Cliente',
              accessor: (o) => (
                <div className="orders-page__client-cell">
                  <span className="font-medium">{o.clientName}</span>
                </div>
              ),
            },
            {
              header: 'Vendedor',
              accessor: 'sellerName'
            },
            {
              header: 'Forma de Pago',
              accessor: 'paymentMethod'
            },
            {
              header: 'Importe',
              align: 'right',
              accessor: (o) => (
                <span className="font-bold">{formatCurrency(o.totalAmount)}</span>
              ),
            },
            {
              header: 'Estado',
              align: 'center',
              accessor: (o) => (
                <Badge label={STATUS_LABEL[o.status]} variant={STATUS_VARIANT[o.status]} />
              ),
            },
            {
              header: 'Acciones',
              align: 'right',
              accessor: (o) => (
                <button
                  className="orders-page__row-btn"
                  onClick={() => handleRowClick(o)}
                  aria-label={`Ver detalle del pedido ${o.orderNumber}`}
                >
                  Ver detalle
                </button>
              ),
            },
          ]}
        />
      </div>

      <OrderDetailPanel
        order={selectedOrder}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onAdvanceStatus={handleAdvanceStatus}
        onCancel={handleCancel}
      />

      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
