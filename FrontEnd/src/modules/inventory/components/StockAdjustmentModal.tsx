import { useEffect, useState, type FC } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import type { InventoryItem } from '@/shared/types/inventory.types';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { getStockForBranch } from '@/services/mock/products.service';
import './InventoryModals.css';

// ============================================================
// StockAdjustmentModal — Adjust stock levels
// No tiene ningun punto de montaje en el arbol de componentes hoy (no lo
// importa InventoryPage ni ninguna tab) — es codigo huerfano preexistente
// a esta tarea (ver DECISIONES_TECNICAS.md, R10: se deja como esta, solo
// se adapta al nuevo shape de InventoryItem para que compile). El stock
// que muestra ahora es el de la sucursal activa (E1), no un campo propio
// del producto.
// ============================================================

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
}

export const StockAdjustmentModal: FC<StockAdjustmentModalProps> = ({ isOpen, onClose, product }) => {
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !product || !activeBranchId) return;
    let cancelled = false;
    getStockForBranch(product.id, activeBranchId).then((record) => {
      if (!cancelled) setCurrentStock(record?.stock ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, product, activeBranchId]);

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
          <span className="stock-adjustment-value">{currentStock ?? '...'}</span>
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
