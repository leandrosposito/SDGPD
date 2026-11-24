import type { ClientAccount } from '@/shared/types/client.types'
import { CLIENTS_MOCK_DATA } from '@/data/mock/clients.data'

// ============================================================
// clients.store — Unica fuente de verdad de los clientes (mock).
// Directorio, Cuentas Corrientes y Clientes Morosos leen el MISMO
// arreglo: un cliente creado en el Directorio aparece en las otras dos
// pestanas, y el cache de morosos se invalida por IGUALDAD DE
// REFERENCIA contra listClients() (cada alta/edicion crea un arreglo
// nuevo). Por eso el arreglo vive aca, en un solo lugar, y nunca se
// exporta: se lee con listClients() y se modifica con addClient/
// replaceClient.
// ============================================================

// Espacio de DOMINIO, no DTO — a diferencia de suppliers/orders/cash.
// getClientAccountsPage/getOverdueClientsPage leen esta misma
// variable directo (sin conversión); la traducción a/desde DTO ocurre
// solo en el borde de getClientsPage/createClient/updateClient (ver
// más abajo), no en el storage.
let clientsStore: ClientAccount[] = structuredClone(CLIENTS_MOCK_DATA)

export function listClients(): ClientAccount[] {
  return clientsStore
}

export function findClient(id: string): ClientAccount | undefined {
  return clientsStore.find(c => c.id === id)
}

export function addClient(client: ClientAccount): void {
  clientsStore = [...clientsStore, client]
}

// Reemplaza el cliente con ese id por la version actualizada.
export function replaceClient(id: string, updated: ClientAccount): void {
  clientsStore = clientsStore.map(c => (c.id === id ? updated : c))
}
