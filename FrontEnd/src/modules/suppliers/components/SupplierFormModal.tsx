import { useEffect, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../../shared/components/ui/Modal';
import { DocumentDropzone } from './DocumentDropzone';
import type { Supplier } from '../../../shared/types/supplier.types';
import type { SupplierFormInput } from '../../../services/mock/suppliers.service';
import './SupplierModals.css';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSave?: (input: SupplierFormInput, supplierId?: string) => Promise<Supplier>;
}

export const SupplierFormModal: FC<SupplierFormModalProps> = ({ isOpen, onClose, supplier, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [name, setName] = useState('');
  const [cuit, setCuit] = useState('');
  const [category, setCategory] = useState('Alimentos Secos');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Precarga los campos que persiste Supplier al abrir el modal (alta o edicion).
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowErrors(false);
      setName(supplier?.name || '');
      setCuit(supplier?.cuit || '');
      setCategory(supplier?.category || 'Alimentos Secos');
      setPhone(supplier?.phone || '');
      setContactEmail(supplier?.contactEmail || '');
    }
  }, [isOpen, supplier]);

  const handleSave = async () => {
    if (!name.trim() || !cuit.trim()) {
      setShowErrors(true);
      return;
    }
    if (!onSave) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave({ name, cuit, category, phone, contactEmail }, supplier?.id);
      toast.success(supplier ? 'Proveedor actualizado correctamente.' : 'Proveedor creado correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      size="xl"
      footer={
        <div className="modal-footer">
          <button className="client-modal-btn client-modal-btn--outline" onClick={onClose} disabled={isSubmitting}>Cancelar</button>
          <button className="client-modal-btn client-modal-btn--primary" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Proveedor'}
          </button>
        </div>
      }
    >
      <form className="supplier-form-section" onSubmit={(e) => e.preventDefault()}>
        <h3 className="supplier-section-title">Datos Generales</h3>

        <div className="supplier-modal-grid">
          <div className="client-form-group">
            <label className="client-form-label">Razon Social</label>
            <input
              type="text"
              className={`client-form-input ${showErrors && !name.trim() ? 'client-form-input--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Arcor S.A.I.C."
            />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">CUIT</label>
            <input
              type="text"
              className={`client-form-input ${showErrors && !cuit.trim() ? 'client-form-input--error' : ''}`}
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="00-00000000-0"
            />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">Rubro</label>
            <select className="client-form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
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
            <input
              type="tel"
              className="client-form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 11 0000-0000"
            />
          </div>

          <div className="client-form-group">
            <label className="client-form-label">Email Comercial</label>
            <input
              type="email"
              className="client-form-input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="ventas@proveedor.com"
            />
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
