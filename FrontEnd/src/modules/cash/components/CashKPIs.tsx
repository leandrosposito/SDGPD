import { type FC } from 'react';
import type { CashAggregates } from '../api/cash.service';
import '../CashPage.css';

// ============================================================
// CashKPIs — Tanda 3b: recibe `aggregates`, ya calculados server-side
// (P3, DECISIONES_TECNICAS.md) — antes de esta tanda, `CashPage.tsx`
// mantenía saldos/totales a mano sobre `cashData`, sumando
// incrementalmente en cada alta. Puede venir `undefined` mientras
// `usePagedQuery` todavía no resolvió la primera carga.
// ============================================================

interface CashKPIsProps {
  aggregates: CashAggregates | undefined;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const CashKPIs: FC<CashKPIsProps> = ({ aggregates }) => {
  const initialBalance = aggregates?.initialBalance ?? 0;
  const totalIncome = aggregates?.totalIncome ?? 0;
  const totalExpense = aggregates?.totalExpense ?? 0;
  const currentBalance = aggregates?.currentBalance ?? 0;
  const expenseAnalysis = aggregates?.expenseAnalysis;

  return (
    <div className="cash-kpis">
      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Saldo Inicial</span>
        <span className="cash-kpi-card__value text-secondary">{formatCurrency(initialBalance)}</span>
      </div>

      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Ingresos</span>
        <span className="cash-kpi-card__value text-success">
          +{formatCurrency(totalIncome)}
        </span>
      </div>

      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Egresos</span>
        <span className="cash-kpi-card__value text-danger">
          -{formatCurrency(totalExpense)}
        </span>
      </div>

      <div className="cash-kpi-card cash-kpi-card--highlight">
        <span className="cash-kpi-card__label">Saldo Actual</span>
        <span className="cash-kpi-card__value">{formatCurrency(currentBalance)}</span>
      </div>

      {expenseAnalysis && (
        <div className="cash-expense-widget">
          <div className="cash-expense-widget__header">
            <span className="cash-expense-widget__title">Analisis de Gastos</span>
            <div className={`cash-expense-widget__trend ${expenseAnalysis.isNegativeTrend ? 'text-danger' : 'text-success'}`}>
              {expenseAnalysis.isNegativeTrend ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              )}
              <span className="cash-expense-widget__trend-text">
                +{expenseAnalysis.trendPercentage}% {expenseAnalysis.trendLabel}
              </span>
            </div>
          </div>

          <div className="cash-expense-widget__list">
            {expenseAnalysis.topCategories.map(cat => (
              <div key={cat.category} className="cash-expense-widget__item">
                <div className="cash-expense-widget__item-info">
                  <span className="cash-expense-widget__item-name">{cat.category}</span>
                  <span className="cash-expense-widget__item-amount">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="cash-expense-widget__bar-bg">
                  <div
                    className="cash-expense-widget__bar-fill"
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
