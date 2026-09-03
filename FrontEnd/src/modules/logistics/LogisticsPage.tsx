import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import type { DeliveryStatus } from '@/shared/types/logistics.types';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { DateRangeFilter } from '@/shared/components/ui/DateRangeFilter';
import { defaultDateRangeValue, type DateRangeValue } from '@/shared/components/ui/dateRangePresets';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Delivery } from '@/shared/types/logistics.types';
import {
  getDeliveriesPage,
  exportDeliveries,
  advanceDeliveryStatus,
  type DeliveryQueryFilters,
} from './services/deliveries.service';
import { LogisticsKPIs } from './components/LogisticsKPIs';
import { DeliveryFilters, type DeliveryStatusFilter } from './components/DeliveryFilters';
import { DeliveriesTable } from './components/DeliveriesTable';
import { DELIVERY_STATUS_LABEL } from './deliveryStatusLabels';
import './LogisticsPage.css';

// ============================================================
// LogisticsPage — Entregas del Dia
// Tabla paginada server-side de entregas (P1-P10, DECISIONES_TECNICAS.md),
// filtrable por estado (pendiente / en ruta / completada). Los KPIs y los
// contadores del filtro salen de agregados calculados por el servicio,
// no del array de la pagina actual (P3).
//
// Rango de fecha (tarea transversal): antes fijo a "hoy" (todayISO
// hardcodeado); ahora DateRangeFilter con preset "Hoy" como default —
// mismo comportamiento inicial, ahora seleccionable.
// ============================================================

const PRIORITY_LABEL: Record<Delivery['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const LogisticsPage: FC = () => {
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const session = useSessionStore((s) => s.session);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRangeValue('today'));

  const activeBranchName = session?.branches.find((b) => b.id === activeBranchId)?.name ?? '';

  // Memoizado: usePagedQuery compara `filters` por referencia para
  // decidir si hay que volver a pagina 1 (P9) — solo debe cambiar de
  // referencia cuando de verdad cambia sucursal, rango o estado.
  const filters: DeliveryQueryFilters = useMemo(
    () => ({
      branchId: activeBranchId ?? '',
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [activeBranchId, dateRange, statusFilter]
  );

  const {
    items: deliveries,
    aggregates,
    page,
    pageSize,
    totalItems,
    totalPages,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getDeliveriesPage, filters, { enabled: activeBranchId !== null });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar la lista de entregas.');
  }, [error]);

  const handlePrintRoute = () => {
    // Mock print action
    console.log('Imprimiendo hoja de ruta...');
  };

  const handleAdvanceStatus = async (deliveryId: string) => {
    const result = await advanceDeliveryStatus(deliveryId);

    if (result.success && result.newStatus) {
      const label: DeliveryStatus = result.newStatus;
      toast.success(`Entrega ${deliveryId} actualizada a "${DELIVERY_STATUS_LABEL[label]}".`);
      // P10: la lista y los agregados son responsabilidad del servidor
      // (mock hoy); en vez de actualizar `deliveries`/`aggregates` a
      // mano en el cliente (lo que obligaria a recalcular countByStatus
      // y pendingCollectionAmount ahi, violando P3), se vuelve a pedir
      // la pagina que se esta viendo.
      refetch();
      return;
    }

    const message =
      result.reason === 'terminal-status'
        ? 'Esa entrega ya esta completada; no se puede modificar.'
        : 'No se encontro la entrega.';
    toast.error(message);
  };

  // Exportar (tarea transversal): mismos filtros vigentes en pantalla
  // (branchId/rango/estado) via exportDeliveries, que reusa el mismo
  // filtro+orden que getDeliveriesPage (no duplicado).
  const exportColumns: ExportColumn<Delivery>[] = [
    { header: 'Codigo', accessor: (d) => d.id },
    { header: 'Pedido', accessor: (d) => d.orderId },
    { header: 'Cliente', accessor: (d) => d.clientName },
    { header: 'Direccion', accessor: (d) => d.address },
    { header: 'Sucursal', accessor: () => activeBranchName },
    { header: 'Fecha', accessor: (d) => d.date },
    { header: 'Horario Estimado', accessor: (d) => d.estimatedTime },
    { header: 'Zona', accessor: (d) => d.zone },
    { header: 'Prioridad', accessor: (d) => PRIORITY_LABEL[d.priority] },
    { header: 'Estado', accessor: (d) => DELIVERY_STATUS_LABEL[d.status] },
    { header: 'Monto a Cobrar', accessor: (d) => d.collectionAmount },
  ];

  return (
    <div className="logistics-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Logistica y Reparto</h2>
          <p className="page-header__subtitle">Entregas del dia, agrupadas por estado</p>
        </div>
        <div className="page-header__actions">
          <ExportButton fileNamePrefix="entregas" columns={exportColumns} fetchRows={() => exportDeliveries(filters)} />
          <button className="logistics-header-btn" onClick={handlePrintRoute}>
            Imprimir Hoja de Ruta
          </button>
        </div>
      </header>

      <LogisticsKPIs aggregates={aggregates} />

      <DateRangeFilter idPrefix="logistics" value={dateRange} onChange={setDateRange} />

      <DeliveryFilters
        aggregates={aggregates}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {activeBranchId ? (
        <ErrorBoundary
          fallbackTitle="No se pudo mostrar la lista de entregas."
          fallbackMessage="Recarga la pagina para intentar de nuevo."
        >
          <div className="logistics-page__table-container">
            <FetchingOverlay isFetching={isFetching}>
              <DeliveriesTable deliveries={deliveries} onAdvanceStatus={handleAdvanceStatus} />
            </FetchingOverlay>
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
      ) : (
        <div className="logistics-page__table-container">
          <SkeletonTable rows={8} cols={6} />
        </div>
      )}
    </div>
  );
};
