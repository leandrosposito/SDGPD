import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Supplier } from '@/shared/types/supplier.types';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  type SupplierFormInput,
} from '@/services/mock/suppliers.service';
import { SupplierDetailPanel } from './components/SupplierDetailPanel';
import { SupplierFormModal } from './components/SupplierFormModal';
import { SuppliersFilters } from './components/SuppliersFilters';
import { SuppliersTable } from './components/SuppliersTable';
import './SuppliersPage.css';

// ============================================================
// SuppliersPage — Gestion de Proveedores
//
// "Nueva Orden de Compra"/"Nueva OC" ya no abren un modal local (O4,
// DECISIONES_TECNICAS.md): navegan a /compras (con ?proveedor=<id>
// cuando hay un proveedor en contexto), donde vive el formulario real
// de alta contra Compras. Ver esa entrada para el porque — en resumen,
// R2 prohibe que este modulo importe un componente de modules/compras/.
// ============================================================

export const SuppliersPage: FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

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

  // O4: navega a Compras en vez de abrir un modal local. Sin proveedor
  // en contexto (boton de la cabecera de la pagina), sin query param —
  // el usuario elige el proveedor alla mismo.
  const handleNewOrder = () => {
    navigate('/compras');
  };

  // O4: con un proveedor ya seleccionado (boton "Nueva OC" del panel de
  // detalle), viaja como query param para que Compras abra el
  // formulario con ese proveedor preseleccionado.
  const handleNewOrderForSelectedSupplier = () => {
    if (!selectedSupplier) return;
    navigate(`/compras?proveedor=${encodeURIComponent(selectedSupplier.id)}`);
  };

  return (
    <div className="suppliers-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Proveedores</h2>
          <p className="page-header__subtitle">Administracion de fabricantes y mayoristas</p>
        </div>
        <div className="suppliers-page__header-actions" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="client-modal-btn client-modal-btn--outline" onClick={handleNewOrder}>
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
        onNewOrder={handleNewOrderForSelectedSupplier}
      />

      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        supplier={selectedSupplier}
        onSave={handleSaveSupplier}
      />
    </div>
  );
};
