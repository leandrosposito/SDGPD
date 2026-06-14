import { type FC } from 'react';
import type { ClientAccount } from '../../../types/client.types';

interface ClientAccountsTableProps {
  clients: ClientAccount[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const ClientAccountsTable: FC<ClientAccountsTableProps> = ({ clients }) => {
  return (
    <div className="client-table-wrapper">
      <table className="client-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th className="text-right">Limite de Credito</th>
            <th className="text-right">Debe</th>
            <th className="text-right">Haber</th>
            <th className="text-right">Saldo</th>
            <th className="text-center">Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => {
            const isExceeded = client.currentBalance > client.creditLimit;
            const hasDebt = client.currentBalance > 0;
            const isOverdue = client.daysOverdue > 0;

            return (
              <tr key={client.id} className={isExceeded ? 'client-tr--danger' : ''}>
                <td>
                  <div className="font-medium text-primary">{client.clientName}</div>
                  {isOverdue && (
                    <div className="text-xs text-danger flex items-center gap-1 mt-1">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {client.daysOverdue} dias de mora
                    </div>
                  )}
                </td>
                <td className="text-right text-tertiary">{formatCurrency(client.creditLimit)}</td>
                <td className="text-right text-danger font-medium">{formatCurrency(client.totalDebit)}</td>
                <td className="text-right text-success font-medium">{formatCurrency(client.totalCredit)}</td>
                <td className="text-right font-bold">
                  {formatCurrency(client.currentBalance)}
                  {isExceeded && (
                    <div className="text-xs text-danger mt-1">Limite Excedido</div>
                  )}
                </td>
                <td className="text-center">
                  <span className={`client-badge ${hasDebt ? 'client-badge--warning' : 'client-badge--success'}`}>
                    {hasDebt ? 'Con Deuda' : 'Al dia'}
                  </span>
                </td>
                <td className="text-right">
                  <div className="client-actions-row">
                    <button className="client-btn-icon client-btn-icon--primary" title="Registrar Pago">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className="client-btn-icon" title="Ver Historial">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {isOverdue && (
                      <button className="client-btn-icon client-btn-icon--danger" title="Reclamar Deuda (WhatsApp)">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-tertiary" style={{ padding: '3rem' }}>
                No se encontraron cuentas corrientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
