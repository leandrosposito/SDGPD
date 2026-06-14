import { useState, type FC } from 'react';
import { SUPPLIERS_MOCK_DATA } from '../../data/mock/suppliers.data';
import type { Supplier } from '../../types/supplier.types';
import { SupplierDetailPanel } from './components/SupplierDetailPanel';
import { SupplierFormModal } from './components/SupplierFormModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { SuppliersFilters } from './components/SuppliersFilters';
import { SuppliersTable } from './components/SuppliersTable';
import './SuppliersPage.css';

// ============================================================
// SuppliersPage — Gestion de Proveedores
// ============================================================



export const SuppliersPage: FC = () => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const filteredSuppliers = SUPPLIERS_MOCK_DATA.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          supplier.cuit.includes(searchTerm);
    const matchesCategory = selectedCategory ? supplier.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

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
        <div className="suppliers-page__header-actions" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="client-modal-btn client-modal-btn--outline" onClick={() => { setSelectedSupplier(null); setIsOrderModalOpen(true); }}>
            Nueva Orden de Compra
          </button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={handleNewSupplier}>
            Nuevo Proveedor
          </button>
        </div>
      </header>

      <SuppliersFilters 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <div className="suppliers-page__content">
        <SuppliersTable 
          suppliers={filteredSuppliers}
          onRowClick={handleRowClick}
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
