import { type FC } from 'react';
import { Modal } from '../../../shared/components/ui/Modal';
import { DocumentDropzone } from './DocumentDropzone';
import type { Supplier } from '../../../shared/types/supplier.types';
import './SupplierModals.css';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}

export const SupplierFormModal: FC<SupplierFormModalProps> = ({ isOpen, onClose, supplier }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      size="xl"
      footer={
        <div className="modal-footer">
          <button className="client-modal-btn client-modal-btn--outline" onClick={onClose}>Cancelar</button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={onClose}>Guardar Proveedor</button>
        </div>
      }
    >
      <form className="supplier-form-section" onSubmit={(e) => e.preventDefault()}>
        <h3 className="supplier-section-title">Datos Generales</h3>
        
        <div className="supplier-modal-grid">
          <div className="client-form-group">
            <label className="client-form-label">Razon Social</label>
            <input type="text" className="client-form-input" defaultValue={supplier?.name || ''} placeholder="Ej: Arcor S.A.I.C." />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">CUIT</label>
            <input type="text" className="client-form-input" defaultValue={supplier?.cuit || ''} placeholder="00-00000000-0" />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">Rubro</label>
            <select className="client-form-select" defaultValue={supplier?.category || 'Alimentos Secos'}>
              <option value="Alimentos Secos">Alimentos Secos</option>
              <option value="Infusiones">Infusiones</option>
              <option value="Golosinas">Golosinas</option>
              <option value="Limpieza">Limpieza</option>
              <option value="Bebidas">Bebidas</option>
            </select>
          </div>
        </div>

        <div className="supplier-modal-grid">
          <div className="client-form-group">
            <label className="client-form-label">Telefono</label>
            <input type="tel" className="client-form-input" defaultValue={supplier?.phone || ''} placeholder="+54 11 0000-0000" />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">Email Comercial</label>
            <input type="email" className="client-form-input" defaultValue={supplier?.contactEmail || ''} placeholder="ventas@proveedor.com" />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">Condicion ante el IVA</label>
            <select className="client-form-select" defaultValue="Responsable Inscripto">
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Monotributo">Monotributo</option>
              <option value="Exento">Exento</option>
            </select>
          </div>
        </div>

        <h3 className="supplier-section-title" style={{ marginTop: '1rem' }}>Gestion de Documentacion</h3>
        <DocumentDropzone />
        
      </form>
    </Modal>
  );
};
