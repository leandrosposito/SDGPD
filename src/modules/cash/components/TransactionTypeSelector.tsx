import type { FC } from 'react';
import type { TransactionType } from '../../../types/cash.types';
import './CashTransactionModal.css';

interface TransactionTypeSelectorProps {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}

const IconTrendingUp: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

const IconTrendingDown: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
    <polyline points="17 18 23 18 23 12"></polyline>
  </svg>
);

export const TransactionTypeSelector: FC<TransactionTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="tx-type-selector">
      <button 
        className={`tx-type-btn ${value === 'income' ? 'active income' : ''}`}
        onClick={() => onChange('income')}
        type="button"
      >
        <IconTrendingUp />
        Ingreso
      </button>
      <button 
        className={`tx-type-btn ${value === 'expense' ? 'active expense' : ''}`}
        onClick={() => onChange('expense')}
        type="button"
      >
        <IconTrendingDown />
        Egreso
      </button>
    </div>
  );
};
