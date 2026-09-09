import { useState, type FC } from 'react';
import { SidePanel } from '@/shared/components/ui/SidePanel';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Order, OrderStatus } from '@/shared/types/order.types';
import type { ClientAccount } from '@/shared/types/client.types';
import type { Delivery } from '@/shared/types/logistics.types';
import { fetchClientsCatalog } from '@/modules/clients/api/clients.service';
import { getDeliveriesForOrder } from '@/modules/logistics/services/deliveries.service';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_VARIANT } from '@/modules/logistics/deliveryStatusLabels';
import { deriveOrderFulfillmentStatus, derivePendingQuantity, type OrderFulfillmentStatus } from '@/shared/utils/orderFulfillment';
import { deriveOrderLogisticStatus, deriveOrderFinancialStatus } from '@/shared/utils/orderLogistics';
import { resolveOrderClient } from '@/shared/utils/resolveOrderClient';
import { CreateDeliveryModal } from './CreateDeliveryModal';
import './OrderDetailPanel.css';

// ============================================================
// OrderDetailPanel — Side panel with order breakdown
//
// Estado de cumplimiento (ADR-001) y cliente real (Tanda 5,
// AUDIT_4_IDS_RELACIONES.md hallazgo ALTO #1) conectados acá — antes
// solo los ejercitaba su propio smoke script (Tandas 5/8), ver
// docs/auditorias/AUDIT_2026-09-07_conexion-export-3fg.md.
//
// Tanda 9 (ADR-010 secciones 1/8, hallazgo A15#3): logisticoResumen/
// estadoFinancieroResumen se leen SIEMPRE de las Delivery reales del
// pedido (getDeliveriesForOrder + shared/utils/orderLogistics.ts) —
// nunca de un campo propio en Order que pudiera desalinearse. Por eso
// no hay riesgo de que este panel muestre un estado logistico viejo:
// no existe una copia que dejar vieja, se recalcula en cada render con
// los datos que ya llegaron.
// ============================================================

// Referencia estable: mismo criterio que EMPTY_PRODUCTS en
// CreateOrderModal.tsx.
const EMPTY_CLIENTS: ClientAccount[] = [];
const EMPTY_DELIVERIES: Delivery[] = [];

const FULFILLMENT_LABEL: Record<OrderFulfillmentStatus, string> = {
  pendiente: 'Sin entregar',
  parcial: 'Entrega parcial',
  completo: 'Entregado',
};

const FULFILLMENT_VARIANT: Record<OrderFulfillmentStatus, 'neutral' | 'warning' | 'success'> = {
  pendiente: 'neutral',
  parcial: 'warning',
  completo: 'success',
};

