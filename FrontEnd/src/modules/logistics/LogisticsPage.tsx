import { useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import type { DeliveryStatus } from '../../shared/types/logistics.types';
import { usePagination } from '../../shared/hooks/usePagination';
import { Pagination } from '../../shared/components/ui/Pagination';
import { ErrorBoundary } from '../../shared/components/ui/ErrorBoundary';
import { useDeliveriesStore } from './state/useDeliveriesStore';
import { getDeliveriesForDate } from './services/deliveries.service';
import { LogisticsKPIs } from './components/LogisticsKPIs';
import { DeliveryFilters, type DeliveryStatusFilter } from './components/DeliveryFilters';
import { DeliveriesTable } from './components/DeliveriesTable';
import { DELIVERY_STATUS_LABEL } from './deliveryStatusLabels';
import './LogisticsPage.css';

// ============================================================
// LogisticsPage — Entregas del Dia
// Tabla paginada de entregas, filtrable por estado
// (pendiente / en ruta / completada).
// ============================================================

const PAGE_SIZE = 8;

export const LogisticsPage: FC = () => {
  // Fecha "hoy" tomada una sola vez del sistema; la funcion que
  // filtra por dia (getDeliveriesForDate) la recibe como parametro,
  // no la calcula ella misma.
  const [today] = useState(() => new Date());

  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const advanceDeliveryStatus = useDeliveriesStore((s) => s.advanceDeliveryStatus);

  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('all');

  const todayDeliveries = useMemo(
    () => getDeliveriesForDate(deliveries, today),
    [deliveries, today]
  );

  const filteredDeliveries = useMemo(
    () =>
      statusFilter === 'all'
        ? todayDeliveries
        : todayDeliveries.filter((d) => d.status === statusFilter),
    [todayDeliveries, statusFilter]
  );

  const { pageItems, currentPage, totalPages, totalItems, setPage } = usePagination(
    filteredDeliveries,
    PAGE_SIZE,
    statusFilter
  );

  const handlePrintRoute = () => {
    // Mock print action
    console.log('Imprimiendo hoja de ruta...');
  };

  const handleAdvanceStatus = (deliveryId: string) => {
    const result = advanceDeliveryStatus(deliveryId);

    if (result.success && result.newStatus) {
      const label: DeliveryStatus = result.newStatus;
      toast.success(`Entrega ${deliveryId} actualizada a "${DELIVERY_STATUS_LABEL[label]}".`);
      return;
    }

    const message =
      result.reason === 'terminal-status'
        ? 'Esa entrega ya esta completada; no se puede modificar.'
        : 'No se encontro la entrega.';
    toast.error(message);
  };

  return (
    <div className="logistics-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Logistica y Reparto</h2>
          <p className="page-header__subtitle">Entregas del dia, agrupadas por estado</p>
        </div>
        <div className="page-header__actions">
          <button className="logistics-header-btn" onClick={handlePrintRoute}>
            Imprimir Hoja de Ruta
          </button>
        </div>
      </header>

      <LogisticsKPIs deliveries={todayDeliveries} />

      <DeliveryFilters
        deliveries={todayDeliveries}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar la lista de entregas."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="logistics-page__table-container">
          <DeliveriesTable deliveries={pageItems} onAdvanceStatus={handleAdvanceStatus} />
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
