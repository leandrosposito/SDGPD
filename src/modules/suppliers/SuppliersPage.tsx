import { useState, type FC } from 'react';
import { SUPPLIERS_MOCK_DATA } from '../../data/mock/suppliers.data';
import type { Supplier } from '../../types/supplier.types';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { SupplierDetailPanel } from './components/SupplierDetailPanel';
import { SupplierFormModal } from './components/SupplierFormModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import './SuppliersPage.css';

// ============================================================
// SuppliersPage — Gestion de Proveedores
// ============================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const SuppliersPage: FC = () => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const handleRowClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsPanelOpen(true);
  };

  const handleNewSupplier = () => {
    setSelectedSupplier(null);
    setIsFormModalOpen(true);
  };

  const handleNewOrder = () => {
    setIsOrderModalOpen(true);
  };

  return (
    <div className="suppliers-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Proveedores</h2>
          <p className="page-header__subtitle">Administracion de fabricantes y mayoristas</p>
        </div>
        <div className="suppliers-page__header-actions">
          <button className="suppliers-page__btn-order" onClick={() => { setSelectedSupplier(null); setIsOrderModalOpen(true); }}>
            Nueva Orden de Compra
          </button>
          <button className="suppliers-page__btn-new" onClick={handleNewSupplier}>
            Nuevo Proveedor
          </button>
        </div>
      </header>

      <div className="suppliers-page__content">
        <Table
          data={SUPPLIERS_MOCK_DATA}
          keyExtractor={(s) => s.id}
          columns={[
            {
              header: 'Razon Social',
              accessor: (s) => (
                <div className="suppliers-page__name-cell">
                  <span className="font-medium">{s.name}</span>
                  {s.hasOverdueDebt && (
                    <Badge label="Deuda Vencida" variant="danger" />
                  )}
                </div>
              ),
            },
            { header: 'CUIT', accessor: (s) => <span className="font-mono text-sm">{s.cuit}</span> },
            { header: 'Telefono', accessor: (s) => <span className="text-tertiary">{s.phone}</span> },
            { header: 'Contacto', accessor: 'contactName' },
            {
              header: 'Saldo Actual',
              align: 'right',
              accessor: (s) => (
                <span className={s.currentBalance > 0 ? 'text-danger font-bold' : ''}>
                  {formatCurrency(s.currentBalance)}
                </span>
              ),
            },
            {
              header: '',
              align: 'right',
              accessor: (s) => (
                <button
                  className="suppliers-page__row-btn"
                  onClick={() => handleRowClick(s)}
                  aria-label={`Ver detalle de ${s.name}`}
                >
                  Ver detalle
                </button>
              ),
            },
          ]}
        />
      </div>

      <SupplierDetailPanel
        supplier={selectedSupplier}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onNewOrder={handleNewOrder}
      />

      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        supplier={selectedSupplier}
      />

      <PurchaseOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        supplier={selectedSupplier}
      />
    </div>
  );
};
