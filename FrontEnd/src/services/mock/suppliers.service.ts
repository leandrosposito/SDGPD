import type { Supplier } from '@/shared/types/supplier.types';
import { SUPPLIERS_MOCK_DATA } from '@/data/mock/suppliers.data';

// ============================================================
// SUPPLIERS SERVICE — RF-PRO-001 / RF-CMP-001 (corrige C4: "Guardar"
// y "Emitir Orden de Compra" no persistian nada)
// Simula llamadas asincronicas a una API de Proveedores.
// Sigue el mismo patron que src/services/mock/products.service.ts.
// Reemplazar por llamadas HTTP reales cuando exista Backend.
// ============================================================

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let suppliersStore: Supplier[] = structuredClone(SUPPLIERS_MOCK_DATA);

export class SupplierServiceError extends Error {}

export type SupplierFormInput = Pick<Supplier, 'name' | 'cuit' | 'category' | 'phone' | 'contactEmail'>;

export async function fetchSuppliers(): Promise<Supplier[]> {
  await delay(SIMULATED_DELAY_MS);
  return structuredClone(suppliersStore);
}

export async function createSupplier(input: SupplierFormInput): Promise<Supplier> {
  await delay(SIMULATED_DELAY_MS);

  if (!input.name || !input.cuit) {
    throw new SupplierServiceError('Razon Social y CUIT son obligatorios.');
  }

  const newSupplier: Supplier = {
    ...input,
    id: `sup-${Date.now()}`,
    contactName: '',
    address: '',
    city: '',
    paymentTerms: '',
    pendingOrdersCount: 0,
    daysUntilExpiration: null,
    currentBalance: 0,
    hasOverdueDebt: false,
    products: [],
  };
  suppliersStore = [...suppliersStore, newSupplier];
  return structuredClone(newSupplier);
}

export async function updateSupplier(id: string, input: SupplierFormInput): Promise<Supplier> {
  await delay(SIMULATED_DELAY_MS);

  if (!input.name || !input.cuit) {
    throw new SupplierServiceError('Razon Social y CUIT son obligatorios.');
  }

  const existing = suppliersStore.find((s) => s.id === id);
  if (!existing) throw new SupplierServiceError('El proveedor que intenta editar ya no existe.');

  const updated: Supplier = { ...existing, ...input };
  suppliersStore = suppliersStore.map((s) => (s.id === id ? updated : s));
  return structuredClone(updated);
}

// RF-CMP-001: addPurchaseOrder se elimino (O3, DECISIONES_TECNICAS.md).
// Las OC de un proveedor ya no se agregan a Supplier.purchaseOrders[]:
// se crean contra Compras (services/mock/purchaseOrders.service#createPurchaseOrder)
// y se consultan por supplierId (getPurchaseOrdersBySupplierId) — ver
// SupplierDetailPanel.tsx y modules/compras/.
