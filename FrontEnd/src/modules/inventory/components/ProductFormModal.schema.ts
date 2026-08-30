import { z } from 'zod';
import type { InventoryItem } from '@/shared/types/inventory.types';

// ============================================================
// ProductFormModal.schema — RF-PRD-001 (ABM Central de Productos)
// Esquema de validacion del formulario de Alta/Modificacion de Producto.
// Estandar del proyecto: todo formulario define su esquema zod aca y se
// conecta a react-hook-form via @hookform/resolvers/zod
// (ver docs/DECISIONES_TECNICAS.md).
// ============================================================

// Valida el digito verificador de un codigo EAN-13.
// Criterio de aceptacion RF-PRD-001: "Evitar codigos de barra malformados
// (validacion EAN-13 si aplica)".
function isValidEan13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  const digits = barcode.split('').map(Number);
  const checkDigit = digits[12];
  const sum = digits.slice(0, 12).reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return calculatedCheckDigit === checkDigit;
}

const baseProductFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'El SKU es obligatorio.'),
  barcode: z
    .string()
    .trim()
    .min(1, 'El codigo de barras es obligatorio.')
    .refine((value) => /^\d{13}$/.test(value), {
      message: 'Debe ser EAN-13 (13 digitos numericos).',
    })
    .refine((value) => !/^\d{13}$/.test(value) || isValidEan13(value), {
      message: 'El codigo de barras EAN-13 es invalido (digito verificador incorrecto).',
    }),
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  description: z.string().trim().optional(),
  category: z.string().trim().min(1, 'La categoria es obligatoria.'),
  unitOfMeasure: z.string().trim().min(1, 'La unidad de medida es obligatoria.'),
  // Requerido (no ".optional()"): InventoryItem.supplier es string obligatorio;
  // el campo puede quedar vacio ('') pero no undefined, para no romper a los
  // consumidores de InventoryItem (Table, filtros, etc.) fuera de RF-PRD-001.
  supplier: z.string().trim(),
  status: z.enum(['active', 'inactive']),
  // z.coerce.number(): los inputs numericos llegan como string desde el DOM
  // (input type="number"); coercer aca evita depender de "valueAsNumber" en
  // react-hook-form y mantiene el comportamiento previo (vacio => 0).
  cost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  stock: z.coerce.number().min(0, 'El stock no puede ser negativo.'),
  minStock: z.coerce.number().min(0, 'El stock minimo no puede ser negativo.'),
});

// zod v4 + @hookform/resolvers: z.coerce.number() tiene un tipo de entrada
// (unknown, antes de coercion) distinto del tipo de salida (number, ya
// coercido). react-hook-form necesita ambos por separado: el estado del
// formulario usa el tipo de entrada (ProductFormInput) y el resultado ya
// validado/coercido que llega a onSubmit usa el tipo de salida (ProductFormValues).
export type ProductFormInput = z.input<typeof baseProductFormSchema>;
export type ProductFormValues = z.output<typeof baseProductFormSchema>;

// Regla de negocio RF-PRD-001: "SKU y Codigo de Barras deben ser unicos".
// La unicidad depende de la lista de productos existentes y del producto
// que se esta editando (para no comparar un producto contra si mismo), por
// eso se arma con una factory en vez de un schema estatico.
export function createProductFormSchema(existingProducts: InventoryItem[], currentProductId?: string) {
  return baseProductFormSchema.superRefine((values, ctx) => {
    const skuTaken = existingProducts.some(
      (p) => p.sku.toLowerCase() === values.sku.toLowerCase() && p.id !== currentProductId
    );
    if (skuTaken) {
      ctx.addIssue({
        code: 'custom',
        path: ['sku'],
        message: 'Este SKU ya existe.',
      });
    }

    const barcodeTaken = existingProducts.some(
      (p) => p.barcode === values.barcode && p.id !== currentProductId
    );
    if (barcodeTaken) {
      ctx.addIssue({
        code: 'custom',
        path: ['barcode'],
        message: 'Este codigo de barras ya existe.',
      });
    }
  });
}

export function productFormDefaultValues(product?: InventoryItem | null): ProductFormInput {
  if (!product) {
    return {
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category: '',
      unitOfMeasure: 'Unidad',
      supplier: '',
      status: 'active',
      cost: 0,
      price: 0,
      stock: 0,
      minStock: 0,
    };
  }
  return {
    sku: product.sku,
    barcode: product.barcode || '',
    name: product.name,
    description: product.description || '',
    category: product.category,
    unitOfMeasure: product.unitOfMeasure || 'Unidad',
    supplier: product.supplier || '',
    status: product.status || 'active',
    cost: product.cost,
    price: product.price,
    stock: product.stock,
    minStock: product.minStock,
  };
}
