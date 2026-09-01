import { z } from 'zod';

// ============================================================
// PurchaseOrderFormModal.schema — formulario real de Alta de Orden de
// Compra (O2/O4/R4): zod + react-hook-form, como el resto de los
// formularios del proyecto (ver ProductFormModal.schema.ts).
//
// `productName` viaja en el estado del formulario (para mostrarlo en
// la tabla de lineas sin tener que resolver el productId de nuevo en
// cada render) pero NUNCA se envia al servicio: PurchaseOrderLine solo
// persiste productId/quantity/unitPrice (ver PurchaseOrderFormModal.tsx,
// donde se arma el input real de createPurchaseOrder despojando este
// campo).
// ============================================================

const purchaseOrderLineFormSchema = z.object({
  productId: z.string().min(1),
  productSku: z.string(),
  productName: z.string(),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.'),
  unitPrice: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
});

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().trim().min(1, 'Elegi un proveedor.'),
  branchId: z.string().trim().min(1, 'Elegi una sucursal de destino.'),
  currency: z.enum(['ARS', 'USD']),
  lines: z.array(purchaseOrderLineFormSchema).min(1, 'Agrega al menos un producto a la orden.'),
});

export type PurchaseOrderFormInput = z.input<typeof purchaseOrderFormSchema>;
export type PurchaseOrderFormValues = z.output<typeof purchaseOrderFormSchema>;

export function purchaseOrderFormDefaultValues(
  defaultSupplierId?: string,
  defaultBranchId?: string
): PurchaseOrderFormInput {
  return {
    supplierId: defaultSupplierId ?? '',
    branchId: defaultBranchId ?? '',
    currency: 'ARS',
    lines: [],
  };
}
