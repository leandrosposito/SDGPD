import { useState, type FC } from 'react';
import { SidePanel } from '@/shared/components/ui/SidePanel';
import { Tabs, type TabItem } from '@/shared/components/ui/Tabs';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Supplier } from '@/shared/types/supplier.types';
import './SupplierDetailPanel.css';

// ============================================================
// SupplierDetailPanel — Sliding detail view for a supplier
// ============================================================

interface SupplierDetailPanelProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onNewOrder: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
};

const ORDER_STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'danger'> = {
  paid: 'success',
  pending: 'neutral',
  overdue: 'danger',
};

export const SupplierDetailPanel: FC<SupplierDetailPanelProps> = ({
  supplier,
  isOpen,
  onClose,
  onNewOrder,
}) => {
  const [activeTab, setActiveTab] = useState('basics');

  if (!supplier) return null;

  const tabs: TabItem[] = [
    {
      id: 'basics',
      label: 'Datos Basicos',
      content: (
        <div className="supplier-detail__tab-content">
          <section className="supplier-detail__section">
            <h4 className="supplier-detail__section-title">Informacion de Contacto</h4>
            <div className="supplier-detail__grid">
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Razon Social</span>
                <span className="supplier-detail__value">{supplier.name}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">CUIT</span>
                <span className="supplier-detail__value font-mono">{supplier.cuit}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Telefono</span>
                <span className="supplier-detail__value">{supplier.phone}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Contacto Comercial</span>
                <span className="supplier-detail__value">{supplier.contactName}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Email</span>
                <span className="supplier-detail__value">{supplier.contactEmail}</span>
              </div>
              <div className="supplier-detail__field supplier-detail__field--full">
                <span className="supplier-detail__label">Direccion</span>
                <span className="supplier-detail__value">{supplier.address}, {supplier.city}</span>
              </div>
            </div>
          </section>
          <section className="supplier-detail__section">
            <h4 className="supplier-detail__section-title">Condiciones Comerciales</h4>
            <div className="supplier-detail__grid">
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Plazo de Pago</span>
                <span className="supplier-detail__value">{supplier.paymentTerms}</span>
              </div>
              <div className="supplier-detail__field">
                <span className="supplier-detail__label">Saldo Actual</span>
                <span className={`supplier-detail__value font-bold ${supplier.currentBalance > 0 ? 'text-danger' : ''}`}>
                  {formatCurrency(supplier.currentBalance)}
                </span>
              </div>
            </div>
          </section>
        </div>
      ),
    },
    {
      id: 'catalog',
      label: 'Catalogo de Precios',
      content: (
        <div className="supplier-detail__tab-content">
          <Table
            data={supplier.products}
            keyExtractor={(p) => p.id}
            columns={[
              { header: 'SKU', accessor: (p) => <span className="font-mono text-xs">{p.sku}</span> },
              { header: 'Producto', accessor: 'name' },
              { header: 'Categoria', accessor: (p) => <span className="text-tertiary">{p.category}</span> },
              { header: 'Costo', align: 'right', accessor: (p) => formatCurrency(p.cost) },
              { header: 'Actualizado', accessor: (p) => (
                <span className="text-tertiary text-xs">{formatDate(p.lastUpdate)}</span>
              )},
            ]}
          />
        </div>
      ),
    },
    {
      id: 'history',
      label: 'Historial y Deuda',
      content: (
        <div className="supplier-detail__tab-content">
          <div className="supplier-detail__balance-card">
            <span className="supplier-detail__balance-label">Saldo en Cuenta Corriente</span>
            <span className={`supplier-detail__balance-amount ${supplier.hasOverdueDebt ? 'text-danger' : ''}`}>
              {formatCurrency(supplier.currentBalance)}
            </span>
            {supplier.hasOverdueDebt && (
              <Badge label="Deuda Vencida" variant="danger" />
            )}
          </div>
          <Table
            data={supplier.purchaseOrders}
            keyExtractor={(o) => o.id}
            columns={[
              { header: 'OC', accessor: (o) => <span className="font-mono text-xs">{o.id}</span> },
              { header: 'Fecha', accessor: (o) => formatDate(o.date) },
              { header: 'Descripcion', accessor: 'description' },
              { header: 'Monto', align: 'right', accessor: (o) => formatCurrency(o.amount) },
              { header: 'Estado', align: 'center', accessor: (o) => (
                <Badge
                  label={ORDER_STATUS_LABEL[o.status]}
                  variant={ORDER_STATUS_VARIANT[o.status]}
                />
              )},
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={supplier.name}
      subtitle={`CUIT: ${supplier.cuit}`}
      headerActions={
        <button className="sp-btn-order" onClick={onNewOrder}>
          Nueva OC
        </button>
      }
    >
      <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} />
    </SidePanel>
  );
};
