import { type FC } from 'react';
import { Modal } from '../../../components/ui/Modal';
import type { Supplier } from '../../../types/supplier.types';
import './SupplierModals.css';

// ============================================================
// SupplierFormModal — Create / Edit Supplier
// ============================================================

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}

export const SupplierFormModal: FC<SupplierFormModalProps> = ({ isOpen, onClose, supplier }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      footer={
        <div className="supplier-modal-footer">
          {supplier && (
            <button className="btn-secondary btn-secondary--danger" onClick={onClose}>
              Eliminar
            </button>
          )}
          <div className="supplier-modal-footer__actions">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={onClose}>Guardar</button>
          </div>
        </div>
      }
    >
      <form className="supplier-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="sup-name" className="form-label">Razon Social</label>
          <input id="sup-name" type="text" className="form-input" defaultValue={supplier?.name || ''} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sup-cuit" className="form-label">CUIT</label>
            <input id="sup-cuit" type="text" className="form-input font-mono" placeholder="XX-XXXXXXXX-X" defaultValue={supplier?.cuit || ''} />
          </div>
          <div className="form-group">
            <label htmlFor="sup-phone" className="form-label">Telefono</label>
            <input id="sup-phone" type="tel" className="form-input" defaultValue={supplier?.phone || ''} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sup-contact" className="form-label">Contacto Comercial</label>
            <input id="sup-contact" type="text" className="form-input" defaultValue={supplier?.contactName || ''} />
          </div>
          <div className="form-group">
            <label htmlFor="sup-email" className="form-label">Email</label>
            <input id="sup-email" type="email" className="form-input" defaultValue={supplier?.contactEmail || ''} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sup-address" className="form-label">Direccion</label>
            <input id="sup-address" type="text" className="form-input" defaultValue={supplier?.address || ''} />
          </div>
          <div className="form-group">
            <label htmlFor="sup-city" className="form-label">Ciudad</label>
            <input id="sup-city" type="text" className="form-input" defaultValue={supplier?.city || ''} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="sup-terms" className="form-label">Condicion de Pago</label>
          <select id="sup-terms" className="form-input" defaultValue={supplier?.paymentTerms || ''}>
            <option value="" disabled>Seleccionar...</option>
            <option value="Contado">Contado</option>
            <option value="15 dias">15 dias</option>
            <option value="30 dias">30 dias</option>
            <option value="60 dias">60 dias</option>
            <option value="90 dias">90 dias</option>
          </select>
        </div>
      </form>
    </Modal>
  );
};
