import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { DateRangeFilter } from '@/shared/components/ui/DateRangeFilter';
import { defaultDateRangeValue, type DateRangeValue } from '@/shared/components/ui/dateRangePresets';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { getOverdueClientsPage, exportOverdueClients } from '@/modules/clients/api/clients.service';
import type {
  AgingBucket,
  AgingBucketAggregate,
  Currency,
  OverdueClientRow,
  OverdueClientsQueryFilters,
} from '@/shared/types/client.types';
import { AGING_BUCKET_LABEL, AGING_BUCKET_VARIANT, AGING_BUCKET_ORDER } from '../agingLabels';

// ============================================================
// ClientOverdueTable — "Clientes Morosos" (M7, DECISIONES_TECNICAS.md).
// Tab nueva, de solo cobranzas: clientes con al menos una factura
// vencida y abierta despues de la imputacion FIFO (M2). Se autoconsulta
// con usePagedQuery + clients.service#getOverdueClientsPage — el
// resumen de aging y los contadores por tramo salen de `aggregates`
// (M4/P3), nunca se calculan sobre `items` (la pagina actual).
//
// Rango de fecha (tarea transversal, DECISIONES_TECNICAS.md): filtra
// por `dueDate` de las facturas vencidas — dimension ADICIONAL e
// independiente del tramo de aging (bucketFilter), que sigue siendo un
// calculo relativo a HOY sin tocar. Default 'all': este listado hoy no
// filtraba por fecha.
// ============================================================

type BucketFilter = AgingBucket | 'all';

// El parametro currency (C1) es obligatorio a proposito: formatear sin
// especificar la moneda del importe es exactamente el bug que se
// arreglo en el servicio (mostrar un numero como si supieras que
// moneda es, sin mirarla).
function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
}

interface ClientOverdueTableProps {
  search: string;
}

