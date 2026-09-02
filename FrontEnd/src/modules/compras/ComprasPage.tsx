import { useEffect, useMemo, useState, type FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrdersQueryFilters } from '@/shared/types/purchaseOrder.types';
import { fetchSuppliers } from '@/services/mock/suppliers.service';
import { fetchProducts } from '@/services/mock/products.service';
import { getPurchaseOrdersPage, updatePurchaseOrderStatus } from '@/services/mock/purchaseOrders.service';
import { PurchaseOrderFilters } from './components/PurchaseOrderFilters';
import { PurchaseOrderStatusSummary } from './components/PurchaseOrderStatusSummary';
import { PurchaseOrdersTable } from './components/PurchaseOrdersTable';
import { PurchaseOrderDetailPanel } from './components/PurchaseOrderDetailPanel';
import { PurchaseOrderFormModal } from './components/PurchaseOrderFormModal';
import './ComprasPage.css';

// ============================================================
// ComprasPage — Modulo Compras (O1-O10, DECISIONES_TECNICAS.md).
// OrdenDeCompra es la unica fuente de verdad (O3): esta pagina es el
// unico lugar donde se listan/crean/transicionan ordenes de compra.
// Listado paginado server-side (O8) con filtros tipados, busqueda
// debounced y agregados por estado. La sucursal activa es solo el
// DEFAULT para crear una orden nueva (O5) — no es un filtro de la
// consulta: una OC ya creada sigue mostrandose sin importar la
// sucursal activa actual.
//
// Abre el modal de alta automaticamente si llega `?proveedor=<id>` en
// la URL (O4): Proveedores navega aca en vez de importar el modal
// directamente (R2 — ver DECISIONES_TECNICAS.md, O4, para el porque).
// ============================================================

// Referencia estable para `branches` de mas abajo (ver regla de
// selectores en DECISIONES_TECNICAS.md): un `?? []` inline en cada
// render alimentaria el useMemo de branchesById con una dependencia
// distinta cada vez y lo invalidaria siempre.
const EMPTY_BRANCHES: Branch[] = [];

export const ComprasPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const session = useSessionStore((s) => s.session);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Proveedor pedido por query param (O4), copiado a estado propio ANTES
  // de limpiar la URL: si se leyera `searchParams.get('proveedor')`
  // directo en cada render, el mismo efecto que borra el query param
  // haria que ese valor ya fuera null en el render donde el modal se
  // abre (isCreateModalOpen y el query param cambian en el mismo ciclo
  // de efectos) — el proveedor preseleccionado se perderia.
  const [supplierIdFromUrl, setSupplierIdFromUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchSuppliers()
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el listado de proveedores.');
      });
    fetchProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el catalogo de productos.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep link desde Proveedores (O4): ?proveedor=<id> abre el modal de
  // alta con ese proveedor preseleccionado. Se limpia el query param al
  // abrir para que un refresh de la pagina no reabra el modal solo.
  useEffect(() => {
    const supplierId = searchParams.get('proveedor');
    if (supplierId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reaccion a un query param de entrada, no un derivado sincronico del render
      setSupplierIdFromUrl(supplierId);
      setIsCreateModalOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('proveedor');
          return next;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams no es estable entre renders (react-router), no debe disparar el efecto de nuevo
  }, [searchParams]);

  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const branches = session?.branches ?? EMPTY_BRANCHES;
  const branchesById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const filters: PurchaseOrdersQueryFilters = useMemo(
    () => ({
      search: debouncedSearchQuery || undefined,
      supplierId: supplierFilter || undefined,
      status: statusFilter || undefined,
      branchId: branchFilter || undefined,
    }),
    [debouncedSearchQuery, supplierFilter, statusFilter, branchFilter]
  );

  const {
    items: orders,
    aggregates,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getPurchaseOrdersPage, filters);

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de ordenes de compra.');
  }, [error]);

  const handleViewDetail = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const handleTransition = async (order: PurchaseOrder, nextStatus: PurchaseOrderStatus) => {
    setIsTransitioning(true);
    try {
      const result = await updatePurchaseOrderStatus(order.id, nextStatus);
      if (result.success && result.order) {
        toast.success(`Orden ${order.id} actualizada.`);
        setSelectedOrder(result.order);
        refetch();
        return;
      }
      const message =
        result.reason === 'invalid-transition'
          ? 'Esa orden no puede pasar a ese estado desde su estado actual.'
          : 'No se encontro la orden de compra.';
      toast.error(message);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleOrderCreated = (order: PurchaseOrder) => {
    refetch();
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  return (
    <div className="compras-page page-enter">
      <header className="page-header">
        <div>
          <div className="page-header__title-group">
            <ShoppingCart size={22} aria-hidden="true" />
            <h2 className="page-header__title">Compras</h2>
          </div>
          <p className="page-header__subtitle">Ordenes de compra a proveedores</p>
        </div>
        <button
          type="button"
          className="client-modal-btn client-modal-btn--primary"
          onClick={() => {
            setSupplierIdFromUrl(undefined);
            setIsCreateModalOpen(true);
          }}
        >
          Nueva Orden de Compra
        </button>
      </header>

      <PurchaseOrderStatusSummary
        aggregates={aggregates}
        totalItems={totalItems}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <PurchaseOrderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        supplierId={supplierFilter}
        onSupplierChange={setSupplierFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        branchId={branchFilter}
        onBranchChange={setBranchFilter}
        suppliers={suppliers}
        branches={branches}
      />

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el listado de ordenes de compra."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="compras-page__table-container">
          {isLoading ? (
            <SkeletonTable rows={8} cols={7} />
          ) : (
            <FetchingOverlay isFetching={isFetching}>
              <PurchaseOrdersTable
                orders={orders}
                suppliersById={suppliersById}
                branchesById={branchesById}
                onViewDetail={handleViewDetail}
              />
            </FetchingOverlay>
          )}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </ErrorBoundary>

      <PurchaseOrderDetailPanel
        order={selectedOrder}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        suppliersById={suppliersById}
        branchesById={branchesById}
        productsById={productsById}
        onTransition={handleTransition}
        isTransitioning={isTransitioning}
      />

      <PurchaseOrderFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        suppliers={suppliers}
        branches={branches}
        products={products}
        defaultSupplierId={supplierIdFromUrl}
        defaultBranchId={activeBranchId ?? undefined}
        onCreated={handleOrderCreated}
      />
    </div>
  );
};
