import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { getStockedProductsPage, type StockedProductsQueryFilters } from '@/shared/api/products/products.service';
import { ProductSearchBar } from './ProductSearchBar';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import './TabStockCurrent.css';

// ============================================================
// TabStockCurrent — Vista principal de stock con KPIs (Tanda 3e de
// escalabilidad: pasó de recibir `data` por props — ya traído completo
// por InventoryPage vía useCachedQuery — a autoconsultarse con
// usePagedQuery + products.service#getStockedProductsPage, mismo
// patrón que TabLowStock y el Directorio de Clientes (Tanda 3d).
//
// Muestra el catálogo completo con su stock EN LA SUCURSAL ACTIVA
// (E1/E5): un producto sin registro de stock ahí se ve en 0, no se
// excluye — esta tab es "el catálogo con su stock acá", no "lo que
// está cargado en esta sucursal" (esa segunda vista es TabLowStock).
//
// KPIs desde `aggregates` (P3, StockAggregates), no desde `data`: los
// 4 números se calculan server-side sobre TODO lo que matchea la
// búsqueda vigente, nunca sobre la página actual — antes de esta tanda
// se calculaban en memoria sobre `data`, que era el array COMPLETO (sin
// paginar), así que el número era correcto por casualidad, no por
// diseño. "Stock Bajo" usa el mismo criterio E6 que Bajo Stock Mínimo
// (garantizado por products.service, no por esta vista).
//
// Búsqueda: antes vivía en InventoryPage (estado + filtro en memoria
// compartido por prop), ahora vive ACÁ, con debounce propio (mismo
// criterio que el resto de los listados paginados) — ningún otro tab
// del módulo usa este buscador, así que no hace falta que siga en el
// padre.
// ============================================================

const SEARCH_DEBOUNCE_MS = 300;

interface TabStockCurrentProps {
  branchId: Branch['id'];
  branchName: string;
  onOpenLots: (product: InventoryItem) => void;
  onEditProduct: (product: InventoryItem) => void;
  userRole: 'ADMIN' | 'EMPLOYEE';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const TabStockCurrent: FC<TabStockCurrentProps> = ({ branchId, branchName, onOpenLots, onEditProduct, userRole }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  // Tanda 4 (corrida completa, A13): pagina y busqueda en la URL,
  // prefijo `stock_`. Sin orden: esta tab no tiene columnas clickeables.
  const urlState = useUrlListState<never, 'q'>({
    prefix: 'stock',
    filterKeys: ['q'],
  });

  const [searchQuery, setSearchQuery] = useState(urlState.filters.q ?? '');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const current = urlState.filters.q ?? '';
    if (debouncedSearchQuery !== current) {
      urlState.setFilter('q', debouncedSearchQuery || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al valor debounceado
  }, [debouncedSearchQuery]);

  const filters: StockedProductsQueryFilters = useMemo(
    () => ({ empresaId: empresaId ?? '', branchId, search: urlState.filters.q || undefined }),
    [empresaId, branchId, urlState.filters.q]
  );

  const {
    items: data,
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
  } = usePagedQuery(getStockedProductsPage, filters, {
    enabled: Boolean(empresaId) && Boolean(branchId),
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el stock de la sucursal.');
  }, [error]);

  // Mismo criterio que OrderKpis (Tanda 3a): las tarjetas se muestran
  // siempre, con 0 mientras `aggregates` todavía no resolvió (primera
  // carga) — no se ocultan detrás de `isLoading`.
  const totalProducts = aggregates?.totalProducts ?? 0;
  const lowStock = aggregates?.lowStock ?? 0;
  const outOfStock = aggregates?.outOfStock ?? 0;
  const totalValue = aggregates?.totalValue ?? 0;

  return (
    <div className="tab-stock">
      <ProductSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <p className="tab-stock__branch-note">
        Mostrando stock de <strong>{branchName}</strong>. El stock de otras sucursales no se ve aca.
      </p>

      <div className="tab-stock__kpis">
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Total Productos</p>
          <p className="tab-stock__kpi-value">{totalProducts}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Stock Bajo</p>
          <p className="tab-stock__kpi-value text-warning">{lowStock}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Sin Stock</p>
          <p className="tab-stock__kpi-value text-danger">{outOfStock}</p>
        </div>
        <div className="tab-stock__kpi-card">
          <p className="tab-stock__kpi-label">Valor Inventario</p>
          <p className="tab-stock__kpi-value text-success">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Cargando stock de la sucursal..." />
      ) : error ? (
        <ErrorState message="No se pudo cargar el stock de la sucursal." onRetry={refetch} />
      ) : (
        <ErrorBoundary
          fallbackTitle="No se pudo mostrar el stock de la sucursal."
          fallbackMessage="Recarga la pagina para intentar de nuevo."
        >
          <FetchingOverlay isFetching={isFetching}>
            <div className="tab-stock__content">
              <Table
                data={data}
                keyExtractor={(item) => item.id}
                columns={[
                  { header: 'Codigo', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
                  { header: 'Cod. Barras', accessor: (row) => <span className="font-mono text-xs text-tertiary">{row.barcode}</span> },
                  { header: 'Nombre', accessor: 'name' },
                  { header: 'Categoria', accessor: (row) => <span className="text-tertiary">{row.category}</span> },
                  { header: 'U.M.', accessor: (row) => <span className="text-tertiary">{row.unitOfMeasure}</span> },
                  { header: 'Stock Actual', align: 'right', accessor: (row) => (
                    <span className={row.stock === 0 ? 'text-danger font-bold' : row.stock <= row.minStock ? 'text-warning font-bold' : 'font-medium'}>
                      {row.stock}
                    </span>
                  )},
                  { header: 'Costo', align: 'right', accessor: (row) => <span className="text-secondary">{formatCurrency(row.cost)}</span> },
                  { header: 'Valor Stock', align: 'right', accessor: (row) => <span className="text-accent font-medium">{formatCurrency(row.stock * row.cost)}</span> },
                  { header: 'Estado', align: 'center', accessor: (row) => (
                    <Badge
                      label={row.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                      variant={row.status === 'active' ? 'success' : 'neutral'}
                    />
                  )},
                  { header: 'Acciones', align: 'center', accessor: (row) => (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                      <button
                        className="btn-action btn-action--ghost"
                        onClick={() => onOpenLots(row)}
                      >
                        Ver Lotes
                      </button>
                      {userRole === 'ADMIN' && (
                        <button
                          className="btn-action btn-action--ghost"
                          onClick={() => onEditProduct(row)}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  )},
                ]}
              />
            </div>
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
  );
};
