import { useEffect, useMemo, useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '../../../shared/components/ui/Modal';
import type { InventoryItem } from '../../../shared/types/inventory.types';
import {
  createProductFormSchema,
  productFormDefaultValues,
  type ProductFormValues,
} from './ProductFormModal.schema';
import './InventoryModals.css';

// ============================================================
// ProductFormModal — RF-PRD-001 (ABM Central de Productos)
// Alta / Modificacion / Baja del maestro de productos.
// Validacion: react-hook-form + zod (ver ProductFormModal.schema.ts),
// segun el estandar obligatorio del proyecto (docs/DECISIONES_TECNICAS.md).
// ============================================================

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: InventoryItem | null;
  existingProducts?: InventoryItem[];
  onSave?: (values: ProductFormValues, productId?: string) => Promise<InventoryItem>;
  onDelete?: (productId: string) => Promise<void>;
}

export const ProductFormModal: FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  existingProducts = [],
  onSave,
  onDelete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const schema = useMemo(
    () => createProductFormSchema(existingProducts, product?.id),
    [existingProducts, product?.id]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: productFormDefaultValues(product),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (isOpen) {
      reset(productFormDefaultValues(product));
      setConfirmingDelete(false);
    }
  }, [isOpen, product]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!onSave) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(values, product?.id);
      toast.success(product ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!product || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(product.id);
      toast.success('Producto eliminado correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Editar Producto' : 'Nuevo Producto'}
      footer={
        confirmingDelete ? (
          <div className="product-delete-confirm">
            <span className="product-delete-confirm__text">
              ¿Confirmar eliminacion de este producto? Esta accion no se puede deshacer.
            </span>
            <div className="product-modal-footer__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-secondary btn-secondary--danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Si, eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="product-modal-footer">
            {product ? (
              <button
                type="button"
                className="btn-secondary btn-secondary--danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={isSubmitting}
              >
                Eliminar
              </button>
            ) : (
              <div />
            )}
            <div className="product-modal-footer__actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )
      }
    >
      <form className="inventory-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sku" className="form-label">
              SKU (Codigo Interno)
            </label>
            <input
              id="sku"
              type="text"
              className={`form-input ${errors.sku ? 'client-form-input--error' : ''}`}
              placeholder="Ej. ACE-GIR-15"
              autoFocus
              {...register('sku')}
            />
            {errors.sku && <span className="text-danger text-xs">{errors.sku.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="barcode" className="form-label">
              Codigo de Barras (EAN-13)
            </label>
            <input
              id="barcode"
              type="text"
              className={`form-input ${errors.barcode ? 'client-form-input--error' : ''}`}
              placeholder="Ej. 7791234567890"
              {...register('barcode')}
            />
            {errors.barcode && <span className="text-danger text-xs">{errors.barcode.message}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Nombre del Producto
          </label>
          <input
            id="name"
            type="text"
            className={`form-input ${errors.name ? 'client-form-input--error' : ''}`}
            {...register('name')}
          />
          {errors.name && <span className="text-danger text-xs">{errors.name.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Descripcion (Opcional)
          </label>
          <textarea id="description" className="form-input" rows={2} {...register('description')} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category" className="form-label">
              Categoria
            </label>
            <select
              id="category"
              className={`form-input ${errors.category ? 'client-form-input--error' : ''}`}
              defaultValue=""
              {...register('category')}
            >
              <option value="" disabled>
                Seleccionar categoria...
              </option>
              <option value="Aceites">Aceites</option>
              <option value="Infusiones">Infusiones</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Limpieza">Limpieza</option>
              <option value="Lacteos">Lacteos</option>
            </select>
            {errors.category && <span className="text-danger text-xs">{errors.category.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="unitOfMeasure" className="form-label">
              Unidad de Medida Base
            </label>
            <select id="unitOfMeasure" className="form-input" {...register('unitOfMeasure')}>
              <option value="Unidad">Unidad</option>
              <option value="Botella">Botella</option>
              <option value="Paquete">Paquete</option>
              <option value="Caja">Caja</option>
              <option value="Kg">Kg</option>
              <option value="Litro">Litro</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="supplier" className="form-label">
              Proveedor
            </label>
            <select id="supplier" className="form-input" {...register('supplier')}>
              <option value="">(Ninguno)</option>
              <option value="Molinos Cañuelas">Molinos Cañuelas</option>
              <option value="Las Marias">Las Marias</option>
              <option value="Coca-Cola Femsa">Coca-Cola Femsa</option>
              <option value="Arcor">Arcor</option>
              <option value="Mastellone Hnos">Mastellone Hnos</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="status" className="form-label">
              Estado
            </label>
            <select id="status" className="form-input" {...register('status')}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cost" className="form-label">
              Costo (ARS)
            </label>
            <input
              id="cost"
              type="number"
              className={`form-input ${errors.cost ? 'client-form-input--error' : ''}`}
              {...register('cost')}
            />
            {errors.cost && <span className="text-danger text-xs">{errors.cost.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="price" className="form-label">
              Precio Venta (ARS)
            </label>
            <input
              id="price"
              type="number"
              className={`form-input ${errors.price ? 'client-form-input--error' : ''}`}
              {...register('price')}
            />
            {errors.price && <span className="text-danger text-xs">{errors.price.message}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stock" className="form-label">
              Stock Inicial
            </label>
            <input
              id="stock"
              type="number"
              className="form-input"
              disabled={!!product}
              {...register('stock')}
            />
          </div>
          <div className="form-group">
            <label htmlFor="minStock" className="form-label">
              Stock Minimo
            </label>
            <input
              id="minStock"
              type="number"
              className={`form-input ${errors.minStock ? 'client-form-input--error' : ''}`}
              {...register('minStock')}
            />
            {errors.minStock && <span className="text-danger text-xs">{errors.minStock.message}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
};
