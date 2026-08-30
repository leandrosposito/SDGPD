import { type FC } from 'react';
import type { CashTransaction } from '@/shared/types/cash.types';
import { Table } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import '../CashPage.css';

interface CashTransactionsTableProps {
  transactions: CashTransaction[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const CashTransactionsTable: FC<CashTransactionsTableProps> = ({ transactions }) => {
  // Ordenar por hora (descendente para ver los mas recientes primero)
  const sortedTransactions = [...transactions].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="cash-transactions-table-wrapper">
      <Table
        data={sortedTransactions}
        keyExtractor={(t) => t.id}
        columns={[
          { 
            header: 'Hora', 
            accessor: (row) => <span className="font-mono text-xs text-secondary">{row.time}</span> 
          },
          { 
            header: 'Categoria', 
            accessor: (row) => {
              let label = '';
              let variant: 'success' | 'danger' | 'warning' | 'primary' | 'neutral' = 'neutral';
              
              switch(row.category) {
                case 'sale': label = 'Venta'; variant = 'success'; break;
                case 'collection': label = 'Cobranza'; variant = 'success'; break;
                case 'supplier': label = 'Proveedor'; variant = 'danger'; break;
                case 'expense': label = 'Gasto'; variant = 'danger'; break;
                case 'advance': label = 'Anticipo'; variant = 'warning'; break;
              }
              
              return <Badge label={label} variant={variant} />;
            }
          },
          { 
            header: 'Tipo', 
            accessor: (row) => (
              <div className={`cash-type-indicator ${row.type === 'income' ? 'text-success' : 'text-danger'}`}>
                {row.type === 'income' ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                )}
                <span style={{ marginLeft: '0.25rem' }}>{row.type === 'income' ? 'Ingreso' : 'Egreso'}</span>
              </div>
            )
          },
          { 
            header: 'Entidad', 
            accessor: (row) => (
              <span className="cash-entity">{row.entity || '-'}</span>
            )
          },
          { 
            header: 'Comprobante', 
            accessor: (row) => (
              row.linkedVoucher ? (
                <span className="cash-voucher">{row.linkedVoucher}</span>
              ) : (
                <span className="text-tertiary">-</span>
              )
            )
          },
          { 
            header: 'Descripcion', 
            accessor: 'description' 
          },
          { 
            header: 'Monto', 
            align: 'right', 
            accessor: (row) => (
              <span className={`font-bold ${row.type === 'income' ? 'text-success' : 'text-danger'}`}>
                {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
              </span>
            )
          },
        ]}
      />
    </div>
  );
};
