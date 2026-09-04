import type { FC } from 'react';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import type { Supplier } from '@/shared/types/supplier.types';
import type { SuppliersSortField } from '../api/suppliers.service';
import type { PageSort } from '@/shared/types/pagination.types';

interface SuppliersTableProps {
  suppliers: Supplier[];
  onRowClick: (supplier: Supplier) => void;
  sort: PageSort<SuppliersSortField> | undefined;
  onSortChange: (sort: PageSort<SuppliersSortField> | undefined) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

// Orden ahora server-side (Tanda 1, suppliers.service.ts#fetchSuppliersPage
// via httpClient): esta tabla ya no ordena en memoria, solo pinta el
// header clickeable y delega en `onSortChange` (usePagedQuery#setSort).
export const SuppliersTable: FC<SuppliersTableProps> = ({ suppliers, onRowClick, sort, onSortChange }) => {
  const sortField = sort?.field ?? 'name';
  const sortDesc = sort?.direction === 'desc';

  const handleSort = (field: SuppliersSortField) => {
    if (sortField === field) {
      onSortChange({ field, direction: sortDesc ? 'asc' : 'desc' });
    } else {
      onSortChange({ field, direction: 'asc' });
    }
  };

  const renderSortIcon = (field: SuppliersSortField) => {
    if (sortField !== field) {
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-tertiary opacity-50 ml-1">
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return sortDesc ? (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent ml-1">
        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent ml-1">
        <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  const renderSortableHeader = (label: string, field: SuppliersSortField) => (
    <button className="suppliers-table__sort-btn" onClick={() => handleSort(field)}>
      {label}
      {renderSortIcon(field)}
    </button>
  );

  return (
    <Table
      data={suppliers}
      keyExtractor={(s) => s.id}
      columns={[
        {
          header: renderSortableHeader('Razon Social', 'name'),
          accessor: (s) => (
            <div className="suppliers-page__name-cell">
              <span className="font-medium text-truncate" style={{ maxWidth: '12rem' }} title={s.name}>
                {s.name}
              </span>
              {s.hasOverdueDebt && (
                <Badge label="Deuda Vencida" variant="danger" />
              )}
            </div>
          ),
        },
        { 
          header: renderSortableHeader('Rubro', 'category'),
          accessor: 'category' 
        },
        { 
          header: renderSortableHeader('CUIT', 'cuit'),
          accessor: (s) => <span className="font-mono text-sm">{s.cuit}</span> 
        },
        { 
          header: 'Telefono',
          accessor: (s) => (
            <div className="suppliers-table__phone-cell">
              <span className="text-tertiary">{s.phone}</span>
              <a href={`https://wa.me/${s.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="suppliers-table__wa-btn" title="Contactar por WhatsApp">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.38c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </a>
            </div>
          )
        },
        {
          header: 'Pedidos en Curso',
          align: 'center',
          accessor: (s) => (
            s.pendingOrdersCount > 0 
              ? <Badge label={`${s.pendingOrdersCount} Pendientes`} variant="warning" />
              : <span className="text-tertiary text-sm">-</span>
          )
        },
        {
          header: 'Vencimientos',
          align: 'center',
          accessor: (s) => {
            if (s.hasOverdueDebt) return <Badge label="Deuda Vencida" variant="danger" />;
            if (s.daysUntilExpiration !== null) return <Badge label={`Vence en ${s.daysUntilExpiration} dias`} variant="info" />;
            return <span className="text-tertiary text-sm">Al dia</span>;
          }
        },
        {
          header: renderSortableHeader('Saldo Actual', 'currentBalance'),
          align: 'right',
          accessor: (s) => (
            <span className={s.currentBalance > 0 ? 'text-danger font-bold' : ''}>
              {formatCurrency(s.currentBalance)}
            </span>
          ),
        },
        {
          header: '',
          align: 'right',
          accessor: (s) => (
            <button
              className="suppliers-table__row-btn"
              onClick={() => onRowClick(s)}
              aria-label={`Ver detalle de ${s.name}`}
            >
              Ver detalle
            </button>
          ),
        },
      ]}
    />
  );
};
