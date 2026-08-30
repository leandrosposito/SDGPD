import { useState, type FC } from 'react';
import type { KeyboardEvent } from 'react';
import { toast } from 'sonner';
import type { InventoryItem } from '@/shared/types/inventory.types';

// ============================================================
// OrderProductsSection — Core product search and table
// ============================================================

export interface OrderProductItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  quantity: number;
  price: number;
  discount: number;
  subtotal: number;
}

interface OrderProductsSectionProps {
  items: OrderProductItem[];
  onItemsChange: (items: OrderProductItem[]) => void;
  priceList: string;
  products: InventoryItem[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export const OrderProductsSection: FC<OrderProductsSectionProps> = ({
  items,
  onItemsChange,
  priceList,
  products
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Intercept Enter key for barcode scanners
    if (e.key === 'Enter') {
      e.preventDefault();
      const match = products.find(p =>
        p.sku.toLowerCase() === searchTerm.toLowerCase() ||
        p.barcode === searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (match) {
        // Adjust price mock based on price list
        const modifier = priceList === 'Mayorista' ? 0.9 : priceList === 'Distribuidor' ? 0.8 : 1;
        const price = match.price * modifier;

        const existingItemIndex = items.findIndex(i => i.sku === match.sku);
        if (existingItemIndex >= 0) {
          const newItems = [...items];
          newItems[existingItemIndex].quantity += 1;
          newItems[existingItemIndex].subtotal = (newItems[existingItemIndex].price - newItems[existingItemIndex].discount) * newItems[existingItemIndex].quantity;
          onItemsChange(newItems);
        } else {
          onItemsChange([...items, {
            id: match.id,
            sku: match.sku,
            name: match.name,
            stock: match.stock,
            quantity: 1,
            price: price,
            discount: 0,
            subtotal: price
          }]);
        }
        setSearchTerm('');
      } else {
        toast.error('Producto no encontrado');
      }
    }
  };

  const updateItem = (index: number, field: keyof OrderProductItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    // Recalculate subtotal
    newItems[index].subtotal = (newItems[index].price - newItems[index].discount) * newItems[index].quantity;
    onItemsChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onItemsChange(newItems);
  };

  return (
    <section className="co-section">
      <h3 className="co-section__title">3. Productos</h3>
      
      <div className="co-form-group co-form-group--search">
        <label className="co-label">Buscar por Nombre, SKU o Codigo de Barras</label>
        <div className="co-search-wrap">
          <svg className="co-search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className="co-input co-input--search"
            placeholder="Escanear codigo o escribir..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="co-table-wrapper">
        <table className="co-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th style={{ width: '8rem', textAlign: 'center' }}>Cant.</th>
              <th>Precio</th>
              <th style={{ width: '10rem', textAlign: 'center' }}>Desc. ($)</th>
              <th className="text-right">Subtotal</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const hasInsufficientStock = item.quantity > item.stock;
              return (
                <tr key={item.sku} className={hasInsufficientStock ? 'co-tr--error' : ''}>
                  <td>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-tertiary font-mono">{item.sku}</div>
                  </td>
                  <td>{item.stock}</td>
                  <td>
                    <input
                      type="number"
                      className="co-input co-input--sm"
                      value={item.quantity}
                      min="1"
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    />
                    {hasInsufficientStock && (
                      <div className="co-stock-alert mt-1 flex items-center gap-1 text-danger text-xs">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Insuficiente
                      </div>
                    )}
                  </td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>
                    <input
                      type="number"
                      className="co-input co-input--sm"
                      value={item.discount}
                      min="0"
                      onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="text-right font-medium">{formatCurrency(item.subtotal)}</td>
                  <td className="text-right">
                    <button className="co-btn-icon text-danger hover:bg-danger/10" onClick={() => removeItem(idx)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-tertiary">
                  No hay productos en el pedido. Busque un producto o escanee un codigo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
