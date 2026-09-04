import { useEffect, useMemo, useState, type FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrdersQueryFilters } from '@/shared/types/purchaseOrder.types';
import { fetchSuppliers } from '@/modules/suppliers/api/suppliers.service';
import { fetchProducts, getStockForBranch } from '@/services/mock/products.service';
import { getPurchaseOrdersPage, exportPurchaseOrders, updatePurchaseOrderStatus, computePurchaseOrderTotal } from '@/services/mock/purchaseOrders.service';
import type { PurchaseOrderFormInput } from './components/PurchaseOrderFormModal.schema';
import { PurchaseOrderFilters } from './components/PurchaseOrderFilters';
import { PurchaseOrderStatusSummary } from './components/PurchaseOrderStatusSummary';
import { PurchaseOrdersTable } from './components/PurchaseOrdersTable';
import { PurchaseOrderDetailPanel } from './components/PurchaseOrderDetailPanel';
import { PurchaseOrderFormModal } from './components/PurchaseOrderFormModal';
import { TabPendingReceipt } from './components/TabPendingReceipt';
import { PURCHASE_ORDER_STATUS_LABEL } from './purchaseOrderLabels';
import { Tabs, type TabItem } from '@/shared/components/ui/Tabs';
import { DateRangeFilter } from '@/shared/components/ui/DateRangeFilter';
import { defaultDateRangeValue, type DateRangeValue } from '@/shared/components/ui/dateRangePresets';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
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
// Segundo caso del mismo patron: `?producto=<id>&sucursal=<id>` (desde
// TabLowStock/Inventario, boton "Generar OC") precarga ademas una
// linea completa (producto+cantidad+proveedor), resuelta aca porque
// Compras ya carga el catalogo (fetchProducts) — Inventario nunca
// importa PurchaseOrderFormModal.
//
// Tabs (Task B): "Listado General" (contenido de siempre, filtro de
// sucursal manual) y "Pendientes de Recepcion" (TabPendingReceipt,
// auto-filtrado por sucursal activa, patron LogisticsPage — ver
// DECISIONES_TECNICAS.md para por que difieren a proposito).
// ============================================================

// Referencia estable para `branches` de mas abajo (ver regla de
// selectores en DECISIONES_TECNICAS.md): un `?? []` inline en cada
// render alimentaria el useMemo de branchesById con una dependencia
// distinta cada vez y lo invalidaria siempre.
const EMPTY_BRANCHES: Branch[] = [];
// Mismo motivo que EMPTY_BRANCHES: referencias estables para el
// fallback de useCachedQuery mientras no resolvio.
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_PRODUCTS: InventoryItem[] = [];

