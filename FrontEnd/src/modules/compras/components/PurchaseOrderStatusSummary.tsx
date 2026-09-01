import { useMemo, type FC } from 'react';
import type { Currency, PurchaseOrderStatus, PurchaseOrdersAggregates } from '@/shared/types/purchaseOrder.types';
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_ORDER } from '../purchaseOrderLabels';

// ============================================================
// PurchaseOrderStatusSummary — resumen de OC por estado (O8), tambien
// funciona como filtro (click = togglear ese estado). Igual que el
// resumen de aging de Clientes Morosos: agrupa por estado SIN sumar
// entre monedas — si un estado tiene ordenes en ARS y en USD, muestra
// una linea por moneda, nunca un total combinado (mismo criterio que
// M5/C1 en clientes).
// ============================================================

interface PurchaseOrderStatusSummaryProps {
  aggregates: PurchaseOrdersAggregates | undefined;
  totalItems: number;
  activeStatus: PurchaseOrderStatus | '';
  onStatusChange: (status: PurchaseOrderStatus | '') => void;
}

function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
}

export const PurchaseOrderStatusSummary: FC<PurchaseOrderStatusSummaryProps> = ({
  aggregates,
  totalItems,
  activeStatus,
  onStatusChange,
}) => {
  // Agrupa las entradas de aggregates.byStatus (estado+moneda) por
  // estado, preservando cada moneda como linea aparte.
  const groupedByStatus = useMemo(() => {
    const map = new Map<PurchaseOrderStatus, { currency: Currency; count: number; total: number }[]>();
    for (const entry of aggregates?.byStatus ?? []) {
      if (entry.count === 0) continue;
      const list = map.get(entry.status) ?? [];
      list.push({ currency: entry.currency, count: entry.count, total: entry.total });
      map.set(entry.status, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.currency.localeCompare(b.currency));
    }
    return map;
  }, [aggregates]);

  return (
    <div className="compras-summary" role="group" aria-label="Resumen de ordenes de compra por estado">
      <button
        type="button"
        className={`compras-summary__card compras-summary__card--all${activeStatus === '' ? ' compras-summary__card--active' : ''}`}
        aria-pressed={activeStatus === ''}
        onClick={() => onStatusChange('')}
      >
        <span className="compras-summary__label">Todos los estados</span>
        <span className="compras-summary__value">{totalItems}</span>
        <span className="compras-summary__sublabel">ordenes</span>
      </button>
      {PURCHASE_ORDER_STATUS_ORDER.map((status) => {
        const entries = groupedByStatus.get(status) ?? [];
        return (
          <button
            key={status}
            type="button"
            className={`compras-summary__card${activeStatus === status ? ' compras-summary__card--active' : ''}`}
            aria-pressed={activeStatus === status}
            onClick={() => onStatusChange(status)}
          >
            <span className="compras-summary__label">{PURCHASE_ORDER_STATUS_LABEL[status]}</span>
            {entries.length === 0 ? (
              <span className="compras-summary__value">0</span>
            ) : (
              entries.map((entry) => (
                <span key={entry.currency} className="compras-summary__amount-line">
                  <span className="compras-summary__value">{formatCurrency(entry.total, entry.currency)}</span>
                  <span className="compras-summary__sublabel">
                    {entry.count} {entry.count === 1 ? 'orden' : 'ordenes'}
                  </span>
                </span>
              ))
            )}
          </button>
        );
      })}
    </div>
  );
};
