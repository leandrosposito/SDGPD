import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSessionStore } from '@/shared/state/useSessionStore';
import {
  getProductHistoryPage,
  exportProductHistory,
  type ProductHistoryQueryFilters,
  type ProductHistorySortField,
} from '@/modules/inventory/api/product-history/product-history.service';
import type { ProductHistoryEvent } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageSort } from '@/shared/types/pagination.types';
import './TabProductHistory.css';

// ============================================================
// TabProductHistory — Auditoria de eventos de inventario EN LA
// SUCURSAL ACTIVA, paginado server-side (Tanda 3g de escalabilidad).
// Se autoconsulta via usePagedQuery + product-history.service#getProductHistoryPage
// — ya no recibe `data` por props. La busqueda (SKU/Nombre) que antes
// filtraba en memoria (Paso 1 del reconocimiento de esta tanda) ahora
// es server-side, con debounce (antes era gratis en memoria, no lo
// necesitaba — aprendizaje 15, GUIA_MIGRACION_MODULO.md).
// ============================================================

const SEARCH_DEBOUNCE_MS = 300;

interface TabProductHistoryProps {
  branchId: Branch['id'];
  branchName: string;
}

const productHistoryExportColumns: ExportColumn<ProductHistoryEvent>[] = [
  { header: 'Fecha', accessor: (e) => e.date },
  { header: 'SKU', accessor: (e) => e.sku },
  { header: 'Producto', accessor: (e) => e.productName },
  { header: 'Evento', accessor: (e) => e.eventType },
  { header: 'Descripcion', accessor: (e) => e.description },
  { header: 'Usuario', accessor: (e) => e.user },
];

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TabProductHistory: FC<TabProductHistoryProps> = ({ branchId, branchName }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  // Tanda 4 (corrida completa, A13): pagina, orden y busqueda en la
  // URL, prefijo `hist_`.
  const urlState = useUrlListState<ProductHistorySortField, 'q'>({
    prefix: 'hist',
    sortFields: ['date', 'productName'],
    filterKeys: ['q'],
  });

  const [searchTerm, setSearchTerm] = useState(urlState.filters.q ?? '');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const current = urlState.filters.q ?? '';
    if (debouncedSearchTerm !== current) {
      urlState.setFilter('q', debouncedSearchTerm || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al valor debounceado
  }, [debouncedSearchTerm]);

  // V3 de VERIFICACION_CORRIDA_COMPLETA.md: si la URL cambia externamente
  // (back/forward del navegador) mientras el componente sigue montado,
  // el input debe reflejarlo — sin este efecto quedaba mostrando texto
  // viejo aunque el listado ya se hubiera re-filtrado segun la URL real.
  useEffect(() => {
    // Microtask (mismo patron ya usado en ReprogramarModal/AlertsBell/
    // RegistrarEntregaModal) para no disparar setState sincronico en
    // el cuerpo del efecto.
    Promise.resolve().then(() => setSearchTerm(urlState.filters.q ?? ''));
  }, [urlState.filters.q]);

  const filters: ProductHistoryQueryFilters = useMemo(
    () => ({ empresaId: empresaId ?? '', branchId, search: urlState.filters.q || undefined }),
    [empresaId, branchId, urlState.filters.q]
  );

  const {
    items: data,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    sort,
    setPage,
    setPageSize,
    setSort,
    refetch,
  } = usePagedQuery(getProductHistoryPage, filters, {
    page: urlState.page,
    onPageChange: urlState.setPage,
    sort: urlState.sort,
    onSortChange: urlState.setSort,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el historial del producto.');
  }, [error]);

  const sortField = sort?.field ?? 'date';
  const sortDesc = sort?.direction !== 'asc';

  const handleSort = (field: ProductHistorySortField) => {
    const next: PageSort<ProductHistorySortField> =
      sortField === field ? { field, direction: sortDesc ? 'asc' : 'desc' } : { field, direction: 'desc' };
    setSort(next);
  };

  const renderSortIcon = (field: ProductHistorySortField) => {
    if (sortField !== field) {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-history__sort-icon tab-history__sort-icon--inactive">
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return sortDesc ? (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-history__sort-icon">
        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-history__sort-icon">
        <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderSortableHeader = (label: string, field: ProductHistorySortField) => (
    <button type="button" className="tab-history__sort-btn" onClick={() => handleSort(field)}>
      {label}
      {renderSortIcon(field)}
    </button>
  );

  return (
    <div className="tab-history">
      <header className="tab-history__header">
        <div>
          <h3 className="tab-history__title">Historial de Producto</h3>
          <p className="text-secondary text-sm">
            Auditoria de cambios de precio, actualizaciones de proveedor e ingresos/egresos.
          </p>
        </div>

        <div className="tab-history__toolbar">
          <div className="tab-history__search-wrapper">
            <input
              type="text"
              placeholder="Buscar por SKU o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
          <p className="tab-history__branch-note">
            Mostrando historial de <strong>{branchName}</strong>.
          </p>
          <ExportButton
            fileNamePrefix="historial-producto"
            columns={productHistoryExportColumns}
            fetchRows={() => exportProductHistory(filters, sort)}
          />
        </div>
      </header>

      {isLoading ? (
        <LoadingState message="Cargando historial de la sucursal..." />
      ) : error ? (
        <ErrorState message="No se pudo cargar el historial del producto." onRetry={refetch} />
      ) : (
        <ErrorBoundary
          fallbackTitle="No se pudo mostrar el historial del producto."
          fallbackMessage="Recarga la pagina para intentar de nuevo."
        >
          <FetchingOverlay isFetching={isFetching}>
            <div className="tab-history__table-container">
              <Table
                data={data}
                keyExtractor={(row) => row.id}
                emptyMessage="No hay eventos de historial en esta sucursal."
                columns={[
                  { header: renderSortableHeader('Fecha', 'date'), accessor: (row) => <span className="font-mono text-xs text-secondary">{formatDate(row.date)}</span> },
                  { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
                  { header: renderSortableHeader('Producto', 'productName'), accessor: 'productName' },
                  { header: 'Evento', accessor: (row) => <span className="font-medium text-accent">{row.eventType}</span> },
                  { header: 'Descripcion', accessor: (row) => <span className="text-secondary">{row.description}</span> },
                  { header: 'Usuario', accessor: (row) => <span className="text-tertiary">{row.user}</span> },
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
