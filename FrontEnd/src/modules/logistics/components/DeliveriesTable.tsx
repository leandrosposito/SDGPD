import type { FC } from 'react';
import { Clock, MapPin, Truck, PackageCheck, CalendarClock, History } from 'lucide-react';
import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_VARIANT } from '../deliveryStatusLabels';
import '../LogisticsPage.css';

// ============================================================
// DeliveriesTable — Tabla paginable de entregas del dia. Acciones
// (Tanda 8, ADR-002) derivadas de `d.allowedTransitions` (Tanda 9,
// ADR-010 seccion 3): el server ya calculo, por cada entrega, cual
// transicion esta permitida y por que no las demas
// (computeAllowedTransitions, deliveryStatus.types.ts) — este
// componente NO vuelve a llamar `puedeTransicionar` por su cuenta, solo
// lee lo que llego en la respuesta (evita el antipatron de recalcular
// en el cliente algo que el contrato ya resolvio).
// ============================================================

function isPermitida(delivery: Delivery, transicion: DeliveryStatus): boolean {
  return delivery.allowedTransitions?.find((t) => t.transicion === transicion)?.permitida ?? false;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

interface DeliveriesTableProps {
  deliveries: Delivery[];
  onMarkInTransit: (delivery: Delivery) => void;
  onRegisterDelivery: (delivery: Delivery) => void;
  onReprogram: (delivery: Delivery) => void;
  onShowHistory: (delivery: Delivery) => void;
}

export const DeliveriesTable: FC<DeliveriesTableProps> = ({
  deliveries,
  onMarkInTransit,
  onRegisterDelivery,
  onReprogram,
  onShowHistory,
}) => {
  return (
    <Table
      data={deliveries}
      keyExtractor={(delivery) => delivery.id}
      emptyMessage="No hay entregas para el dia y estado seleccionados."
      columns={[
        {
          header: 'Codigo',
          accessor: (d) => <span className="deliveries-table__code">{d.id}</span>,
        },
        {
          header: 'Pedido',
          accessor: (d) => <span className="deliveries-table__order-id">{d.orderId}</span>,
        },
        {
          header: 'Cliente / Destino',
          accessor: 'clientName',
        },
        {
          header: 'Direccion',
          accessor: (d) => (
            <span className="deliveries-table__address">
              <MapPin size={14} aria-hidden="true" />
              {d.address}
            </span>
          ),
        },
        {
          header: 'Horario Estimado',
          accessor: (d) => (
            <span className="deliveries-table__time">
              <Clock size={14} aria-hidden="true" />
              {d.estimatedTime}
            </span>
          ),
        },
        {
          header: 'Cobro',
          align: 'right',
          accessor: (d) => formatCurrency(d.collectionAmount),
        },
        {
          header: 'Estado',
          align: 'center',
          accessor: (d) => (
            <Badge label={DELIVERY_STATUS_LABEL[d.status]} variant={DELIVERY_STATUS_VARIANT[d.status]} />
          ),
        },
        {
          header: 'Acciones',
          align: 'right',
          accessor: (d) => (
            <div className="deliveries-table__actions">
              {isPermitida(d, 'EN_TRANSITO') && (
                <button type="button" className="deliveries-table__action-btn" onClick={() => onMarkInTransit(d)} aria-label={`Marcar en ruta - entrega ${d.id}`}>
                  <Truck size={14} aria-hidden="true" />
                  En ruta
                </button>
              )}
              {isPermitida(d, 'FINALIZADO') && (
                <button type="button" className="deliveries-table__action-btn" onClick={() => onRegisterDelivery(d)} aria-label={`Registrar entrega - entrega ${d.id}`}>
                  <PackageCheck size={14} aria-hidden="true" />
                  Registrar entrega
                </button>
              )}
              {isPermitida(d, 'REPROGRAMADO') && (
                <button type="button" className="deliveries-table__action-btn" onClick={() => onReprogram(d)} aria-label={`Reprogramar - entrega ${d.id}`}>
                  <CalendarClock size={14} aria-hidden="true" />
                  Reprogramar
                </button>
              )}
              <button type="button" className="deliveries-table__action-btn deliveries-table__action-btn--ghost" onClick={() => onShowHistory(d)} aria-label={`Ver historial - entrega ${d.id}`}>
                <History size={14} aria-hidden="true" />
              </button>
            </div>
          ),
        },
      ]}
    />
  );
};
