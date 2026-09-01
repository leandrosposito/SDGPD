import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { Currency, PurchaseOrder } from '@/shared/types/purchaseOrder.types';
import { computePurchaseOrderTotal } from '@/services/mock/purchaseOrders.service';
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_VARIANT } from '../purchaseOrderLabels';

// ============================================================
// PurchaseOrdersTable — tabla "tonta" del listado paginado de Compras.
// El total por fila se calcula ACA, a partir de las lineas de esa
// misma fila (order.lines), nunca sumando entre filas — no es el
// agregado que P3 prohibe calcular en el cliente (eso son los KPIs de
// `aggregates`, que siguen viniendo resueltos del servicio); es el
// mismo tipo de calculo derivado que ya hacia OrderItemsTable por
// linea antes de esta tarea (O2: el total nunca se guarda suelto).
// ============================================================

interface PurchaseOrdersTableProps {
  orders: PurchaseOrder[];
  suppliersById: Map<Supplier['id'], Supplier>;
  branchesById: Map<Branch['id'], Branch>;
  onViewDetail: (order: PurchaseOrder) => void;
}

function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const PurchaseOrdersTable: FC<PurchaseOrdersTableProps> = ({
  orders,
  suppliersById,
  branchesById,
  onViewDetail,
}) => {
  return (
    <Table
      data={orders}
      keyExtractor={(o) => o.id}
      emptyMessage="No hay ordenes de compra para estos filtros."
      columns={[
        { header: 'OC', accessor: (o) => <span className="font-mono text-xs">{o.id}</span> },
        {
          header: 'Proveedor',
          accessor: (o) => suppliersById.get(o.supplierId)?.name ?? 'Proveedor no disponible',
        },
        {
          header: 'Sucursal',
          accessor: (o) => branchesById.get(o.branchId)?.name ?? 'Sucursal no disponible',
        },
        { header: 'Fecha', accessor: (o) => <span className="text-tertiary text-xs">{formatDate(o.createdAt)}</span> },
        {
          header: 'Total',
          align: 'right',
          accessor: (o) => (
            <span className="font-bold">{formatCurrency(computePurchaseOrderTotal(o.lines), o.currency)}</span>
          ),
        },
        {
          header: 'Estado',
          align: 'center',
          accessor: (o) => (
            <Badge label={PURCHASE_ORDER_STATUS_LABEL[o.status]} variant={PURCHASE_ORDER_STATUS_VARIANT[o.status]} />
          ),
        },
        {
          header: 'Acciones',
          align: 'right',
          accessor: (o) => (
            <button
              type="button"
              className="compras-row-btn"
              onClick={() => onViewDetail(o)}
              aria-label={`Ver detalle de la orden ${o.id}`}
            >
              Ver detalle
            </button>
          ),
        },
      ]}
    />
  );
};