export const ClientOverdueTable: FC<ClientOverdueTableProps> = ({ search }) => {
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRangeValue('all'));

  const filters: OverdueClientsQueryFilters = useMemo(
    () => ({
      search,
      bucket: bucketFilter === 'all' ? undefined : bucketFilter,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [search, bucketFilter, dateRange]
  );

  const {
    items: rows,
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
  } = usePagedQuery(getOverdueClientsPage, filters);

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de clientes morosos.');
  }, [error]);

  // Un tramo puede tener mas de una entrada si hay mas de una moneda
  // con deuda vencida en el (C1/M5): se agrupan por tramo SIN sumar
  // entre monedas (eso era el mismo bug que en el servicio, solo que
  // en la vista) — cada tramo puede mostrar varias lineas, una por
  // moneda presente, ordenadas de forma deterministica.
  const bucketAggregatesByBucket = useMemo(() => {
    const map = new Map<AgingBucket, AgingBucketAggregate[]>();
    for (const agg of aggregates?.byBucket ?? []) {
      if (agg.clientCount === 0) continue; // no mostrar monedas sin deuda en ese tramo
      const list = map.get(agg.bucket) ?? [];
      list.push(agg);
      map.set(agg.bucket, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.currency.localeCompare(b.currency));
    }
    return map;
  }, [aggregates]);

  // Exportar (tarea transversal): mismos filtros vigentes (busqueda +
  // tramo + rango de fecha) via exportOverdueClients, que reusa el
  // mismo filtro+orden que getOverdueClientsPage.
  const exportColumns: ExportColumn<OverdueClientRow>[] = [
    { header: 'Cliente', accessor: (row) => row.clientName },
    { header: 'CUIT', accessor: (row) => row.cuit },
    {
      header: 'Deuda Vencida',
      accessor: (row) => row.overdueByCurrency.map((e) => formatCurrency(e.amount, e.currency)).join(' / '),
    },
    { header: 'Dias (mas antiguo)', accessor: (row) => row.oldestOverdueDays },
    { header: 'Tramo mas antiguo', accessor: (row) => AGING_BUCKET_LABEL[row.oldestBucket] },
    { header: 'Limite de Credito', accessor: (row) => row.creditLimit },
    { header: 'Saldo Actual', accessor: (row) => row.currentBalance },
  ];

  return (
    <div className="client-overdue">
      <header className="client-overdue__header">
        <div className="client-overdue__title-group">
          <AlertTriangle className="client-overdue__icon" size={20} aria-hidden="true" />
          <div>
            <h3 className="client-overdue__title">Clientes Morosos</h3>
            <p className="client-overdue__subtitle">
              Clientes con al menos una factura vencida, despues de imputar pagos y ajustes
            </p>
          </div>
        </div>
        <span className="client-overdue__count" aria-live="polite">
          {totalItems} {totalItems === 1 ? 'cliente' : 'clientes'}
        </span>
      </header>

      <div className="client-aging-summary" role="group" aria-label="Resumen de deuda vencida por tramo de antiguedad">
        <button
          type="button"
          className={`client-aging-summary__card client-aging-summary__card--all${bucketFilter === 'all' ? ' client-aging-summary__card--active' : ''}`}
          aria-pressed={bucketFilter === 'all'}
          onClick={() => setBucketFilter('all')}
        >
          <span className="client-aging-summary__label">Todos los tramos</span>
          <span className="client-aging-summary__value">{totalItems}</span>
          <span className="client-aging-summary__sublabel">clientes morosos</span>
        </button>
        {AGING_BUCKET_ORDER.map((bucket) => {
          const bucketAggs = bucketAggregatesByBucket.get(bucket) ?? [];
          return (
            <button
              key={bucket}
              type="button"
              className={`client-aging-summary__card${bucketFilter === bucket ? ' client-aging-summary__card--active' : ''}`}
              aria-pressed={bucketFilter === bucket}
              onClick={() => setBucketFilter(bucket)}
            >
              <span className="client-aging-summary__label">{AGING_BUCKET_LABEL[bucket]}</span>
              {bucketAggs.length === 0 ? (
                <span className="client-aging-summary__value">{formatCurrency(0, 'ARS')}</span>
              ) : (
                <div className="client-aging-summary__amounts">
                  {bucketAggs.map((agg) => (
                    <span key={agg.currency} className="client-aging-summary__amount-line">
                      <span className="client-aging-summary__value">{formatCurrency(agg.totalOverdue, agg.currency)}</span>
                      <span className="client-aging-summary__sublabel">
                        {agg.clientCount} {agg.clientCount === 1 ? 'cliente' : 'clientes'}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="client-list-toolbar">
        <DateRangeFilter idPrefix="client-overdue" value={dateRange} onChange={setDateRange} label="Vencimiento" />
        <ExportButton
          fileNamePrefix="clientes-morosos"
          columns={exportColumns}
          fetchRows={() => exportOverdueClients(filters)}
        />
      </div>

      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el listado de clientes morosos."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
        <div className="client-table-wrapper-container">
          {isLoading ? (
            <SkeletonTable rows={8} cols={6} />
          ) : (
            <FetchingOverlay isFetching={isFetching}>
              <div className="client-table-wrapper">
                <Table
                  data={rows}
                  keyExtractor={(row) => row.clientId}
                  emptyMessage="No hay clientes con deuda vencida para esta busqueda."
                  rowClassName={(row) => (row.currentBalance > row.creditLimit ? 'client-tr--danger' : '')}
                  columns={[
                    { header: 'Cliente', accessor: 'clientName' },
                    {
                      header: 'CUIT',
                      accessor: (row) => <span className="font-mono text-xs text-tertiary">{row.cuit}</span>,
                    },
                    {
                      header: 'Deuda Vencida',
                      align: 'right',
                      // Una linea por moneda (C1): un cliente en mora en
                      // ARS y USD a la vez muestra los dos importes, nunca
                      // un total combinado.
                      accessor: (row) => (
                        <div className="client-overdue-amounts">
                          {row.overdueByCurrency.map((entry) => (
                            <span key={entry.currency} className="text-danger font-bold client-overdue-amounts__line">
                              {formatCurrency(entry.amount, entry.currency)}
                            </span>
                          ))}
                        </div>
                      ),
                    },
                    {
                      header: 'Dias (mas antiguo)',
                      align: 'right',
                      accessor: (row) => <span>{row.oldestOverdueDays}</span>,
                    },
                    {
                      header: 'Tramo mas antiguo',
                      align: 'center',
                      accessor: (row) => (
                        <Badge label={AGING_BUCKET_LABEL[row.oldestBucket]} variant={AGING_BUCKET_VARIANT[row.oldestBucket]} />
                      ),
                    },
                    {
                      header: 'Limite',
                      align: 'center',
                      accessor: (row) =>
                        row.currentBalance > row.creditLimit ? (
                          <span className="client-badge client-badge--danger">Excedido</span>
                        ) : null,
                    },
                  ]}
                />
              </div>
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