const LOGISTICO_PENDIENTE_VARIANT = 'neutral' as const;

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
  const empresaId = useSessionStore((s) => s.session?.company.id);

  // Catalogo de clientes (mismo queryName 'clients-catalog' que
  // CreateOrderModal.tsx — dedupe de cache, no un 4to fetch
  // independiente) para resolver el ClientAccount REAL detras de
  // order.clientId y mostrar su estado de cuenta vivo, no solo el
  // snapshot historico tomado al crear el pedido. Hooks siempre antes
  // del early-return de mas abajo (regla de hooks de React).
  const { data: clientsData } = useCachedQuery(
    'clients-catalog',
    undefined,
    (signal) => fetchClientsCatalog(empresaId ?? '', signal),
    { enabled: isOpen && Boolean(order) && Boolean(empresaId), staleTime: CACHE_STALE_TIME.CATALOG }
  );
  const clients = clientsData ?? EMPTY_CLIENTS;

  // Entregas del pedido (Tanda 9, hallazgo A15#4): getDeliveriesForOrder
  // vive en logistics.service, llamado directo (regla R2: servicio
  // publico de otro modulo, no un componente interno). keyParams =
  // order.id para que abrir el panel de otro pedido no reuse cache
  // ajena — OPERATIONAL porque una entrega puede cambiar de estado
  // mientras el panel esta abierto.
  const {
    data: orderDeliveries,
    isLoading: isLoadingDeliveries,
    error: orderDeliveriesError,
    refetch: refetchOrderDeliveries,
  } = useCachedQuery(
    'order-deliveries',
    order?.id ?? null,
    (signal) => {
      if (!order || !empresaId) throw new Error('OrderDetailPanel: fetch de entregas sin order/empresaId.');
      return getDeliveriesForOrder(empresaId, order.id, signal);
    },
    { enabled: isOpen && Boolean(order) && Boolean(empresaId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const deliveries = orderDeliveries ?? EMPTY_DELIVERIES;

  const [createDeliveryOpen, setCreateDeliveryOpen] = useState(false);

  if (!order) return null;

  const advanceLabel = ADVANCE_LABEL[order.status];
  // Fix del hallazgo ALTO de Fase 3 (Tanda 9): cancelar tambien se
  // bloquea si el pedido tiene una entrega en CREADO/EN_TRANSITO —
  // mismo criterio de "activa" que orders.service.ts#cancelOrder
  // (que vuelve a validar esto server-side, este chequeo del cliente
  // es solo para no mostrar un boton que el servidor va a rechazar).
  // Mientras `orderDeliveries` todavia esta cargando O si el fetch
  // termino en error se trata como bloqueado (conservador, mismo
  // criterio que el resto de los guards de este panel) — sin el chequeo
  // de error, un fetch fallido deja `orderDeliveries` en `undefined`
  // (no en `[]`), `deliveries` cae al fallback `EMPTY_DELIVERIES` via
  // `??`, y `hasActiveDeliveries` da `false` por una lista vacia que en
  // realidad significa "no sabemos", no "no hay" — habilitaria Cancelar
  // sin haber podido confirmar que no hay una entrega activa (hallazgo
  // propio, autoauditoria de este mismo fix).
  const hasActiveDeliveries = deliveries.some((d) => d.status === 'CREADO' || d.status === 'EN_TRANSITO');
  const canCancel =
    order.status !== 'delivered' &&
    order.status !== 'invoiced' &&
    order.status !== 'cancelled' &&
    !isLoadingDeliveries &&
    !orderDeliveriesError &&
    !hasActiveDeliveries;

  const fulfillmentStatus = deriveOrderFulfillmentStatus(order.items);
  // undefined si el cliente fue borrado o el catalogo todavia no cargo
  // — el panel sigue funcionando con el snapshot como antes, sin esta
  // seccion extra (resolveOrderClient.ts, Tanda 5).
  const realClient = resolveOrderClient(order, clients);
  const clientOverLimit = realClient ? realClient.currentBalance > realClient.creditLimit : false;

  // Tanda 9 (ADR-010 seccion 1): ejes logistico/financiero derivados,
  // nunca leidos de un campo de Order.
  const logisticoResumen = deriveOrderLogisticStatus(deliveries);
  const estadoFinancieroResumen = deriveOrderFinancialStatus(order);
  const puedeCrearEntrega = order.comercial === 'Confirmado';

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
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Entrega (ADR-001)</span>
            <Badge label={FULFILLMENT_LABEL[fulfillmentStatus]} variant={FULFILLMENT_VARIANT[fulfillmentStatus]} />
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Estado logístico (ADR-010)</span>
            {logisticoResumen === 'Pendiente' ? (
              <Badge label="Pendiente" variant={LOGISTICO_PENDIENTE_VARIANT} />
            ) : (
              <Badge label={DELIVERY_STATUS_LABEL[logisticoResumen]} variant={DELIVERY_STATUS_VARIANT[logisticoResumen]} />
            )}
          </div>
          <div className="order-detail__meta-field">
            <span className="order-detail__meta-label">Estado financiero (ADR-010, proyección)</span>
            <Badge label={estadoFinancieroResumen} variant="neutral" />
          </div>
          {realClient && (
            <div className="order-detail__meta-field">
              <span className="order-detail__meta-label">Cuenta del cliente (estado actual)</span>
              <span className="order-detail__meta-value">
                Saldo {formatCurrency(realClient.currentBalance)} / Limite {formatCurrency(realClient.creditLimit)}
                {clientOverLimit && (
                  <>
                    {' '}
                    <Badge label="Excede limite" variant="danger" />
                  </>
                )}
              </span>
            </div>
          )}
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
              { header: 'Entregado', align: 'center', accessor: (item) => item.cantidadEntregada },
              { header: 'Pendiente', align: 'center', accessor: (item) => derivePendingQuantity(item) },
              { header: 'Precio Unit.', align: 'right', accessor: (item) => formatCurrency(item.unitPrice) },
              { header: 'Subtotal', align: 'right', accessor: (item) => (
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              )},
            ]}
          />
        </div>

        {/* Entregas (Tanda 9, hallazgo A15#1/A15#4) */}
        <div className="order-detail__deliveries">
          <div className="order-detail__deliveries-header">
            <h4 className="order-detail__section-title">Entregas</h4>
            <button
              type="button"
              className="order-detail__btn-create-delivery"
              onClick={() => setCreateDeliveryOpen(true)}
              disabled={!puedeCrearEntrega}
              title={puedeCrearEntrega ? undefined : 'Solo un pedido confirmado puede generar una entrega.'}
            >
              Nueva entrega
            </button>
          </div>
          {deliveries.length === 0 ? (
            <p className="order-detail__deliveries-empty">Este pedido todavía no tiene entregas generadas.</p>
          ) : (
            <Table
              data={deliveries}
              keyExtractor={(d) => d.id}
              columns={[
                { header: 'Código', accessor: (d) => <span className="font-mono text-xs">{d.id}</span> },
                { header: 'Fecha', accessor: (d) => d.date },
                { header: 'Zona', accessor: (d) => d.zone },
                {
                  header: 'Estado',
                  align: 'center',
                  accessor: (d) => <Badge label={DELIVERY_STATUS_LABEL[d.status]} variant={DELIVERY_STATUS_VARIANT[d.status]} />,
                },
              ]}
            />
          )}
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

      <CreateDeliveryModal
        isOpen={createDeliveryOpen}
        onClose={() => setCreateDeliveryOpen(false)}
        order={order}
        onCreated={() => refetchOrderDeliveries()}
      />
    </SidePanel>
  );
};
