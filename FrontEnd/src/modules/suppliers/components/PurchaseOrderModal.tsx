import { useState, useEffect, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../../shared/components/ui/Modal';
import { OrderItemsTable, type OrderItem } from './OrderItemsTable';
import { OrderFinancialSummary } from './OrderFinancialSummary';
import type { Supplier, SupplierPurchaseOrder } from '../../../shared/types/supplier.types';
import './SupplierModals.css';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onEmit?: (supplierId: string, order: Omit<SupplierPurchaseOrder, 'id'>) => Promise<Supplier>;
}

export const PurchaseOrderModal: FC<PurchaseOrderModalProps> = ({ isOpen, onClose, supplier, onEmit }) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Financial State
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [ivaPercentage, setIvaPercentage] = useState<number>(21);
  const [percepciones, setPercepciones] = useState<number>(0);

  // Sync initial supplier when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedSupplierId(supplier?.id || '');
      setPercepciones(1500); // Mock percepcion for testing
      setCurrency('ARS');
      
      // Inject mock products to show financial summary in action
      if (supplier && supplier.products && supplier.products.length > 0) {
        setItems(supplier.products.slice(0, 2).map(p => ({
          id: p.id,
          name: p.name,
          quantity: 10,
          unitPrice: p.cost
        })));
      } else {
        setItems([]);
      }
    }
  }, [isOpen, supplier]);

  const activeSupplier = selectedSupplierId 
    ? (supplier?.id === selectedSupplierId ? supplier : null) // Mock lookup
    : supplier;

  const suggestions = activeSupplier?.products || [];

  const handleAddSuggestion = (prod: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === prod.id);
      if (existing) {
        return prev.map(i => i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: prod.id, name: prod.name, quantity: 1, unitPrice: prod.cost }];
    });
  };

  const handleQuantityChange = (id: string, qty: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const handlePriceChange = (id: string, price: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, unitPrice: price } : i));
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

  const handleEmit = async () => {
    if (!activeSupplier || !onEmit) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      const ivaAmount = subtotal * (ivaPercentage / 100);
      const amount = subtotal + ivaAmount + percepciones;
      await onEmit(activeSupplier.id, {
        date: new Date().toISOString(),
        description: `Orden de compra (${items.length} producto${items.length === 1 ? '' : 's'})`,
        amount,
        status: 'pending',
      });
      toast.success('Orden de compra emitida correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo emitir la orden de compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Orden de Compra"
      size="xl"
      footer={
        <div className="modal-footer">
          <button className="client-modal-btn client-modal-btn--outline" onClick={onClose} disabled={isSubmitting}>Cancelar</button>
          <button className="client-modal-btn client-modal-btn--outline" onClick={onClose} disabled={isSubmitting}>Guardar Borrador</button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={handleEmit} disabled={isSubmitting}>
            {isSubmitting ? 'Emitiendo...' : 'Emitir Orden de Compra'}
          </button>
        </div>
      }
    >
      <div className="purchase-order-layout">
        <div className="po-header-grid">
          <div className="client-form-group">
            <label className="client-form-label">Proveedor</label>
            <select 
              className="client-form-select" 
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="" disabled>Seleccionar proveedor...</option>
              {supplier && <option value={supplier.id}>{supplier.name}</option>}
            </select>
          </div>
          <div className="client-form-group">
            <label className="client-form-label">Fecha de Emision</label>
            <input type="date" className="client-form-input" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="client-form-group">
            <label className="client-form-label">Moneda</label>
            <select 
              className="client-form-select" 
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
            >
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dolares (USD)</option>
            </select>
          </div>
        </div>

        <div className="po-search-bar">
          <div className="client-form-group" style={{ flex: 1 }}>
            <label className="client-form-label">Buscar producto por nombre o SKU</label>
            <div className="suppliers-filters__search" style={{ width: '100%' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="suppliers-filters__search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" className="suppliers-filters__input suppliers-filters__input--search" placeholder="Ej: Aceite Girasol..." />
            </div>
          </div>
          <a className="po-history-link" title="Ver historial">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Ver historico de compras a este proveedor
          </a>
        </div>

        <OrderItemsTable 
          items={items}
          onQuantityChange={handleQuantityChange}
          onPriceChange={handlePriceChange}
        />

        <OrderFinancialSummary 
          subtotal={subtotal}
          ivaPercentage={ivaPercentage}
          percepciones={percepciones}
          onIvaChange={setIvaPercentage}
          onPercepcionesChange={setPercepciones}
        />

        {suggestions.length > 0 && (
          <div className="purchase-order-suggestions">
            <h4 className="suggestions-title">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Sugerencias Inteligentes (Historial)
            </h4>
            <div className="suggestions-grid">
              {suggestions.slice(0, 4).map(prod => (
                <button key={prod.id} className="suggestion-chip" title="Agregar a la orden" onClick={() => handleAddSuggestion(prod)}>
                  <span className="suggestion-chip__name text-truncate" title={prod.name}>{prod.name}</span>
                  <span className="suggestion-chip__sku">{prod.sku}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="suggestion-chip__add">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
