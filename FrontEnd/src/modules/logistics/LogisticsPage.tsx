import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { useLiveQuery } from '@/shared/hooks/useLiveQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { DateRangeFilter } from '@/shared/components/ui/DateRangeFilter';
import { computeDateRangeForPreset, type DateRangeValue } from '@/shared/components/ui/dateRangePresets';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Delivery } from '@/shared/types/logistics.types';
import {
  getDeliveriesPage,
  exportDeliveries,
  transitionDelivery,
  type DeliveryQueryFilters,
} from './services/deliveries.service';
import { LogisticsKPIs } from './components/LogisticsKPIs';
import { DeliveryFilters, type DeliveryStatusFilter } from './components/DeliveryFilters';
import { DeliveriesTable } from './components/DeliveriesTable';
import { RegistrarEntregaModal } from './components/RegistrarEntregaModal';
import { ReprogramarModal } from './components/ReprogramarModal';
import { DeliveryHistoryModal } from './components/DeliveryHistoryModal';
import { DELIVERY_STATUS_LABEL } from './deliveryStatusLabels';
import './LogisticsPage.css';

// ============================================================
// LogisticsPage — Entregas del Dia
// Tabla paginada server-side de entregas (P1-P10, DECISIONES_TECNICAS.md),
// filtrable por estado. Los KPIs y los contadores del filtro salen de
// agregados calculados por el servicio, no del array de la pagina
// actual (P3).
//
// Tanda 8 (corrida completa, ADR-002/003): usa `useLiveQuery` en vez
// de `usePagedQuery` — el listado hace polling cada 30s (ADR-003),
// pidiendo la MISMA pagina paginada con los MISMOS filtros, nunca la
// lista completa. Las acciones de avanzar/registrar entrega/
// reprogramar pasan por la maquina de estados tipada de
// deliveryStatus.types.ts (ver DeliveriesTable, que decide que boton
// mostrar segun `allowedTransitions` — Tanda 9, ver el header de
// DeliveriesTable.tsx).
// ============================================================

const PRIORITY_LABEL: Record<Delivery['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const LogisticsPage: FC = () => {
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const session = useSessionStore((s) => s.session);
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const fullName = session?.fullName ?? 'Usuario';

  // Tanda 4 (corrida completa, A13): pagina, estado y rango de fecha en
  // la URL — unico listado de esta pagina, sin prefijo.
  const urlState = useUrlListState<never, 'preset' | 'from' | 'to' | 'status'>({
    filterKeys: ['preset', 'from', 'to', 'status'],
  });

  const statusFilter = (urlState.filters.status ?? 'all') as DeliveryStatusFilter;
  const setStatusFilter = (value: DeliveryStatusFilter) => urlState.setFilter('status', value === 'all' ? undefined : value);

  // Default 'today' (comportamiento historico, antes fijo a "hoy"
  // hardcodeado): sin preset en la URL, se interpreta 'today' — y como
  // ningun handlePresetChange corrio todavia para computar dateFrom/
  // dateTo reales (DateRangeFilter.tsx los computa recien al elegir un
  // preset), hay que calcularlos ahora mismo con la misma funcion, para
  // no perder el filtro "solo hoy" en el primer render.
  const dateRange: DateRangeValue = useMemo(() => {
    const preset = (urlState.filters.preset as DateRangeValue['preset'] | undefined) ?? 'today';
    if (urlState.filters.from || urlState.filters.to) {
      return { preset, dateFrom: urlState.filters.from, dateTo: urlState.filters.to };
    }
    if (preset === 'all' || preset === 'custom') {
      return { preset, dateFrom: undefined, dateTo: undefined };
    }
    return { preset, ...computeDateRangeForPreset(preset) };
  }, [urlState.filters.preset, urlState.filters.from, urlState.filters.to]);

  function setDateRange(next: DateRangeValue) {
    urlState.setFilters({
      preset: next.preset === 'today' ? undefined : next.preset,
      from: next.dateFrom,
      to: next.dateTo,
    });
  }

  const activeBranchName = session?.branches.find((b) => b.id === activeBranchId)?.name ?? '';

  // Memoizado: usePagedQuery/useLiveQuery comparan `filters` por
  // referencia para decidir si hay que volver a pagina 1 (P9) — solo
  // debe cambiar de referencia cuando de verdad cambia sucursal, rango
  // o estado.
  const filters: DeliveryQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      branchId: activeBranchId,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [empresaId, activeBranchId, dateRange, statusFilter]
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
  } = useLiveQuery(getDeliveriesPage, filters, {
    enabled: activeBranchId !== null,
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar la lista de entregas.');
  }, [error]);

  const handlePrintRoute = () => {
    // Mock print action
    console.log('Imprimiendo hoja de ruta...');
  };

  // ------------------------------------------------------------
  // Modales (Tanda 8): un solo delivery "seleccionado" a la vez,
  // discriminado por cual modal esta abierto.
  // ------------------------------------------------------------
  const [registrarTarget, setRegistrarTarget] = useState<Delivery | null>(null);
  const [reprogramarTarget, setReprogramarTarget] = useState<Delivery | null>(null);
  const [historialTarget, setHistorialTarget] = useState<Delivery | null>(null);

  const handleMarkInTransit = async (delivery: Delivery) => {
    // Idempotencia (ADR-010 seccion 4): esta accion no pasa por un
    // modal — el click ES la formacion de la intencion, la clave se
    // genera aca, una vez por click, nunca dentro del service.
    const idempotencyKey = crypto.randomUUID();
    const result = await transitionDelivery(empresaId ?? '', idempotencyKey, delivery.id, 'EN_TRANSITO', fullName);
    if (result.success && result.newStatus) {
      toast.success(`Entrega ${delivery.id} actualizada a "${DELIVERY_STATUS_LABEL[result.newStatus]}".`);
      // P10: la lista y los agregados son responsabilidad del servidor
      // (mock hoy); en vez de actualizar `deliveries`/`aggregates` a
      // mano en el cliente, se vuelve a pedir la pagina que se esta viendo.
      refetch();
      return;
    }
    toast.error('No se pudo marcar la entrega en ruta.');
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
              <DeliveriesTable
                deliveries={deliveries}
                onMarkInTransit={handleMarkInTransit}
                onRegisterDelivery={setRegistrarTarget}
                onReprogram={setReprogramarTarget}
                onShowHistory={setHistorialTarget}
              />
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

      <RegistrarEntregaModal
        isOpen={registrarTarget !== null}
        onClose={() => setRegistrarTarget(null)}
        delivery={registrarTarget}
        onRegistered={refetch}
      />
      <ReprogramarModal
        isOpen={reprogramarTarget !== null}
        onClose={() => setReprogramarTarget(null)}
        delivery={reprogramarTarget}
        onReprogrammed={refetch}
      />
      <DeliveryHistoryModal
        isOpen={historialTarget !== null}
        onClose={() => setHistorialTarget(null)}
        delivery={historialTarget}
      />
    </div>
  );
};
