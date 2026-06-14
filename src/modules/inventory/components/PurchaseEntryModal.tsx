import { type FC } from 'react';
import { Modal } from '../../../components/ui/Modal';
import './InventoryModals.css';

// ============================================================
// PurchaseEntryModal — Registrar ingreso de stock por compra
// ============================================================

interface PurchaseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseEntryModal: FC<PurchaseEntryModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Ingreso por Compra"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onClose}>Confirmar Ingreso</button>
        </>
      }
    >
      <form className="inventory-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="pe-supplier" className="form-label">Proveedor</label>
          <select id="pe-supplier" className="form-input" defaultValue="">
            <option value="" disabled>Seleccione proveedor...</option>
            <option value="1">Distribuidora Norte</option>
            <option value="2">Bodegas del Sur</option>
            <option value="3">AgroAlimentos S.A.</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pe-product" className="form-label">Producto (Escanear o Buscar)</label>
          <input 
            id="pe-product" 
            type="text" 
            className="form-input" 
            placeholder="Ej: 7791234567890 o 'Cerveza'" 
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pe-qty" className="form-label">Cantidad Recibida</label>
            <input id="pe-qty" type="number" className="form-input" placeholder="0" min="1" />
          </div>
          <div className="form-group">
            <label htmlFor="pe-cost" className="form-label">Costo Unitario (ARS)</label>
            <input id="pe-cost" type="number" className="form-input" placeholder="0.00" step="0.01" min="0" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pe-lote" className="form-label">N° Lote</label>
            <input id="pe-lote" type="text" className="form-input" placeholder="Ej: L202511A" />
          </div>
          <div className="form-group">
            <label htmlFor="pe-vencimiento" className="form-label">Fecha de Vencimiento</label>
            <input id="pe-vencimiento" type="date" className="form-input" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="pe-invoice" className="form-label">N° Factura / Remito (Opcional)</label>
          <input id="pe-invoice" type="text" className="form-input" placeholder="Ej: 0001-00001234" />
        </div>
      </form>
    </Modal>
  );
};
