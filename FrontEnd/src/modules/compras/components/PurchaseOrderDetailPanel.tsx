import { type FC } from 'react';
import { SidePanel } from '@/shared/components/ui/SidePanel';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { Currency, PurchaseOrder, PurchaseOrderStatus } from '@/shared/types/purchaseOrder.types';
import { computePurchaseOrderTotal } from '@/services/mock/purchaseOrders.service';
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_VARIANT } from '../purchaseOrderLabels';

// ============================================================
// PurchaseOrderDetailPanel — detalle de UNA orden (3.4): sus lineas y
// el total, que se calcula ACA a partir de `order.lines` (nunca se lee
// de un campo `total` guardado, porque no existe uno — O2). Un
// producto que ya no esta en el catalogo (productId sin match en
// `productsById`) se muestra como "Producto no disponible" en vez de
// undefined o una fila rota (3.2, caso de borde po-005 en el mock).
// ============================================================

interface PurchaseOrderDetailPanelProps {
  order: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  suppliersById: Map<Supplier['id'], Supplier>;
  branchesById: Map<Branch['id'], Branch>;
  productsById: Map<InventoryItem['id'], InventoryItem>;
  onTransition: (order: PurchaseOrder, nextStatus: PurchaseOrderStatus) => void;
  isTransitioning: boolean;
}

function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface LineRow {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export const PurchaseOrderDetailPanel: FC<PurchaseOrderDetailPanelProps> = ({
  order,
  isOpen,
  onClose,
  suppliersById,
  branchesById,
  productsById,
  onTransition,
  isTransitioning,
}) => {
  if (!order) return null;

  const supplier = suppliersById.get(order.supplierId);
  const branch = branchesById.get(order.branchId);
  const total = computePurchaseOrderTotal(order.lines);

  const rows: LineRow[] = order.lines.map((line) => {
    const product = productsById.get(line.productId);
    return {
      id: line.id,
      sku: product?.sku ?? '—',
      name: product?.name ?? 'Producto no disponible',
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });

  const transitionActions: { label: string; nextStatus: PurchaseOrderStatus; variant: 'primary' | 'danger' }[] =
    order.status === 'draft'
      ? [
          { label: 'Enviar Orden', nextStatus: 'sent', variant: 'primary' },
          { label: 'Cancelar Orden', nextStatus: 'cancelled', variant: 'danger' },
        ]
      : order.status === 'sent'
        ? [
            { label: 'Marcar como Recibida', nextStatus: 'received', variant: 'primary' },
            { label: 'Cancelar Orden', nextStatus: 'cancelled', variant: 'danger' },
          ]
        : [];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={order.id}
      subtitle={supplier ? `Proveedor: ${supplier.name}` : 'Proveedor no disponible'}
    >
      <div className="compras-detail">
        <section className="compras-detail__section">
          <div className="compras-detail__grid">
            <div className="compras-detail__field">
              <span className="compras-detail__label">Sucursal de destino</span>
              <span className="compras-detail__value">{branch?.name ?? 'Sucursal no disponible'}</span>
            </div>
            <div className="compras-detail__field">
              <span className="compras-detail__label">Fecha de creacion</span>
              <span className="compras-detail__value">{formatDateFull(order.createdAt)}</span>
            </div>
            <div className="compras-detail__field">
              <span className="compras-detail__label">Estado</span>
              <span className="compras-detail__value">
                <Badge label={PURCHASE_ORDER_STATUS_LABEL[order.status]} variant={PURCHASE_ORDER_STATUS_VARIANT[order.status]} />
              </span>
            </div>
            <div className="compras-detail__field">
              <span className="compras-detail__label">Moneda</span>
              <span className="compras-detail__value">{order.currency}</span>
            </div>
          </div>
        </section>

        <section className="compras-detail__section">
          <h4 className="compras-detail__section-title">Lineas de la orden</h4>
          <Table
            data={rows}
            keyExtractor={(r) => r.id}
            emptyMessage="Esta orden no tiene lineas."
            columns={[
              { header: 'SKU', accessor: (r) => <span className="font-mono text-xs">{r.sku}</span> },
              { header: 'Producto', accessor: 'name' },
              { header: 'Cantidad', align: 'right', accessor: 'quantity' },
              {
                header: 'Precio Unit.',
                align: 'right',
                accessor: (r) => formatCurrency(r.unitPrice, order.currency),
              },
              {
                header: 'Subtotal',
                align: 'right',
                accessor: (r) => (
                  <span className="font-medium">{formatCurrency(r.quantity * r.unitPrice, order.currency)}</span>
                ),
              },
            ]}
          />
          <div className="compras-detail__total-row">
            <span>Total de la orden</span>
            <span className="compras-detail__total-value">{formatCurrency(total, order.currency)}</span>
          </div>
        </section>

        {transitionActions.length > 0 && (
          <section className="compras-detail__section">
            <h4 className="compras-detail__section-title">Cambiar estado</h4>
            <div className="compras-detail__actions">
              {transitionActions.map((action) => (
                <button
                  key={action.nextStatus}
                  type="button"
                  className={`client-modal-btn client-modal-btn--${action.variant === 'primary' ? 'primary' : 'outline'}`}
                  onClick={() => onTransition(order, action.nextStatus)}
                  disabled={isTransitioning}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </SidePanel>
  );
};
