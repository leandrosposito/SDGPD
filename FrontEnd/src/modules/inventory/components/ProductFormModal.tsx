import { type FC } from 'react';
import { Modal } from '../../../shared/components/ui/Modal';
import type { InventoryItem } from '../../../shared/types/inventory.types';
import './InventoryModals.css';

// ============================================================
// ProductFormModal — Create/Edit Product
// ============================================================

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: InventoryItem | null; // null for new product
}

export const ProductFormModal: FC<ProductFormModalProps> = ({ isOpen, onClose, product }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Editar Producto' : 'Nuevo Producto'}
      footer={
        <div className="product-modal-footer">
          {product ? (
            <button className="btn-secondary btn-secondary--danger" onClick={onClose}>
              Eliminar
            </button>
          ) : (
            <div />
          )}
          <div className="product-modal-footer__actions">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={onClose}>Guardar</button>
          </div>
        </div>
      }
    >
      <form className="inventory-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group form-group--highlight">
          <label htmlFor="sku" className="form-label">Codigo / Codigo de Barras</label>
          <input 
            id="sku" 
            type="text" 
            className="form-input form-input--scanner" 
            defaultValue={product?.sku || ''} 
            placeholder="Escanee o ingrese codigo"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // Evitar envío del formulario en escaneo
              }
            }}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="name" className="form-label">Nombre del Producto</label>
          <input id="name" type="text" className="form-input" defaultValue={product?.name || ''} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category" className="form-label">Categoria</label>
            <select id="category" className="form-input" defaultValue={product?.category || ''}>
              <option value="" disabled>Seleccionar categoria...</option>
              <option value="Aceites">Aceites</option>
              <option value="Infusiones">Infusiones</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Limpieza">Limpieza</option>
              <option value="Lacteos">Lacteos</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="supplier" className="form-label">Proveedor</label>
            <select id="supplier" className="form-input" defaultValue={product?.supplier || ''}>
              <option value="" disabled>Seleccionar proveedor...</option>
              <option value="Molinos Cañuelas">Molinos Cañuelas</option>
              <option value="Las Marias">Las Marias</option>
              <option value="Coca-Cola Femsa">Coca-Cola Femsa</option>
              <option value="Arcor">Arcor</option>
              <option value="Mastellone Hnos">Mastellone Hnos</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cost" className="form-label">Costo (ARS)</label>
            <input id="cost" type="number" className="form-input" defaultValue={product?.cost || ''} />
          </div>
          <div className="form-group">
            <label htmlFor="price" className="form-label">Precio Venta (ARS)</label>
            <input id="price" type="number" className="form-input" defaultValue={product?.price || ''} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stock" className="form-label">Stock Inicial</label>
            <input id="stock" type="number" className="form-input" defaultValue={product?.stock || 0} />
          </div>
          <div className="form-group">
            <label htmlFor="minStock" className="form-label">Stock Minimo</label>
            <input id="minStock" type="number" className="form-input" defaultValue={product?.minStock || 0} />
          </div>
        </div>
      </form>
    </Modal>
  );
};
