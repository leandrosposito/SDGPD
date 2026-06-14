import { type FC } from 'react';

interface OrderFinancialSummaryProps {
  subtotal: number;
  ivaPercentage: number;
  percepciones: number;
  onIvaChange: (percentage: number) => void;
  onPercepcionesChange: (amount: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const OrderFinancialSummary: FC<OrderFinancialSummaryProps> = ({
  subtotal,
  ivaPercentage,
  percepciones,
  onIvaChange,
  onPercepcionesChange
}) => {
  const ivaAmount = subtotal * (ivaPercentage / 100);
  const total = subtotal + ivaAmount + percepciones;

  return (
    <div className="po-financial-summary">
      <div className="po-financial-box">
        <div className="po-financial-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="po-financial-row" style={{ marginTop: '0.5rem' }}>
          <span>IVA</span>
          <select 
            className="po-financial-input" 
            style={{ width: '4.5rem', textAlign: 'center', margin: '0 0.5rem' }}
            value={ivaPercentage}
            onChange={(e) => onIvaChange(Number(e.target.value))}
          >
            <option value={21}>21%</option>
            <option value={10.5}>10.5%</option>
            <option value={0}>0%</option>
          </select>
          <span>{formatCurrency(ivaAmount)}</span>
        </div>

        <div className="po-financial-row" style={{ marginTop: '0.5rem' }}>
          <span>Percepciones / Otros</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: 'var(--font-size-xs)' }}>$</span>
            <input 
              type="number" 
              className="po-financial-input" 
              value={percepciones || ''} 
              onChange={(e) => onPercepcionesChange(Number(e.target.value))}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="po-financial-row po-financial-row--total">
          <span>Total Final</span>
          <span className="text-accent">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
};
