import { useEffect, useState, type FC } from 'react';
import { toast } from 'sonner';
import type { Supplier, SupplierPurchaseOrder } from '../../shared/types/supplier.types';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  addPurchaseOrder,
  type SupplierFormInput,
} from '../../services/mock/suppliers.service';
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchSuppliers()
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el listado de proveedores.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // RF-PRO-001: Alta / Modificacion de proveedor contra el mock service
  // (persiste en memoria durante la sesion, ver services/mock/suppliers.service.ts).
  const handleSaveSupplier = async (input: SupplierFormInput, supplierId?: string) => {
    if (supplierId) {
      const updated = await updateSupplier(supplierId, input);
      setSuppliers(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setSelectedSupplier(prev => (prev?.id === updated.id ? updated : prev));
      return updated;
    }
    const created = await createSupplier(input);
    setSuppliers(prev => [...prev, created]);
    return created;
  };

  // RF-CMP-001 (alcance frontend): emite una OC y la agrega al historial del proveedor.
  const handleEmitPurchaseOrder = async (supplierId: string, order: Omit<SupplierPurchaseOrder, 'id'>) => {
    const updated = await addPurchaseOrder(supplierId, order);
    setSuppliers(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    setSelectedSupplier(prev => (prev?.id === updated.id ? updated : prev));
    return updated;
  };

  const filteredSuppliers = suppliers.filter(supplier => {
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
        onSave={handleSaveSupplier}
      />

      <PurchaseOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        supplier={selectedSupplier}
        onEmit={handleEmitPurchaseOrder}
      />
    </div>
  );
};
