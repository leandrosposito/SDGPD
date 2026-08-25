import { type FC } from 'react';
import type { TopDebtor } from '../../../shared/types/analytics.types';
import { Badge } from '../../../shared/components/ui/Badge';
import './TopDebtorsTable.css';

// ============================================================
// TopDebtorsTable — Compact top debtors table
// ============================================================

interface TopDebtorsTableProps {
  data: TopDebtor[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const TopDebtorsTable: FC<TopDebtorsTableProps> = ({ data }) => {
  return (
    <div className="debtors-card">
      <div className="debtors-card__header">
        <h3 className="debtors-card__title">Top Deudores Activos</h3>
        <span className="debtors-card__count">{data.length}</span>
      </div>

      <div className="debtors-card__body">
        {data.length === 0 && (
          <p className="debtors-card__empty">Sin deudas registradas en el periodo.</p>
        )}
        {data.map((debtor, index) => (
          <div key={debtor.id} className="debtors-row">
            <div className="debtors-row__rank">{index + 1}</div>
            <div className="debtors-row__info">
              <span className="debtors-row__name">{debtor.clientName}</span>
              <span className="debtors-row__zone">{debtor.zone}</span>
            </div>
            <div className="debtors-row__amounts">
              <span className="debtors-row__balance">{formatCurrency(debtor.balance)}</span>
              {debtor.isOverdue && (
                <Badge label="Vencida" variant="danger" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
