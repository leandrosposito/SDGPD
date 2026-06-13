import React, { useState, type FC } from 'react';
import { CLIENTS_MOCK_DATA } from '../../data/mock/clients.data';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import './ClientsPage.css';

// ============================================================
// ClientsPage — Cuentas Corrientes (Clientes)
// ============================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const ClientsPage: FC = () => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  return (
    <div className="clients-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Cuentas Corrientes</h2>
          <p className="page-header__subtitle">Estado de cuenta y saldos de clientes</p>
        </div>
      </header>

      <div className="clients-page__content">
        <div className="table-container">
          <table className="table" aria-label="Tabla de cuentas corrientes">
            <thead>
              <tr>
                <th className="table__th">Cliente</th>
                <th className="table__th">Zona</th>
                <th className="table__th table__th--right">Debe</th>
                <th className="table__th table__th--right">Haber</th>
                <th className="table__th table__th--right">Saldo</th>
                <th className="table__th table__th--center">Estado</th>
                <th className="table__th"></th>
              </tr>
            </thead>
            <tbody>
              {CLIENTS_MOCK_DATA.map((client) => {
                const isExpanded = expandedRow === client.id;
                const hasDebt = client.currentBalance > 0;

                return (
                  <React.Fragment key={client.id}>
                    <tr
                      className={`table__row ${isExpanded ? 'table__row--expanded' : ''}`}
                      onClick={() => toggleRow(client.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="table__td font-medium">{client.clientName}</td>
                      <td className="table__td text-tertiary">{client.zone}</td>
                      <td className="table__td table__td--right text-danger">
                        {formatCurrency(client.totalDebit)}
                      </td>
                      <td className="table__td table__td--right text-success">
                        {formatCurrency(client.totalCredit)}
                      </td>
                      <td className="table__td table__td--right font-bold">
                        {formatCurrency(client.currentBalance)}
                      </td>
                      <td className="table__td table__td--center">
                        <Badge
                          label={hasDebt ? 'Con Deuda' : 'Al Dia'}
                          variant={hasDebt ? 'warning' : 'success'}
                        />
                      </td>
                      <td className="table__td table__td--center">
                        <span className="clients-page__expand-icon">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="clients-page__details-row">
                        <td colSpan={7} className="clients-page__details-cell">
                          <div className="clients-page__history">
                            <h4 className="clients-page__history-title">Historial Reciente</h4>
                            <Table
                              data={client.transactions}
                              keyExtractor={(t) => t.id}
                              columns={[
                                { header: 'Fecha', accessor: (t) => formatDate(t.date) },
                                { header: 'Tipo', accessor: (t) => (
                                  <Badge 
                                    label={t.type === 'invoice' ? 'Factura' : t.type === 'payment' ? 'Pago' : 'Ajuste'} 
                                    variant={t.type === 'invoice' ? 'danger' : t.type === 'payment' ? 'success' : 'neutral'} 
                                  />
                                )},
                                { header: 'Descripcion', accessor: 'description' },
                                { header: 'Debe', align: 'right', accessor: (t) => t.debit > 0 ? formatCurrency(t.debit) : '-' },
                                { header: 'Haber', align: 'right', accessor: (t) => t.credit > 0 ? formatCurrency(t.credit) : '-' },
                                { header: 'Saldo', align: 'right', accessor: (t) => formatCurrency(t.balance) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
