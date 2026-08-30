import { useMemo, type FC } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, PackagePlus, CheckCircle2 } from 'lucide-react';
import type { InventoryItem, ReplenishmentStatus } from '../../../shared/types/inventory.types';
import { Table } from '../../../shared/components/ui/Table';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { Pagination } from '../../../shared/components/ui/Pagination';
import { ErrorBoundary } from '../../../shared/components/ui/ErrorBoundary';
import { usePagination } from '../../../shared/hooks/usePagination';
import { useReplenishmentStore } from '../state/useReplenishmentStore';
import './TabLowStock.css';

// ============================================================
// TabLowStock — Productos bajo stock minimo
// Filtra en memoria (useMemo) sobre el mismo InventoryItem[] que
// usa el resto del modulo; no crea una entidad de producto paralela.
// ============================================================

const PAGE_SIZE = 8;

const REPLENISHMENT_STATUS_LABEL: Record<ReplenishmentStatus, string> = {
  not_requested: 'Sin solicitar',
  requested: 'Reposicion solicitada',
};

const REPLENISHMENT_STATUS_VARIANT: Record<ReplenishmentStatus, BadgeVariant> = {
  not_requested: 'neutral',
  requested: 'info',
};

interface TabLowStockProps {
  data: InventoryItem[];
}

export const TabLowStock: FC<TabLowStockProps> = ({ data }) => {
  const statusByProductId = useReplenishmentStore((s) => s.statusByProductId);
  const requestReplenishment = useReplenishmentStore((s) => s.requestReplenishment);

  // Filtro de "bajo stock minimo": estrictamente por debajo, no en el
  // limite (coincide con el criterio ya usado en TabStockCurrent).
  const lowStockItems = useMemo(
    () => data.filter((item) => item.stock < item.minStock),
    [data]
  );

  const { pageItems, currentPage, totalPages, totalItems, setPage } = usePagination(
    lowStockItems,
    PAGE_SIZE
  );

  const handleRequestReplenishment = (product: InventoryItem) => {
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
        <span className="tab-low-stock__count" aria-live="polite">
          {lowStockItems.length} {lowStockItems.length === 1 ? 'producto' : 'productos'}
        </span>
      </header>

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el listado de bajo stock."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="tab-low-stock__table-container">
          <Table
            data={pageItems}
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
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
};