export const ComprasPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const session = useSessionStore((s) => s.session);

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
  // Linea precargada por deep-link `?producto=` (Task A). Mismo criterio
  // que supplierIdFromUrl: se copia a estado propio antes de limpiar la
  // URL, y es lo que se le pasa como prop al modal.
  const [defaultLinesFromUrl, setDefaultLinesFromUrl] = useState<PurchaseOrderFormInput['lines'] | undefined>(
    undefined
  );
  const [activeTab, setActiveTab] = useState('listado');
  // Rango de fecha (tarea transversal): default 'all' (sin filtro) —
  // este listado hoy no filtraba por fecha, "Hoy" como default
  // ocultaria de entrada todo el historico existente sin que el
  // usuario haya tocado nada (ver DECISIONES_TECNICAS.md).
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRangeValue('all'));

  // Catalogo de productos y lista de proveedores (Tanda 2.5,
  // useCachedQuery — ver RELEVAMIENTO_CACHE.md/DECISIONES_TECNICAS.md):
  // mismo queryName ('products'/'suppliers-list') que InventoryPage y
  // CreateOrderModal — los 3 comparten una sola entrada de cache
  // (dedupe real entre modulos), no 3 fetches independientes.
  const empresaId = session?.company.id;
  const queryClient = useQueryClient();

  const { data: suppliersData, error: suppliersError } = useCachedQuery(
    'suppliers-list',
    undefined,
    (signal) => fetchSuppliers(empresaId ?? '', signal),
    { staleTime: CACHE_STALE_TIME.CATALOG, enabled: Boolean(empresaId) }
  );
  const suppliers = suppliersData ?? EMPTY_SUPPLIERS;

  useEffect(() => {
    if (suppliersError) toast.error('No se pudo cargar el listado de proveedores.');
  }, [suppliersError]);

  const { data: productsData, error: productsError } = useCachedQuery(
    'products',
    undefined,
    (signal) => fetchProducts(signal),
    { staleTime: CACHE_STALE_TIME.CATALOG }
  );
  const products = productsData ?? EMPTY_PRODUCTS;

  useEffect(() => {
    if (productsError) toast.error('No se pudo cargar el catalogo de productos.');
  }, [productsError]);

  // Deep link desde Proveedores (O4): ?proveedor=<id> abre el modal de
  // alta con ese proveedor preseleccionado. Se limpia el query param al
  // abrir para que un refresh de la pagina no reabra el modal solo.
  useEffect(() => {
    const supplierId = searchParams.get('proveedor');
    if (supplierId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reaccion a un query param de entrada, no un derivado sincronico del render
      setSupplierIdFromUrl(supplierId);
      setDefaultLinesFromUrl(undefined);
      setIsCreateModalOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('proveedor');
          return next;
        },
        { replace: true }
      );
      return;
    }

    // Segundo caso del mismo patron de deep-link (Task A): TabLowStock
    // (Inventario) navega con `?producto=<id>&sucursal=<id>`. Precarga
    // una LINEA completa (no solo el proveedor), asi que a diferencia
    // del caso de arriba necesita resolver el producto real primero —
    // por eso espera a que `products` este cargado (mismo criterio de
    // "reintentar hasta que exista" que ya usa el modal con `suppliers`,
    // ver PurchaseOrderFormModal.tsx).
    const productoId = searchParams.get('producto');
    if (!productoId) return;
    if (products.length === 0) return;

    const product = products.find((p) => p.id === productoId);
    if (!product) {
      toast.error('No se encontro el producto indicado para generar la orden de compra.');
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('producto');
          next.delete('sucursal');
          return next;
        },
        { replace: true }
      );
      return;
    }

    const branchIdParam = searchParams.get('sucursal') ?? activeBranchId ?? undefined;
    let cancelled = false;

    (async () => {
      // Cantidad recalculada aca (autoridad del servicio), no confiada
      // a un query param: el stock pudo cambiar entre que se listo el
      // bajo stock en Inventario y el click en "Generar OC".
      const stock = branchIdParam ? await getStockForBranch(product.id, branchIdParam) : undefined;
      const suggestedQuantity = stock ? Math.max(stock.minStock - stock.stock, 0) : 0;
      if (cancelled) return;

      setDefaultLinesFromUrl([
        {
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          // Salvaguarda: TabLowStock ya deshabilita "Generar OC" cuando
          // el deficit es 0, pero si igual llega asi (stock cambio
          // entre el listado y el click) no se arranca el formulario
          // con una cantidad invalida (el schema exige minimo 1).
          quantity: suggestedQuantity > 0 ? suggestedQuantity : 1,
          unitPrice: product.cost,
        },
      ]);
      setSupplierIdFromUrl(product.supplierId);
      setIsCreateModalOpen(true);
    })();

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('producto');
        next.delete('sucursal');
        return next;
      },
      { replace: true }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams no es estable entre renders (react-router), no debe disparar el efecto de nuevo
  }, [searchParams, products, activeBranchId]);

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
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [debouncedSearchQuery, supplierFilter, statusFilter, branchFilter, dateRange]
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
        // Invalidacion por mutacion (Tanda 2.5, tabla completa en
        // DECISIONES_TECNICAS.md): cambiar el estado de una OC invalida
        // ademas su presencia en el historial de OC del proveedor
        // (Tanda 2.5, useCachedQuery en SupplierDetailPanel) — el
        // listado paginado de esta misma pantalla ya se resuelve con
        // refetch() (Tanda 2), no con esto.
        if (empresaId) {
          void queryClient.invalidateQueries({
            queryKey: ['cached', 'purchase-orders-by-supplier', empresaId, result.order.supplierId],
          });
        }
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

  // Exportar (tarea transversal): mismos filtros vigentes del Listado
  // General (incluido el rango de fecha) via exportPurchaseOrders, que
  // reusa el mismo filtro+orden que getPurchaseOrdersPage.
  const exportColumns: ExportColumn<PurchaseOrder>[] = [
    { header: 'OC', accessor: (o) => o.id },
    { header: 'Proveedor', accessor: (o) => suppliersById.get(o.supplierId)?.name ?? 'Proveedor no disponible' },
    { header: 'Sucursal', accessor: (o) => branchesById.get(o.branchId)?.name ?? 'Sucursal no disponible' },
    { header: 'Fecha de Creacion', accessor: (o) => o.createdAt.slice(0, 10) },
    { header: 'Estado', accessor: (o) => PURCHASE_ORDER_STATUS_LABEL[o.status] },
    { header: 'Moneda', accessor: (o) => o.currency },
    { header: 'Total', accessor: (o) => computePurchaseOrderTotal(o.lines) },
  ];

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
            setDefaultLinesFromUrl(undefined);
            setIsCreateModalOpen(true);
          }}
        >
          Nueva Orden de Compra
        </button>
      </header>

      <Tabs
        tabs={
          [
            {
              id: 'listado',
              label: 'Listado General',
              content: (
                <div className="compras-page__tab-content">
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

                  <div className="compras-page__tab-toolbar">
                    <DateRangeFilter idPrefix="compras-listado" value={dateRange} onChange={setDateRange} />
                    <ExportButton
                      fileNamePrefix="ordenes-compra"
                      columns={exportColumns}
                      fetchRows={() => exportPurchaseOrders(filters)}
                    />
                  </div>

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
                </div>
              ),
            },
            {
              id: 'pending-receipt',
              label: 'Pendientes de Recepcion',
              content: !activeBranchId ? (
                <SkeletonTable rows={5} cols={6} />
              ) : (
                <TabPendingReceipt
                  branchId={activeBranchId}
                  branchName={branches.find((b) => b.id === activeBranchId)?.name ?? ''}
                  suppliersById={suppliersById}
                  branchesById={branchesById}
                  productsById={productsById}
                />
              ),
            },
          ] satisfies TabItem[]
        }
        activeTabId={activeTab}
        onChange={setActiveTab}
      />

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
        defaultLines={defaultLinesFromUrl}
        onCreated={handleOrderCreated}
      />
    </div>
  );
};
