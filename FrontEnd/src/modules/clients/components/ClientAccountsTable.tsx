import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Table } from '@/shared/components/ui/Table';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { DateRangeFilter } from '@/shared/components/ui/DateRangeFilter';
import { defaultDateRangeValue, type DateRangeValue } from '@/shared/components/ui/dateRangePresets';
import { ExportButton, type ExportColumn } from '@/shared/components/ui/ExportButton';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import type { ClientAccount } from '@/shared/types/client.types';
import {
  getClientAccountsPage,
  exportClientAccounts,
  type ClientAccountsQueryFilters,
} from '@/modules/clients/api/clients.service';

// ============================================================
// ClientAccountsTable — Cuentas Corrientes, paginada server-side
// (M7/3.5, DECISIONES_TECNICAS.md). Reemplaza la <table> HTML propia
// sin paginar: se autoconsulta con usePagedQuery + clients.service
// #getClientAccountsPage, con busqueda por nombre/CUIT (M6, con
// debounce ya aplicado por el llamador — ver ClientsPage.tsx). Zona/
// vendedor/estado del filtro superior siguen aplicando solo al
// Directorio (fuera de alcance de esta tarea): no se agregaron al
// contrato paginado.
//
// Rango de fecha (tarea transversal) — Opcion A (DECISIONES_TECNICAS.md):
// filtro de EXISTENCIA (clientes con al menos una transaccion en el
// rango), nunca recalcula totalDebit/totalCredit/currentBalance de la
// fila. Default 'all': este listado hoy no filtraba por fecha.
// ============================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

interface ClientAccountsTableProps {
  search: string;
}

export const ClientAccountsTable: FC<ClientAccountsTableProps> = ({ search }) => {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRangeValue('all'));
  const filters: ClientAccountsQueryFilters = useMemo(
    () => ({ search, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }),
    [search, dateRange]
  );

  const {
    items: clients,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
  } = usePagedQuery(getClientAccountsPage, filters);

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de cuentas corrientes.');
  }, [error]);

  // Exportar (tarea transversal): mismos filtros vigentes (busqueda +
  // rango de fecha) via exportClientAccounts, que reusa el mismo
  // filtro+orden que getClientAccountsPage.
  const exportColumns: ExportColumn<ClientAccount>[] = [
    { header: 'Cliente', accessor: (c) => c.clientName },
    { header: 'CUIT', accessor: (c) => c.cuit },
    { header: 'Zona', accessor: (c) => c.zone },
    { header: 'Vendedor', accessor: (c) => c.sellerName },
    { header: 'Limite de Credito', accessor: (c) => c.creditLimit },
    { header: 'Debe', accessor: (c) => c.totalDebit },
    { header: 'Haber', accessor: (c) => c.totalCredit },
    { header: 'Saldo', accessor: (c) => c.currentBalance },
    { header: 'Dias de Mora', accessor: (c) => c.daysOverdue },
    { header: 'Estado', accessor: (c) => (c.currentBalance > 0 ? 'Con Deuda' : 'Al dia') },
  ];

  const toolbar = (
    <div className="client-list-toolbar">
      <DateRangeFilter idPrefix="client-accounts" value={dateRange} onChange={setDateRange} />
      <ExportButton
        fileNamePrefix="cuentas-corrientes"
        columns={exportColumns}
        fetchRows={() => exportClientAccounts(filters)}
      />
    </div>
  );

  if (isLoading) {
    return (
      <>
        {toolbar}
        <SkeletonTable rows={8} cols={7} />
      </>
    );
  }

  return (
    <>
      {toolbar}
      <ErrorBoundary
        fallbackTitle="No se pudo mostrar las cuentas corrientes."
        fallbackMessage="Recarga la pagina para intentar de nuevo."
      >
      <div className="client-table-wrapper-container">
        <FetchingOverlay isFetching={isFetching}>
          <div className="client-table-wrapper">
            <Table
              data={clients}
              keyExtractor={(client) => client.id}
              emptyMessage="No se encontraron cuentas corrientes."
              rowClassName={(client) => (client.currentBalance > client.creditLimit ? 'client-tr--danger' : '')}
              columns={[
                {
                  header: 'Cliente',
                  accessor: (client) => (
                    <>
                      <div className="font-medium text-primary">{client.clientName}</div>
                      {client.daysOverdue > 0 && (
                        <div className="text-xs text-danger flex items-center gap-1 mt-1">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {client.daysOverdue} dias de mora
                        </div>
                      )}
                    </>
                  ),
                },
                {
                  header: 'Limite de Credito',
                  align: 'right',
                  accessor: (client) => <span className="text-tertiary">{formatCurrency(client.creditLimit)}</span>,
                },
                {
                  header: 'Debe',
                  align: 'right',
                  accessor: (client) => <span className="text-danger font-medium">{formatCurrency(client.totalDebit)}</span>,
                },
                {
                  header: 'Haber',
                  align: 'right',
                  accessor: (client) => <span className="text-success font-medium">{formatCurrency(client.totalCredit)}</span>,
                },
                {
                  header: 'Saldo',
                  align: 'right',
                  accessor: (client) => (
                    <>
                      <span className="font-bold">{formatCurrency(client.currentBalance)}</span>
                      {client.currentBalance > client.creditLimit && (
                        <div className="text-xs text-danger mt-1">Limite Excedido</div>
                      )}
                    </>
                  ),
                },
                {
                  header: 'Estado',
                  align: 'center',
                  accessor: (client) => {
                    const hasDebt = client.currentBalance > 0;
                    return (
                      <span className={`client-badge ${hasDebt ? 'client-badge--warning' : 'client-badge--success'}`}>
                        {hasDebt ? 'Con Deuda' : 'Al dia'}
                      </span>
                    );
                  },
                },
                {
                  header: 'Acciones',
                  align: 'right',
                  accessor: (client) => (
                    <div className="client-actions-row">
                      <button className="client-btn-icon client-btn-icon--primary" title="Registrar Pago">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button className="client-btn-icon" title="Ver Historial">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {client.daysOverdue > 0 && (
                        <button className="client-btn-icon client-btn-icon--danger" title="Reclamar Deuda (WhatsApp)">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ),
                },
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
      </div>
      </ErrorBoundary>
    </>
  );
};
