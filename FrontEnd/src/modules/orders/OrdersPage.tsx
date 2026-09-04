import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '@/shared/types/order.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { OrderFilters } from './components/OrderFilters';
import { OrderDetailPanel } from './components/OrderDetailPanel';
import { CreateOrderModal } from './components/create-order/CreateOrderModal';
import { OrderKpis } from './components/OrderKpis';
import { getOrdersPage, advanceOrderStatus, cancelOrder, type OrdersQueryFilters } from './api/orders.service';
import './OrdersPage.css';

// ============================================================
// OrdersPage — Gestion de Pedidos y Ventas (Tanda 3a de escalabilidad)
// Segunda plantilla del proyecto (la primera fue suppliers, Tanda 1)
// y la primera SIN service previo — antes leia data/mock/orders.data.ts
// directo en un useState. Ver docs/GUIA_MIGRACION_MODULO.md para el
// paso a paso, y DECISIONES_TECNICAS.md para el porque de cada
// decision.
//
// Sin filtro de sucursal a proposito (confirmado explicitamente antes
// de implementar, no asumido): un pedido es de la empresa. `Order` no
// tiene ningun campo de sucursal — `activeBranchId` solo se usa dentro
// de OrderProductsSection para consultar stock disponible al armar el
// pedido, nunca se persiste en el pedido en si.
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
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [seller, setSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Los filtros que antes corrian en memoria (OrdersPage.tsx original)
  // pasan al service — busqueda, estado, vendedor, forma de pago y
  // rango de fecha se resuelven todos server-side (usePagedQuery).
  const filters: OrdersQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      search: debouncedSearchQuery || undefined,
      status: activeStatus === 'all' ? undefined : activeStatus,
      seller: seller || undefined,
      paymentMethod: paymentMethod || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [empresaId, debouncedSearchQuery, activeStatus, seller, paymentMethod, dateFrom, dateTo]
  );

  const {
    items: orders,
    aggregates,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getOrdersPage, filters, { enabled: Boolean(empresaId) });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de pedidos.');
  }, [error]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setIsPanelOpen(true);
  };

  // P10 (DECISIONES_TECNICAS.md): tras una mutacion se vuelve a pedir
  // la pagina vigente al service, en vez de actualizar `orders` a mano
  // en el cliente — evita duplicar logica de filtro/orden que ya vive
  // en el servicio. `selectedOrder` (el panel de detalle abierto) SI
  // se actualiza a mano para que el panel refleje el cambio al
  // instante, sin esperar al refetch.
  const handleAdvanceStatus = async (order: Order) => {
    const result = await advanceOrderStatus(order.id);
    if (!result.success || !result.newStatus) {
      toast.error('No se pudo actualizar el estado del pedido.');
      return;
    }
    const newStatus = result.newStatus;
    toast.success(`Pedido ${order.orderNumber} actualizado a "${STATUS_LABEL[newStatus]}".`);
    setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: newStatus } : prev));
    refetch();
  };

  const handleCancel = async (order: Order) => {
    const result = await cancelOrder(order.id);
    if (!result.success) {
      toast.error('No se pudo cancelar el pedido.');
      return;
    }
    toast.success(`Pedido ${order.orderNumber} cancelado.`);
    setSelectedOrder((prev) => (prev?.id === order.id ? { ...prev, status: 'cancelled' } : prev));
    refetch();
  };

  // RF-PED-001: CreateOrderModal ya crea el pedido contra
  // orders.service.ts (ver ese componente) — acá solo se refresca el
  // listado para que aparezca, mismo criterio P10 que las mutaciones
  // de arriba.
  const handleCreateOrder = () => {
    refetch();
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

      <OrderKpis aggregates={aggregates} />

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
      />

      <div className="orders-page__content">
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando pedidos..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de pedidos." onRetry={refetch} />
        ) : (
          <ErrorBoundary
            fallbackTitle="No se pudo mostrar el listado de pedidos."
            fallbackMessage="Intenta de nuevo o volve al inicio."
          >
            <FetchingOverlay isFetching={isFetching}>
              <Table
                data={orders}
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
            </FetchingOverlay>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </ErrorBoundary>
        )}
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
        onConfirm={handleCreateOrder}
      />
    </div>
  );
};
