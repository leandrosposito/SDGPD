import { useEffect, useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, PackagePlus, CheckCircle2, ShoppingCart } from 'lucide-react';
import type { ReplenishmentStatus, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge, type BadgeVariant } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { getLowStockPage, exportLowStock, type LowStockQueryFilters } from '@/services/mock/products.service';
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
  const navigate = useNavigate();
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

  // "Generar OC" (deep-link, no importa PurchaseOrderFormModal de
  // compras/ directo — R2, ver DECISIONES_TECNICAS.md, O4): navega a
  // Compras con el producto y la sucursal como query params; Compras
  // resuelve ahi el proveedor y la cantidad sugerida y abre su propio
  // modal de alta con esa linea precargada y editable.
  const handleGenerateOrder = (product: StockedInventoryItem) => {
    navigate(`/compras?producto=${encodeURIComponent(product.id)}&sucursal=${encodeURIComponent(branchId)}`);
  };

  // Exportar (tarea transversal): mismos filtros vigentes (branchId)
  // via exportLowStock, que reusa el mismo filtro+orden que
  // getLowStockPage. Sin rango de fecha (Tarea A no aplica aca — ver
  // DECISIONES_TECNICAS.md: StockedInventoryItem no tiene campo de
  // fecha, es una foto del stock actual, no un registro historico).
  const exportColumns: ExportColumn<StockedInventoryItem>[] = [
    { header: 'Codigo', accessor: (row) => row.sku },
    { header: 'Nombre', accessor: (row) => row.name },
    { header: 'Stock Actual', accessor: (row) => row.stock },
    { header: 'Stock Minimo', accessor: (row) => row.minStock },
    { header: 'Deficit', accessor: (row) => Math.max(row.minStock - row.stock, 0) },
    { header: 'Estado', accessor: (row) => REPLENISHMENT_STATUS_LABEL[statusByProductId[row.id] ?? 'not_requested'] },
  ];

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

      <div className="tab-low-stock__toolbar">
        <p className="tab-low-stock__branch-note">
          Mostrando bajo stock de <strong>{branchName}</strong>.
        </p>
        <ExportButton fileNamePrefix="bajo-stock-minimo" columns={exportColumns} fetchRows={() => exportLowStock(filters)} />
      </div>

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
                      // Cantidad sugerida (deficit): minStock - stock,
                      // nunca negativa. En este tab siempre es >= 0
                      // (E6: el filtro ya es stock <= minStock), pero
                      // puede ser exactamente 0 si stock === minStock —
                      // ahi no hay deficit real que comprar, se
                      // deshabilita "Generar OC" en vez de ocultarlo
                      // (misma fila sigue mostrando ambas acciones, sin
                      // saltos de layout entre filas).
                      const deficit = Math.max(row.minStock - row.stock, 0);
                      return (
                        <div className="tab-low-stock__actions">
                          {status === 'requested' ? (
                            <span className="tab-low-stock__requested-tag">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              Solicitada
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="tab-low-stock__action-btn"
                              onClick={() => handleRequestReplenishment(row)}
                              aria-label={`Solicitar reposicion de ${row.name}`}
                            >
                              <PackagePlus size={14} aria-hidden="true" />
                              Solicitar reposicion
                            </button>
                          )}
                          <button
                            type="button"
                            className="tab-low-stock__action-btn tab-low-stock__action-btn--oc"
                            onClick={() => handleGenerateOrder(row)}
                            disabled={deficit <= 0}
                            aria-label={
                              deficit > 0
                                ? `Generar orden de compra para ${row.name}`
                                : `Generar orden de compra no disponible para ${row.name}: sin deficit de stock`
                            }
                            title={deficit > 0 ? undefined : 'El stock ya alcanza el minimo, no hay deficit para sugerir.'}
                          >
                            <ShoppingCart size={14} aria-hidden="true" />
                            Generar OC
                          </button>
                        </div>
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
