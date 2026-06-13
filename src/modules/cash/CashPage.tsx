import { type FC } from 'react';
import { CASH_MOCK_DATA } from '../../data/mock/cash.data';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import './CashPage.css';

// ============================================================
// CashPage — Caja (Flujo de caja diario)
// ============================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const CashPage: FC = () => {
  const incomes = CASH_MOCK_DATA.transactions.filter(t => t.type === 'income');
  const expenses = CASH_MOCK_DATA.transactions.filter(t => t.type === 'expense');

  return (
    <div className="cash-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Caja Diaria</h2>
          <p className="page-header__subtitle">Flujo de ingresos y egresos</p>
        </div>
        <button className="cash-page__btn-close">Cierre de Caja</button>
      </header>

      <div className="cash-page__summary">
        <div className="cash-card">
          <span className="cash-card__label">Saldo Inicial</span>
          <span className="cash-card__value text-secondary">{formatCurrency(CASH_MOCK_DATA.initialBalance)}</span>
        </div>
        <div className="cash-card">
          <span className="cash-card__label">Ingresos</span>
          <span className="cash-card__value text-success">+{formatCurrency(CASH_MOCK_DATA.totalIncome)}</span>
        </div>
        <div className="cash-card">
          <span className="cash-card__label">Egresos</span>
          <span className="cash-card__value text-danger">-{formatCurrency(CASH_MOCK_DATA.totalExpense)}</span>
        </div>
        <div className="cash-card cash-card--highlight">
          <span className="cash-card__label">Saldo Actual</span>
          <span className="cash-card__value">{formatCurrency(CASH_MOCK_DATA.currentBalance)}</span>
        </div>
      </div>

      <div className="cash-page__columns">
        <div className="cash-page__col">
          <h3 className="cash-page__col-title text-success">Ingresos</h3>
          <Table
            data={incomes}
            keyExtractor={(t) => t.id}
            columns={[
              { header: 'Hora', accessor: (row) => <span className="font-mono text-xs">{row.time}</span> },
              { header: 'Tipo', accessor: (row) => (
                <Badge
                  label={row.category === 'sale' ? 'Venta' : 'Cobranza'}
                  variant="success"
                />
              )},
              { header: 'Descripcion', accessor: 'description' },
              { header: 'Monto', align: 'right', accessor: (row) => <span className="text-success font-bold">+{formatCurrency(row.amount)}</span> },
            ]}
          />
        </div>

        <div className="cash-page__col">
          <h3 className="cash-page__col-title text-danger">Egresos</h3>
          <Table
            data={expenses}
            keyExtractor={(t) => t.id}
            columns={[
              { header: 'Hora', accessor: (row) => <span className="font-mono text-xs">{row.time}</span> },
              { header: 'Tipo', accessor: (row) => (
                <Badge
                  label={row.category === 'supplier' ? 'Proveedor' : 'Gasto'}
                  variant="danger"
                />
              )},
              { header: 'Descripcion', accessor: 'description' },
              { header: 'Monto', align: 'right', accessor: (row) => <span className="text-danger font-bold">-{formatCurrency(row.amount)}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
