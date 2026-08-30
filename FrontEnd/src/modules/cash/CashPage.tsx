import { useState, type FC } from 'react';
import { CASH_MOCK_DATA } from '@/data/mock/cash.data';
import type { CashTransaction } from '@/shared/types/cash.types';
import { CashKPIs } from './components/CashKPIs';
import { CashTransactionsTable } from './components/CashTransactionsTable';
import { NewTransactionModal } from './components/NewTransactionModal';
import './CashPage.css';

// ============================================================
// CashPage — Caja (Flujo de caja diario)
// ============================================================

export const CashPage: FC = () => {
  const [cashData, setCashData] = useState(CASH_MOCK_DATA);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveTransaction = (data: any) => {
    const newTx: CashTransaction = {
      id: `ctx-new-${Date.now()}`,
      time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...data
    };

    setCashData(prev => {
      // Recalculate balances
      const isIncome = newTx.type === 'income';
      const newTotalIncome = prev.totalIncome + (isIncome ? newTx.amount : 0);
      const newTotalExpense = prev.totalExpense + (!isIncome ? newTx.amount : 0);
      const newCurrentBalance = prev.initialBalance + newTotalIncome - newTotalExpense;

      return {
        ...prev,
        totalIncome: newTotalIncome,
        totalExpense: newTotalExpense,
        currentBalance: newCurrentBalance,
        transactions: [newTx, ...prev.transactions]
      };
    });

    setIsModalOpen(false);
  };

  return (
    <div className="cash-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Caja Diaria</h2>
          <p className="page-header__subtitle">Flujo de ingresos y egresos contables</p>
        </div>
        <div className="page-header__actions">
          <button className="client-modal-btn client-modal-btn--outline" style={{ marginRight: '0.5rem' }}>
            Cierre de Caja
          </button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={() => setIsModalOpen(true)}>
            + Nuevo Movimiento
          </button>
        </div>
      </header>

      <CashKPIs cashData={cashData} />

      <div className="cash-page__table-container">
        <h3 className="cash-page__table-title">Libro Diario (Movimientos Unificados)</h3>
        <CashTransactionsTable transactions={cashData.transactions} />
      </div>

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};
