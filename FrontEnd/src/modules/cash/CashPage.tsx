import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { CashKPIs } from './components/CashKPIs';
import { CashTransactionsTable } from './components/CashTransactionsTable';
import { NewTransactionModal } from './components/NewTransactionModal';
import {
  getCashTransactionsPage,
  createCashTransaction,
  type CashMovementsQueryFilters,
  type CashTransactionFormInput,
} from './api/cash.service';
import './CashPage.css';

// ============================================================
// CashPage — Caja (Flujo de caja diario), Tanda 3b de escalabilidad.
// Tercer módulo migrado a la capa api/ (segundo sin service previo,
// después de orders en Tanda 3a) — antes leía data/mock/cash.data.ts
// directo en un useState, y las mutaciones se perdían al desmontar
// (ítem 8 de PENDIENTES.md, ahora cerrado por completo).
//
// Sin filtro de sucursal a propósito (confirmado explícitamente antes
// de implementar, no asumido — la hipótesis inicial de la tarea era
// que Caja SÍ tenía sucursal): ni `CashTransaction` ni `CashRegister`
// tienen ningún campo de sucursal, y a diferencia de `orders` (que al
// menos usaba `activeBranchId` transitoriamente), acá no hay ninguna
// referencia a sucursal en todo el módulo.
// ============================================================

export const CashPage: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filters: CashMovementsQueryFilters = useMemo(() => ({ empresaId: empresaId ?? '' }), [empresaId]);

  const {
    items: transactions,
    aggregates,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery(getCashTransactionsPage, filters, { enabled: Boolean(empresaId) });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el movimiento de caja.');
  }, [error]);

  // P10 (DECISIONES_TECNICAS.md): tras crear un movimiento se vuelve a
  // pedir la página vigente al service (refetch), en vez de actualizar
  // `transactions`/saldos a mano en el cliente — antes de esta tanda,
  // CashPage.tsx recalculaba totalIncome/totalExpense/currentBalance
  // sumando incrementalmente sobre el estado anterior; ahora esos
  // agregados los recalcula el service sobre TODAS las transacciones
  // reales (P3), sin riesgo de desincronizarse.
  const handleSaveTransaction = async (data: CashTransactionFormInput) => {
    if (!empresaId) {
      toast.error('Todavia no hay una sesion activa.');
      return;
    }
    try {
      await createCashTransaction(empresaId, data);
      toast.success('Movimiento guardado con exito!');
      refetch();
      setIsModalOpen(false);
    } catch {
      toast.error('No se pudo guardar el movimiento.');
    }
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

      {!empresaId || isLoading ? (
        <LoadingState message="Cargando caja..." />
      ) : error ? (
        <ErrorState message="No se pudo cargar la caja." onRetry={refetch} />
      ) : (
        <>
          <CashKPIs aggregates={aggregates} />

          <div className="cash-page__table-container">
            <h3 className="cash-page__table-title">Libro Diario (Movimientos Unificados)</h3>
            <ErrorBoundary
              fallbackTitle="No se pudo mostrar el libro diario."
              fallbackMessage="Intenta de nuevo o volve al inicio."
            >
              <FetchingOverlay isFetching={isFetching}>
                <CashTransactionsTable transactions={transactions} />
              </FetchingOverlay>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </ErrorBoundary>
          </div>
        </>
      )}

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};
