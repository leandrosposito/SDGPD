import { type FC } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import type { InventoryItem } from '@/shared/types/inventory.types';
import './InventoryModals.css';

// ============================================================
// StockAdjustmentModal — Adjust stock levels
// ============================================================

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
}

export const StockAdjustmentModal: FC<StockAdjustmentModalProps> = ({ isOpen, onClose, product }) => {
  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajuste de Stock"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onClose}>Confirmar Ajuste</button>
        </>
      }
    >
      <div className="stock-adjustment-info">
        <p className="stock-adjustment-product">{product.name} <span className="text-tertiary">({product.sku})</span></p>
        <div className="stock-adjustment-current">
          <span className="stock-adjustment-label">Stock Actual:</span>
          <span className="stock-adjustment-value">{product.stock}</span>
        </div>
      </div>

      <form className="inventory-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="adjustment-type" className="form-label">Tipo de Movimiento</label>
          <select id="adjustment-type" className="form-input">
            <option value="in">Ingreso (+)</option>
            <option value="out">Egreso (-)</option>
            <option value="adjust">Correccion (=)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="adjustment-qty" className="form-label">Cantidad</label>
          <input id="adjustment-qty" type="number" className="form-input" min="1" defaultValue="1" />
        </div>

        <div className="form-group">
          <label htmlFor="adjustment-notes" className="form-label">Motivo / Notas</label>
          <textarea id="adjustment-notes" className="form-input form-textarea" rows={3} placeholder="Ej: Mercaderia vencida, error de conteo..."></textarea>
        </div>
      </form>
    </Modal>
  );
};
