import type { ClientAccount } from '../../shared/types/client.types';
import { CLIENTS_MOCK_DATA } from '../../data/mock/clients.data';

// ============================================================
// CLIENTS SERVICE — RF-CLI-001 (corrige C4: "Guardar" no persistia nada)
// Simula llamadas asincronicas a una API de Clientes.
// Sigue el mismo patron que src/services/mock/products.service.ts.
// Reemplazar por llamadas HTTP reales cuando exista Backend.
// ============================================================

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let clientsStore: ClientAccount[] = structuredClone(CLIENTS_MOCK_DATA);

export class ClientServiceError extends Error {}

export type ClientFormInput = Pick<
  ClientAccount,
  'clientName' | 'cuit' | 'address' | 'phone' | 'zone' | 'sellerName' | 'creditLimit'
>;

export async function fetchClients(): Promise<ClientAccount[]> {
  await delay(SIMULATED_DELAY_MS);
  return structuredClone(clientsStore);
}

export async function createClient(input: ClientFormInput): Promise<ClientAccount> {
  await delay(SIMULATED_DELAY_MS);

  const newClient: ClientAccount = {
    ...input,
    id: `cli-${Date.now()}`,
    totalDebit: 0,
    totalCredit: 0,
    currentBalance: 0,
    daysOverdue: 0,
    status: 'Al dia',
    transactions: [],
  };
  clientsStore = [...clientsStore, newClient];
  return structuredClone(newClient);
}

export async function updateClient(id: string, input: ClientFormInput): Promise<ClientAccount> {
  await delay(SIMULATED_DELAY_MS);

  const existing = clientsStore.find((c) => c.id === id);
  if (!existing) throw new ClientServiceError('El cliente que intenta editar ya no existe.');

  const updated: ClientAccount = { ...existing, ...input };
  clientsStore = clientsStore.map((c) => (c.id === id ? updated : c));
  return structuredClone(updated);
}
