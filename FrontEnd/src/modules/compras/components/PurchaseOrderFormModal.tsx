import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Search, Trash2 } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { PurchaseOrder } from '@/shared/types/purchaseOrder.types';
import { createPurchaseOrder } from '@/services/mock/purchaseOrders.service';
import {
  purchaseOrderFormSchema,
  purchaseOrderFormDefaultValues,
  type PurchaseOrderFormInput,
  type PurchaseOrderFormValues,
} from './PurchaseOrderFormModal.schema';
import './PurchaseOrderFormModal.css';

// ============================================================
// PurchaseOrderFormModal — Alta de OrdenDeCompra (O4): migracion del
// antiguo modal de suppliers/PurchaseOrderModal, que armaba lineas en
// memoria y las descartaba al guardar (solo persistia
// {date,description,amount,status}). Ahora crea una OrdenDeCompra REAL
// via createPurchaseOrder, con las lineas persistidas.
//
// Vive en modules/compras/ (no en modules/suppliers/), ver O4 en
// DECISIONES_TECNICAS.md para la justificacion completa: R2 prohibe que
// Suppliers importe un componente de Compras (o viceversa) — solo se
// pueden invocar por el punto de entrada publico (services/mock/*), y
// un componente de modal no lo es. Suppliers navega a /compras con un
// query param para abrir este modal ya con el proveedor elegido, en vez
// de importarlo directamente.
//
// El buscador de productos NO se restringe al catalogo de precios del
// proveedor (SupplierProduct): busca contra el catalogo real
// (InventoryItem, via products.service#fetchProducts). SupplierProduct
// y InventoryItem no siempre comparten SKU en el mock (drift
// preexistente, fuera de alcance) — restringir la busqueda ahi
// dependeria de esa sincronizacion, que no existe.
// ============================================================

interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  branches: Branch[];
  products: InventoryItem[];
  defaultSupplierId?: string;
  defaultBranchId?: string;
  // Linea precargada (ej. deep-link "Generar OC" desde stock critico de
  // Inventario, ver docs/DECISIONES_TECNICAS.md, O4) — editable por el
  // usuario como cualquier otra linea, no un valor fijo.
  defaultLines?: PurchaseOrderFormInput['lines'];
  onCreated: (order: PurchaseOrder) => void;
}

