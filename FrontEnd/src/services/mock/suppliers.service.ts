import type { Supplier, SupplierPurchaseOrder } from '@/shared/types/supplier.types';
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
    purchaseOrders: [],
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

// RF-CMP-001 (alcance frontend): agrega una OC recien emitida al historial del proveedor.
export async function addPurchaseOrder(
  supplierId: string,
  order: Omit<SupplierPurchaseOrder, 'id'>
): Promise<Supplier> {
  await delay(SIMULATED_DELAY_MS);

  const existing = suppliersStore.find((s) => s.id === supplierId);
  if (!existing) throw new SupplierServiceError('El proveedor seleccionado ya no existe.');

  const newOrder: SupplierPurchaseOrder = { ...order, id: `oc-${Date.now()}` };
  const updated: Supplier = { ...existing, purchaseOrders: [newOrder, ...existing.purchaseOrders] };
  suppliersStore = suppliersStore.map((s) => (s.id === supplierId ? updated : s));
  return structuredClone(updated);
}
