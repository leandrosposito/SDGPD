import { type FC } from 'react';
import { Modal } from '../../../components/ui/Modal';
import './OrderFormModal.css';

// ============================================================
// OrderFormModal — New manual order (structural scaffold)
// ============================================================

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrderFormModal: FC<OrderFormModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Pedido Manual"
      footer={
        <>
          <button className="ofm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="ofm-btn-primary" onClick={onClose}>Guardar Borrador</button>
        </>
      }
    >
      <div className="order-form">
        {/* Section: Client */}
        <section className="order-form__section">
          <h4 className="order-form__section-title">Datos del Cliente</h4>
          <div className="order-form__row">
            <div className="order-form__group">
              <label htmlFor="ofm-client" className="order-form__label">Cliente</label>
              <select id="ofm-client" className="order-form__input">
                <option value="" disabled>Seleccionar cliente...</option>
                <option value="cli-001">Almacen La Esquina</option>
                <option value="cli-002">Supermercado Lider</option>
                <option value="cli-003">Kiosco El Paso</option>
              </select>
            </div>
            <div className="order-form__group">
              <label htmlFor="ofm-seller" className="order-form__label">Vendedor</label>
              <select id="ofm-seller" className="order-form__input">
                <option value="" disabled>Seleccionar vendedor...</option>
                <option value="s1">Gonzalez, Maria</option>
                <option value="s2">Ramirez, Carlos</option>
                <option value="s3">Lopez, Beatriz</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section: Products (scaffold) */}
        <section className="order-form__section">
          <div className="order-form__section-header">
            <h4 className="order-form__section-title">Productos</h4>
            <button className="order-form__btn-add-product" type="button">
              + Agregar Producto
            </button>
          </div>

          <div className="order-form__products-placeholder">
            <p className="order-form__placeholder-text">
              Seleccione un cliente para habilitar la carga de productos.
            </p>
          </div>
        </section>

        {/* Section: Notes */}
        <section className="order-form__section">
          <div className="order-form__group">
            <label htmlFor="ofm-notes" className="order-form__label">Notas / Observaciones</label>
            <textarea
              id="ofm-notes"
              className="order-form__input order-form__textarea"
              rows={3}
              placeholder="Instrucciones de entrega, condiciones especiales..."
            />
          </div>
        </section>
      </div>
    </Modal>
  );
};