export const PurchaseOrderFormModal: FC<PurchaseOrderFormModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  branches,
  products,
  defaultSupplierId,
  defaultBranchId,
  defaultLines,
  onCreated,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PurchaseOrderFormInput, unknown, PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: purchaseOrderFormDefaultValues(defaultSupplierId, defaultBranchId),
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'lines' });

  // Reinicia el formulario cada vez que se abre (draft state editable por
  // el usuario, no un valor derivado — mismo criterio que
  // ProductFormModal/PurchaseOrderModal original).
  //
  // appliedDefaultsRef evita reaplicar el reset en cada render mientras
  // sigue abierto (lo que borraria lo que el usuario ya cargo) pero
  // permite reintentar mientras `suppliers` todavia no incluye al
  // `defaultSupplierId` pedido: `suppliers` se carga async en
  // ComprasPage (fetchSuppliers, ~400ms) y si el reset corriera antes de
  // que ese proveedor exista como <option> en el DOM, el <select>
  // ignora el value (un <select> nativo no puede mostrar seleccionada
  // una opcion que todavia no existe) y el proveedor preseleccionado se
  // pierde en silencio — bug real encontrado en la verificacion en
  // navegador de esta tarea, ver DECISIONES_TECNICAS.md.
  const appliedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      appliedDefaultsRef.current = false;
      return;
    }
    if (appliedDefaultsRef.current) return;
    if (defaultSupplierId && !suppliers.some((s) => s.id === defaultSupplierId)) return;

    reset(purchaseOrderFormDefaultValues(defaultSupplierId, defaultBranchId, defaultLines));
    setProductQuery('');
    appliedDefaultsRef.current = true;
  }, [isOpen, defaultSupplierId, defaultBranchId, defaultLines, suppliers, reset]);

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productQuery]);

  const handleAddProduct = (product: InventoryItem) => {
    const existingIndex = fields.findIndex((f) => f.productId === product.id);
    if (existingIndex >= 0) {
      const current = fields[existingIndex];
      update(existingIndex, { ...current, quantity: (Number(current.quantity) || 0) + 1 });
    } else {
      append({
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        quantity: 1,
        unitPrice: product.cost,
      });
    }
    setProductQuery('');
  };

  const submitOrder = (status: 'draft' | 'sent') =>
    handleSubmit(async (values) => {
      setIsSubmitting(true);
      try {
        const result = await createPurchaseOrder({
          supplierId: values.supplierId,
          branchId: values.branchId,
          currency: values.currency,
          status,
          lines: values.lines.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
        });

        if (result.success && result.order) {
          toast.success(
            status === 'draft' ? 'Orden guardada como borrador.' : 'Orden de compra emitida correctamente.'
          );
          onCreated(result.order);
          onClose();
          return;
        }

        const reasonMessage =
          result.reason === 'no-lines'
            ? 'Agrega al menos un producto antes de guardar.'
            : result.reason === 'invalid-line'
              ? 'Revisa las cantidades y precios cargados.'
              : 'No se pudo crear la orden de compra.';
        toast.error(reasonMessage);
      } finally {
        setIsSubmitting(false);
      }
    });

  const lines = watch('lines');
  const currency = watch('currency');
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Orden de Compra"
      size="xl"
      footer={
        <div className="modal-footer">
          <button type="button" className="client-modal-btn client-modal-btn--outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="client-modal-btn client-modal-btn--outline" onClick={submitOrder('draft')} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Borrador'}
          </button>
          <button type="button" className="client-modal-btn client-modal-btn--primary" onClick={submitOrder('sent')} disabled={isSubmitting}>
            {isSubmitting ? 'Emitiendo...' : 'Emitir Orden de Compra'}
          </button>
        </div>
      }
    >
      <div className="purchase-order-layout">
        <div className="po-header-grid">
          <div className="client-form-group">
            <label className="client-form-label" htmlFor="po-supplier">Proveedor</label>
            <select id="po-supplier" className="client-form-select" {...register('supplierId')}>
              <option value="">Seleccionar proveedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.supplierId && <span className="client-form-error">{errors.supplierId.message}</span>}
          </div>
          <div className="client-form-group">
            <label className="client-form-label" htmlFor="po-branch">Sucursal de Destino</label>
            <select id="po-branch" className="client-form-select" {...register('branchId')}>
              <option value="">Seleccionar sucursal...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.branchId && <span className="client-form-error">{errors.branchId.message}</span>}
          </div>
          <div className="client-form-group">
            <label className="client-form-label" htmlFor="po-currency">Moneda</label>
            <select id="po-currency" className="client-form-select" {...register('currency')}>
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dolares (USD)</option>
            </select>
          </div>
        </div>

        <div className="po-search-bar">
          <div className="client-form-group" style={{ flex: 1, position: 'relative' }}>
            <label className="client-form-label" htmlFor="po-product-search">Buscar producto por nombre o SKU</label>
            <div className="po-product-search">
              <Search size={18} className="po-product-search__icon" aria-hidden="true" />
              <input
                id="po-product-search"
                type="text"
                className="po-product-search__input"
                placeholder="Ej: Aceite Girasol..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </div>
            {productMatches.length > 0 && (
              <ul className="po-product-matches" role="listbox" aria-label="Resultados de busqueda de productos">
                {productMatches.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="po-product-matches__item" onClick={() => handleAddProduct(p)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-tertiary text-xs font-mono">{p.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {errors.lines && <span className="client-form-error">{errors.lines.message}</span>}

        <table className="po-items-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right" style={{ width: '6rem' }}>Cantidad</th>
              <th className="text-right" style={{ width: '8rem' }}>Precio U.</th>
              <th className="text-right" style={{ width: '8rem' }}>Subtotal</th>
              <th style={{ width: '3rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-tertiary" style={{ padding: 'var(--space-6)' }}>
                  No hay productos cargados en esta orden. Busca uno arriba para agregarlo.
                </td>
              </tr>
            ) : (
              fields.map((field, index) => (
                <tr key={field.id}>
                  <td>
                    <span className="font-medium">{field.productName}</span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      className="po-financial-input"
                      style={{ width: '4rem', textAlign: 'center' }}
                      min={1}
                      {...register(`lines.${index}.quantity`)}
                    />
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      className="po-financial-input"
                      min={0}
                      step="0.01"
                      {...register(`lines.${index}.unitPrice`)}
                    />
                  </td>
                  <td className="text-right font-medium">
                    {formatCurrency((Number(lines[index]?.quantity) || 0) * (Number(lines[index]?.unitPrice) || 0))}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="po-line-remove-btn"
                      onClick={() => remove(index)}
                      aria-label={`Quitar ${field.productName} de la orden`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="po-financial-summary">
          <div className="po-financial-box">
            <div className="po-financial-row po-financial-row--total">
              <span>Total de la Orden</span>
              <span className="text-accent">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
