import { type FC } from 'react';

// ============================================================
// OrderTotalsSection — Financial breakdown
// ============================================================

interface OrderTotalsSectionProps {
  subtotal: number;
  discount: number;
  taxRate: number; // e.g. 0.21
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const OrderTotalsSection: FC<OrderTotalsSectionProps> = ({ subtotal, discount, taxRate }) => {
  const tax = (subtotal - discount) * taxRate;
  const total = subtotal - discount + tax;

  return (
    <section className="co-section co-section--totals">
      <div className="co-totals">
        <div className="co-totals__row">
          <span className="co-totals__label">Subtotal</span>
          <span className="co-totals__value">{formatCurrency(subtotal)}</span>
        </div>
        <div className="co-totals__row text-success">
          <span className="co-totals__label">Descuento General</span>
          <span className="co-totals__value">-{formatCurrency(discount)}</span>
        </div>
        <div className="co-totals__row">
          <span className="co-totals__label">IVA (21%)</span>
          <span className="co-totals__value">{formatCurrency(tax)}</span>
        </div>
        <div className="co-totals__row co-totals__row--grand">
          <span className="co-totals__label">TOTAL</span>
          <span className="co-totals__value">{formatCurrency(total)}</span>
        </div>
      </div>
    </section>
  );
};
