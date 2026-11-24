// ============================================================
// clients.service — Único punto del proyecto que habla con httpClient
// para Clientes (Tanda 3d de escalabilidad). Absorbe TODO el contenido
// de services/mock/clients.service.ts (eliminado en esta tanda, ver
// docs/DECISIONES_TECNICAS.md) — no solo el Directorio.
//
// Por qué se absorbió todo el archivo, no solo fetchClients/
// createClient/updateClient: `clientsStore` es una ÚNICA variable
// compartida entre el Directorio y getClientAccountsPage/
// getOverdueClientsPage (Cuentas Corrientes/Clientes Morosos) — al
// punto de que `overdueSnapshotCache` invalida su cache FIFO por
// IGUALDAD DE REFERENCIA contra `clientsStore` (ver más abajo).
// Separar el archivo en dos, cada uno con su propio store, hubiera
// roto la consistencia entre las 3 pestañas: un cliente creado en el
// Directorio no aparecería en Cuentas Corrientes ni Clientes Morosos.
// Por eso el store es UNO solo (clients.store.ts) y las 3 pestañas lo
// comparten: clients.directory.ts, clients.accounts.ts y
// clients.overdue.ts. Este archivo solo re-exporta la API pública.
//
// getClientAccountsPage/getOverdueClientsPage y TODA su lógica de
// soporte (FIFO, aging buckets, cache por referencia) están copiadas
// LITERAL desde el archivo viejo — cero refactors, cero "mejoras" de
// paso, tal como pedía la tarea. Siguen operando directo sobre
// `ClientAccount` (dominio), SIN pasar por DTO — ver el porqué en
// dto.ts/mapper.ts.
//
// Sin branchId (M9, ya confirmado en tandas anteriores, reverificado
// contra el código en esta): un cliente es de la empresa.
// ============================================================

export {
  getClientsPage,
  exportClients,
  fetchClientsCatalog,
  getClientById,
  createClient,
  updateClient,
} from './clients.directory'
export { getClientAccountsPage, exportClientAccounts } from './clients.accounts'
export { getOverdueClientsPage, exportOverdueClients } from './clients.overdue'

export type {
  ClientsQueryFilters,
  ClientsSortField,
  ClientAccountsQueryFilters,
  ClientAccountsSortField,
} from './clients.types'

export type { ClientFormInput } from './mapper'
