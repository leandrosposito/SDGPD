import { type FC } from 'react';
import type { CashRegister } from '@/shared/types/cash.types';
import '../CashPage.css';

interface CashKPIsProps {
  cashData: CashRegister;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export const CashKPIs: FC<CashKPIsProps> = ({ cashData }) => {
  const { expenseAnalysis } = cashData;

  return (
    <div className="cash-kpis">
      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Saldo Inicial</span>
        <span className="cash-kpi-card__value text-secondary">{formatCurrency(cashData.initialBalance)}</span>
      </div>
      
      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Ingresos</span>
        <span className="cash-kpi-card__value text-success">
          +{formatCurrency(cashData.totalIncome)}
        </span>
      </div>

      <div className="cash-kpi-card">
        <span className="cash-kpi-card__label">Egresos</span>
        <span className="cash-kpi-card__value text-danger">
          -{formatCurrency(cashData.totalExpense)}
        </span>
      </div>

      <div className="cash-kpi-card cash-kpi-card--highlight">
        <span className="cash-kpi-card__label">Saldo Actual</span>
        <span className="cash-kpi-card__value">{formatCurrency(cashData.currentBalance)}</span>
      </div>

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
    </div>
  );
};
