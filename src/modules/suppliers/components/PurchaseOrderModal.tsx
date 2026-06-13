import { type FC } from 'react';
import { Modal } from '../../../components/ui/Modal';
import type { Supplier } from '../../../types/supplier.types';
import './SupplierModals.css';

// ============================================================
// PurchaseOrderModal — Draft a new purchase order
// ============================================================

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}

export const PurchaseOrderModal: FC<PurchaseOrderModalProps> = ({ isOpen, onClose, supplier }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Orden de Compra"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onClose}>Generar Borrador</button>
        </>
      }
    >
      <form className="supplier-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="oc-supplier" className="form-label">Proveedor</label>
          <select id="oc-supplier" className="form-input" defaultValue={supplier?.id || ''}>
            <option value="" disabled>Seleccionar proveedor...</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="oc-description" className="form-label">Descripcion</label>
          <input id="oc-description" type="text" className="form-input" placeholder="Ej: Reposicion mensual aceites" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="oc-date" className="form-label">Fecha de Emision</label>
            <input id="oc-date" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label htmlFor="oc-delivery" className="form-label">Fecha de Entrega Estimada</label>
            <input id="oc-delivery" type="date" className="form-input" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="oc-amount" className="form-label">Monto Estimado (ARS)</label>
          <input id="oc-amount" type="number" className="form-input" placeholder="0" min="0" />
        </div>

        <div className="form-group">
          <label htmlFor="oc-notes" className="form-label">Notas Adicionales</label>
          <textarea id="oc-notes" className="form-input form-textarea" rows={3} placeholder="Observaciones, condiciones especiales..."></textarea>
        </div>
      </form>
    </Modal>
  );
};
