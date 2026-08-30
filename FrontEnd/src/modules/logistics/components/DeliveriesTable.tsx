import type { FC } from 'react';
import { Clock, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_VARIANT } from '../deliveryStatusLabels';
import '../LogisticsPage.css';

// ============================================================
// DeliveriesTable — Tabla paginable de entregas del dia
// ============================================================

const NEXT_ACTION_LABEL: Partial<Record<DeliveryStatus, string>> = {
  pending: 'Marcar en ruta',
  in_transit: 'Marcar entregada',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

interface DeliveriesTableProps {
  deliveries: Delivery[];
  onAdvanceStatus: (deliveryId: string) => void;
}

export const DeliveriesTable: FC<DeliveriesTableProps> = ({ deliveries, onAdvanceStatus }) => {
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
          accessor: (d) => {
            const actionLabel = NEXT_ACTION_LABEL[d.status];
            if (!actionLabel) return null;
            const ActionIcon = d.status === 'pending' ? Truck : CheckCircle2;
            return (
              <button
                type="button"
                className="deliveries-table__action-btn"
                onClick={() => onAdvanceStatus(d.id)}
                aria-label={`${actionLabel} - entrega ${d.id}`}
              >
                <ActionIcon size={14} aria-hidden="true" />
                {actionLabel}
              </button>
            );
          },
        },
      ]}
    />
  );
};
