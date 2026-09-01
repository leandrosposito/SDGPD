import type { FC } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, PackagePlus, CheckCircle2 } from 'lucide-react';
import type { ReplenishmentStatus, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge, type BadgeVariant } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { usePagination } from '@/shared/hooks/usePagination';
import { useReplenishmentStore } from '../state/useReplenishmentStore';
import './TabLowStock.css';

// ============================================================
// TabLowStock — Productos bajo stock minimo EN LA SUCURSAL ACTIVA
// `data` ya viene filtrada por sucursal + "bajo minimo" desde
// products.service#getLowStockForBranch (E4: el componente no recorre
// stock a mano). Esa misma funcion excluye los productos sin registro
// de stock en la sucursal (E5) — no aparecen aca "en 0", simplemente no
// estan cargados en esta sucursal.
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
  data: StockedInventoryItem[];
  branchId: Branch['id'] | null;
  branchName: string;
}

export const TabLowStock: FC<TabLowStockProps> = ({ data, branchId, branchName }) => {
  const statusByProductId = useReplenishmentStore((s) => s.statusByProductId);
  const requestReplenishment = useReplenishmentStore((s) => s.requestReplenishment);

  // resetKey = branchId: al cambiar de sucursal, `data` cambia (nuevo
  // fetch en InventoryPage) y la paginacion vuelve a la pagina 1 en vez
  // de quedar en una pagina vacia de la sucursal anterior.
  const { pageItems, currentPage, totalPages, totalItems, setPage } = usePagination(
    data,
    PAGE_SIZE,
    branchId ?? ''
  );

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
        <span className="tab-low-stock__count" aria-live="polite">
          {data.length} {data.length === 1 ? 'producto' : 'productos'}
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
