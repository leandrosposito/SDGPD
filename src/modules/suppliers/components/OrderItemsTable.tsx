import { type FC } from 'react';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface OrderItemsTableProps {
  items: OrderItem[];
  onQuantityChange: (id: string, qty: number) => void;
  onPriceChange: (id: string, price: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const OrderItemsTable: FC<OrderItemsTableProps> = ({ items, onQuantityChange, onPriceChange }) => {
  return (
    <table className="po-items-table">
      <thead>
        <tr>
          <th>Producto</th>
          <th className="text-right" style={{ width: '6rem' }}>Cantidad</th>
          <th className="text-right" style={{ width: '8rem' }}>Precio U.</th>
          <th className="text-right" style={{ width: '8rem' }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={4} className="text-center text-tertiary" style={{ padding: 'var(--space-6)' }}>
              No hay productos cargados en esta orden.
            </td>
          </tr>
        ) : (
          items.map(item => (
            <tr key={item.id}>
              <td>
                <span className="font-medium">{item.name}</span>
              </td>
              <td className="text-right">
                <input 
                  type="number" 
                  className="po-financial-input" 
                  style={{ width: '4rem', textAlign: 'center' }}
                  value={item.quantity || ''} 
                  onChange={(e) => onQuantityChange(item.id, Number(e.target.value))}
                  min="1"
                />
              </td>
              <td className="text-right">
                <input 
                  type="number" 
                  className="po-financial-input" 
                  value={item.unitPrice || ''} 
                  onChange={(e) => onPriceChange(item.id, Number(e.target.value))}
                  min="0"
                  step="0.01"
                />
              </td>
              <td className="text-right font-medium">
                {formatCurrency(item.quantity * item.unitPrice)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};
