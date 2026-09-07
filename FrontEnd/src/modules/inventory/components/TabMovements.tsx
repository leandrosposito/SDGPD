import { useEffect, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useSessionStore } from '@/shared/state/useSessionStore';
import {
  getMovementsPage,
  type MovementsQueryFilters,
  type MovementsSortField,
} from '@/modules/inventory/api/movements/movements.service';
import type { Branch } from '@/shared/types/session.types';
import type { PageSort } from '@/shared/types/pagination.types';
import './TabMovements.css';

// ============================================================
// TabMovements — Historial de entradas y salidas fisicas EN LA
// SUCURSAL ACTIVA, paginado server-side (Tanda 3g de escalabilidad).
// Se autoconsulta via usePagedQuery + movements.service#getMovementsPage
// — ya no recibe `data` por props (antes InventoryPage le pasaba el
// array completo sin filtrar por sucursal, porque InventoryMovement no
// tenia branchId todavia). Sin busqueda: esta tab nunca tuvo un
// buscador (a diferencia de TabProductHistory).
// ============================================================

interface TabMovementsProps {
  branchId: Branch['id'];
  branchName: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TabMovements: FC<TabMovementsProps> = ({ branchId, branchName }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  // Tanda 4 (corrida completa, A13): pagina y orden en la URL, prefijo
  // `mov_`.
  const urlState = useUrlListState<MovementsSortField, never>({
    prefix: 'mov',
    sortFields: ['date', 'productName', 'quantity'],
  });

  const filters: MovementsQueryFilters = useMemo(
    () => ({ empresaId: empresaId ?? '', branchId }),
    [empresaId, branchId]
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
  } = usePagedQuery(getMovementsPage, filters, {
    page: urlState.page,
    onPageChange: urlState.setPage,
    sort: urlState.sort,
    onSortChange: urlState.setSort,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el historial de movimientos.');
  }, [error]);

  // Mismo patron local que TabLowStock.tsx/SuppliersTable.tsx (unicos
  // listados con orden por columna clickeable hasta ahora).
  const sortField = sort?.field ?? 'date';
  const sortDesc = sort?.direction !== 'asc';

  const handleSort = (field: MovementsSortField) => {
    const next: PageSort<MovementsSortField> =
      sortField === field ? { field, direction: sortDesc ? 'asc' : 'desc' } : { field, direction: 'desc' };
    setSort(next);
  };

  const renderSortIcon = (field: MovementsSortField) => {
    if (sortField !== field) {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-movements__sort-icon tab-movements__sort-icon--inactive">
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return sortDesc ? (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-movements__sort-icon">
        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="tab-movements__sort-icon">
        <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderSortableHeader = (label: string, field: MovementsSortField) => (
    <button type="button" className="tab-movements__sort-btn" onClick={() => handleSort(field)}>
      {label}
      {renderSortIcon(field)}
    </button>
  );

  if (isLoading) {
    return <LoadingState message="Cargando movimientos de la sucursal..." />;
  }

  if (error) {
    return <ErrorState message="No se pudo cargar el historial de movimientos." onRetry={refetch} />;
  }

  return (
    <div className="tab-movements">
      <p className="tab-movements__branch-note">
        Mostrando movimientos de <strong>{branchName}</strong>.
      </p>
      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el historial de movimientos."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <FetchingOverlay isFetching={isFetching}>
          <div className="tab-movements__table-container">
            <Table
              data={data}
              keyExtractor={(mov) => mov.id}
              emptyMessage="No hay movimientos registrados en esta sucursal."
              columns={[
                { header: renderSortableHeader('Fecha', 'date'), accessor: (row) => <span className="font-mono text-xs text-secondary">{formatDate(row.date)}</span> },
                { header: 'SKU', accessor: (row) => <span className="font-mono text-xs">{row.sku}</span> },
                { header: renderSortableHeader('Producto', 'productName'), accessor: 'productName' },
                { header: 'Tipo', accessor: (row) => (
                  <Badge
                    label={row.type === 'in' ? 'Ingreso' : row.type === 'out' ? 'Egreso' : 'Ajuste'}
                    variant={row.type === 'in' ? 'success' : row.type === 'out' ? 'warning' : 'neutral'}
                  />
                )},
                { header: renderSortableHeader('Cant.', 'quantity'), align: 'right', accessor: (row) => (
                  <span className={row.type === 'in' ? 'text-success font-medium' : row.type === 'out' ? 'text-danger font-medium' : 'font-medium'}>
                    {row.type === 'out' ? '-' : '+'}{row.quantity}
                  </span>
                )},
                { header: 'Usuario', accessor: (row) => <span className="text-tertiary">{row.user}</span> },
                { header: 'Notas', accessor: 'notes' },
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
    </div>
  );
};
