import { useEffect, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, PackagePlus, CheckCircle2 } from 'lucide-react';
import type { ReplenishmentStatus, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge, type BadgeVariant } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { getLowStockPage, type LowStockQueryFilters } from '@/services/mock/products.service';
import { useReplenishmentStore } from '../state/useReplenishmentStore';
import './TabLowStock.css';

// ============================================================
// TabLowStock — Productos bajo stock minimo EN LA SUCURSAL ACTIVA,
// paginado server-side (P1-P10, DECISIONES_TECNICAS.md). Se autoconsulta
// via usePagedQuery + products.service#getLowStockPage: ya no recibe
// `data` por prop, porque quien pagina (pagina/tamaño/orden) es este
// componente, no InventoryPage. getLowStockPage excluye los productos
// sin registro de stock en la sucursal (E5) — no aparecen aca "en 0",
// simplemente no estan cargados en esta sucursal.
// ============================================================

const REPLENISHMENT_STATUS_LABEL: Record<ReplenishmentStatus, string> = {
  not_requested: 'Sin solicitar',
  requested: 'Reposicion solicitada',
};

const REPLENISHMENT_STATUS_VARIANT: Record<ReplenishmentStatus, BadgeVariant> = {
  not_requested: 'neutral',
  requested: 'info',
};

interface TabLowStockProps {
  branchId: Branch['id'];
  branchName: string;
}

export const TabLowStock: FC<TabLowStockProps> = ({ branchId, branchName }) => {
  const statusByProductId = useReplenishmentStore((s) => s.statusByProductId);
  const requestReplenishment = useReplenishmentStore((s) => s.requestReplenishment);

  const filters: LowStockQueryFilters = useMemo(() => ({ branchId }), [branchId]);

  const {
    items: data,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
  } = usePagedQuery(getLowStockPage, filters);

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de bajo stock.');
  }, [error]);

  const handleRequestReplenishment = (product: StockedInventoryItem) => {
    const result = requestReplenishment(product.id);

    if (result.success) {
      toast.success(`Reposicion solicitada para "${product.name}".`);
      return;
    }

    toast.error(`"${product.name}" ya tiene una reposicion solicitada.`);
  };

  return (
    <div className="tab-low-stock">
      <header className="tab-low-stock__header">
        <div className="tab-low-stock__title-group">
          <AlertTriangle className="tab-low-stock__icon" size={20} aria-hidden="true" />
          <div>
            <h3 className="tab-low-stock__title">Productos Bajo Stock Minimo</h3>
            <p className="tab-low-stock__subtitle">
              Productos cuyo stock actual esta por debajo del minimo definido
            </p>
          </div>
        </div>
        {/* 3.6: el conteo viene del total de la respuesta paginada
            (totalItems), nunca de data.length (esa solo tendria las
            filas de la pagina actual). */}
        <span className="tab-low-stock__count" aria-live="polite">
          {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
        </span>
      </header>

      <p className="tab-low-stock__branch-note">
        Mostrando bajo stock de <strong>{branchName}</strong>.
      </p>

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el listado de bajo stock."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="tab-low-stock__table-container">
          {isLoading ? (
            <SkeletonTable rows={8} cols={7} />
          ) : (
            <FetchingOverlay isFetching={isFetching}>
              <Table
                data={data}
                keyExtractor={(item) => item.id}
                emptyMessage="No hay productos por debajo del stock minimo."
                columns={[
                  {
                    header: 'Codigo',
                    accessor: (row) => <span className="tab-low-stock__code">{row.sku}</span>,
                  },
                  { header: 'Nombre', accessor: 'name' },
                  {
                    header: 'Stock Actual',
                    align: 'right',
                    accessor: (row) => <span className="tab-low-stock__stock--current">{row.stock}</span>,
                  },
                  {
                    header: 'Stock Minimo',
                    align: 'right',
                    accessor: (row) => <span>{row.minStock}</span>,
                  },
                  {
                    header: 'Deficit',
                    align: 'right',
                    accessor: (row) => (
                      <span className="tab-low-stock__deficit">-{row.minStock - row.stock}</span>
                    ),
                  },
                  {
                    header: 'Estado',
                    align: 'center',
                    accessor: (row) => {
                      const status = statusByProductId[row.id] ?? 'not_requested';
                      return (
                        <Badge
                          label={REPLENISHMENT_STATUS_LABEL[status]}
                          variant={REPLENISHMENT_STATUS_VARIANT[status]}
                        />
                      );
                    },
                  },
                  {
                    header: 'Acciones',
                    align: 'right',
                    accessor: (row) => {
                      const status = statusByProductId[row.id] ?? 'not_requested';
                      if (status === 'requested') {
                        return (
                          <span className="tab-low-stock__requested-tag">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Solicitada
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          className="tab-low-stock__action-btn"
                          onClick={() => handleRequestReplenishment(row)}
                          aria-label={`Solicitar reposicion de ${row.name}`}
                        >
                          <PackagePlus size={14} aria-hidden="true" />
                          Solicitar reposicion
                        </button>
                      );
                    },
                  },
                ]}
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
  );
};
