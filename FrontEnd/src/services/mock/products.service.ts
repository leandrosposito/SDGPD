import type { InventoryItem } from '@/shared/types/inventory.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';

// ============================================================
// PRODUCTS SERVICE — RF-PRD-001 (ABM Central de Productos)
// Simula llamadas asincronicas a una API de Productos.
// Sigue el mismo patron que src/services/mock/dashboard.service.ts
// (ver CLAUDE.md / docs). Reemplazar por llamadas HTTP reales cuando
// exista Backend.
//
// El "store" en memoria simula persistencia dentro de la sesion del
// navegador (no sobrevive a un refresh): permite que Alta/Modificacion/Baja
// se reflejen en sucesivas lecturas sin depender de que el componente
// mantenga el estado por su cuenta.
// ============================================================

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let productsStore: InventoryItem[] = structuredClone(INVENTORY_MOCK_DATA.items);

export class ProductServiceError extends Error {}

export async function fetchProducts(): Promise<InventoryItem[]> {
  await delay(SIMULATED_DELAY_MS);
  return structuredClone(productsStore);
}

export async function createProduct(input: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  await delay(SIMULATED_DELAY_MS);

  const skuTaken = productsStore.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase());
  if (skuTaken) throw new ProductServiceError('Este SKU ya existe.');

  const barcodeTaken = productsStore.some((p) => p.barcode === input.barcode);
  if (barcodeTaken) throw new ProductServiceError('Este codigo de barras ya existe.');

  const newProduct: InventoryItem = { ...input, id: `inv-${Date.now()}` };
  productsStore = [...productsStore, newProduct];
  return structuredClone(newProduct);
}

export async function updateProduct(id: string, input: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  await delay(SIMULATED_DELAY_MS);

  const exists = productsStore.some((p) => p.id === id);
  if (!exists) throw new ProductServiceError('El producto que intenta editar ya no existe.');

  const skuTaken = productsStore.some(
    (p) => p.sku.toLowerCase() === input.sku.toLowerCase() && p.id !== id
  );
  if (skuTaken) throw new ProductServiceError('Este SKU ya existe.');

  const barcodeTaken = productsStore.some((p) => p.barcode === input.barcode && p.id !== id);
  if (barcodeTaken) throw new ProductServiceError('Este codigo de barras ya existe.');

  const updatedProduct: InventoryItem = { ...input, id };
  productsStore = productsStore.map((p) => (p.id === id ? updatedProduct : p));
  return structuredClone(updatedProduct);
}

export async function deleteProduct(id: string): Promise<void> {
  await delay(SIMULATED_DELAY_MS);

  const exists = productsStore.some((p) => p.id === id);
  if (!exists) throw new ProductServiceError('El producto que intenta eliminar ya no existe.');

  productsStore = productsStore.filter((p) => p.id !== id);
}
