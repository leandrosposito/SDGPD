import { useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Supplier } from '@/shared/types/supplier.types';
import {
  fetchSuppliersPage,
  exportSuppliers,
  createSupplier,
  updateSupplier,
  type SuppliersQueryFilters,
  type SupplierFormInput,
} from './api/suppliers.service';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { SupplierDetailPanel } from './components/SupplierDetailPanel';
import { SupplierFormModal } from './components/SupplierFormModal';
import { SuppliersFilters } from './components/SuppliersFilters';
import { SuppliersTable } from './components/SuppliersTable';
import './SuppliersPage.css';

// ============================================================
// SuppliersPage — Gestion de Proveedores. Modulo piloto de la capa
// api/ (dto/mapper/service, Tanda 1 de escalabilidad) y primer
// listado migrado a usePagedQuery fuera de los 6 ya existentes — ver
// docs/GUIA_MIGRACION_MODULO.md para el paso a paso, y
// DECISIONES_TECNICAS.md para el porque de cada decision.
//
// Sin filtro de sucursal a proposito: un proveedor es de la empresa,
// no de una sucursal (mismo criterio que ClientAccount, M9) — cambiar
// de sucursal activa no cambia este listado.
//
// "Nueva Orden de Compra"/"Nueva OC" ya no abren un modal local (O4,
// DECISIONES_TECNICAS.md): navegan a /compras (con ?proveedor=<id>
// cuando hay un proveedor en contexto), donde vive el formulario real
// de alta contra Compras. Ver esa entrada para el porque — en resumen,
// R2 prohibe que este modulo importe un componente de modules/compras/.
// ============================================================

export const SuppliersPage: FC = () => {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const empresaId = session?.company.id;
  const queryClient = useQueryClient();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = useState('');

  const filters: SuppliersQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      search: debouncedSearchTerm || undefined,
      category: selectedCategory || undefined,
    }),
    [empresaId, debouncedSearchTerm, selectedCategory]
  );

  const {
    items: suppliers,
    page,
    pageSize,
    totalItems,
    totalPages,
    sort,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    setSort,
    refetch,
  } = usePagedQuery(fetchSuppliersPage, filters, { enabled: Boolean(empresaId) });

  // RF-PRO-001: Alta / Modificacion de proveedor contra suppliers.service
  // (persiste en memoria durante la sesion). Tras guardar, se vuelve a
  // pedir la pagina vigente (P10, DECISIONES_TECNICAS.md) en vez de
  // actualizar `suppliers` a mano en el cliente — misma razon que el
  // resto de listados migrados: evita duplicar en el cliente cualquier
  // logica de filtro/orden que ya vive en el servicio.
  const handleSaveSupplier = async (input: SupplierFormInput, supplierId?: string) => {
    if (!empresaId) throw new Error('Todavia no hay una sesion activa.');
    const saved = supplierId
      ? await updateSupplier(empresaId, supplierId, input)
      : await createSupplier(empresaId, input);
    refetch();
    // Invalidacion por mutacion (Tanda 2.5, tabla completa en
    // DECISIONES_TECNICAS.md): crear/editar proveedor invalida ademas
    // la lista completa de proveedores (useCachedQuery, queryName
    // 'suppliers-list', consumida por InventoryPage/ComprasPage) — el
    // listado paginado de esta misma pantalla ya se resuelve con
    // refetch() (Tanda 2), no con esto.
    void queryClient.invalidateQueries({ queryKey: ['cached', 'suppliers-list', empresaId] });
    setSelectedSupplier((prev) => (prev?.id === saved.id ? saved : prev));
    return saved;
  };

  const exportColumns: ExportColumn<Supplier>[] = [
    { header: 'Razon Social', accessor: (s) => s.name },
    { header: 'CUIT', accessor: (s) => s.cuit },
    { header: 'Rubro', accessor: (s) => s.category },
    { header: 'Telefono', accessor: (s) => s.phone },
    { header: 'Email', accessor: (s) => s.contactEmail },
    { header: 'Saldo Actual', accessor: (s) => s.currentBalance },
  ];

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
          <ExportButton
            fileNamePrefix="proveedores"
            columns={exportColumns}
            fetchRows={() => exportSuppliers(filters, sort)}
          />
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
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando proveedores..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de proveedores." onRetry={refetch} />
        ) : (
          <ErrorBoundary
            fallbackTitle="No se pudo mostrar el listado de proveedores."
            fallbackMessage="Intenta de nuevo o volve al inicio."
          >
            <FetchingOverlay isFetching={isFetching}>
              <SuppliersTable
                suppliers={suppliers}
                onRowClick={handleRowClick}
                sort={sort}
                onSortChange={setSort}
              />
            </FetchingOverlay>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </ErrorBoundary>
        )}
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
