import type {
  AgingBucket,
  AgingBucketAggregate,
  ClientAccount,
  ClientTransaction,
  Currency,
  OpenInvoice,
  OverdueAmountByCurrency,
  OverdueClientRow,
  OverdueClientsAggregates,
  OverdueClientsQueryFilters,
  OverdueClientsSortField,
} from '@/shared/types/client.types';
import type { PageQuery, PageResult, DateRangeQueryFilters, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { CLIENTS_MOCK_DATA } from '@/data/mock/clients.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type { ClientAccountDTO, ClientsPageDTO } from './dto';
import { clientFromDTO, clientToDTO, clientFormInputToDTO, type ClientFormInput } from './mapper';

export type { ClientFormInput };

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
// No fue una preferencia de estructura, fue una restricción técnica.
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

// Espacio de DOMINIO, no DTO — a diferencia de suppliers/orders/cash.
// getClientAccountsPage/getOverdueClientsPage leen esta misma
// variable directo (sin conversión); la traducción a/desde DTO ocurre
// solo en el borde de getClientsPage/createClient/updateClient (ver
// más abajo), no en el storage.
let clientsStore: ClientAccount[] = structuredClone(CLIENTS_MOCK_DATA);

// ============================================================
// DIRECTORIO DE CLIENTES — paginado server-side (Tanda 3d). Los
// filtros de zona/vendedor/estado, que antes corrían en memoria en
// ClientsPage.tsx#filteredClients, pasan acá.
// ============================================================

export interface ClientsQueryFilters {
  empresaId: string;
  search?: string;
  zone?: string;
  seller?: string;
  status?: ClientAccount['status'];
}

// Un solo campo de orden: el Directorio no tenía sort de columna
// clickeable antes de esta tanda — se ordena por nombre, sin
// selector en la UI que la vista original tampoco tenía (mismo
// criterio que UsersSortField en settings, Tanda 3c).
export type ClientsSortField = 'clientName';

function matchesDirectoryFilters(client: ClientAccount, filters: ClientsQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const matchesSearch =
    !search || client.clientName.toLowerCase().includes(search) || client.cuit.includes(search);
  const matchesZone = !filters.zone || client.zone === filters.zone;
  const matchesSeller = !filters.seller || client.sellerName === filters.seller;
  const matchesStatus = !filters.status || client.status === filters.status;
  return matchesSearch && matchesZone && matchesSeller && matchesStatus;
}

function resolveMockClientsPage(query: PageQuery<ClientsQueryFilters, ClientsSortField>): ClientsPageDTO {
  const inScope = clientsStore.filter((c) => matchesDirectoryFilters(c, query.filters));
  const sorted = [...inScope].sort((a, b) => {
    const cmp = a.clientName.localeCompare(b.clientName);
    return query.sort?.direction === 'desc' ? -cmp : cmp;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize).map(clientToDTO),
    meta: { total, page: safePage, page_size: query.pageSize },
  };
}

export async function getClientsPage(
  query: PageQuery<ClientsQueryFilters, ClientsSortField>,
  signal?: AbortSignal
): Promise<PageResult<ClientAccount>> {
  const pageDTO = await httpClient.request<ClientsPageDTO>({
    method: 'GET',
    path: '/clients',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      zone: query.filters.zone,
      seller: query.filters.seller,
      status: query.filters.status,
      page: query.page,
      pageSize: query.pageSize,
    },
    signal,
    mock: () => resolveMockClientsPage(query),
  });

  return {
    items: pageDTO.data.map(clientFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

export async function createClient(empresaId: string, input: ClientFormInput): Promise<ClientAccount> {
  const dto = await httpClient.request<ClientAccountDTO>({
    method: 'POST',
    path: '/clients',
    body: { empresaId, ...clientFormInputToDTO(input) },
    mock: () => {
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
      return clientToDTO(newClient);
    },
  });
  return clientFromDTO(dto);
}

export async function updateClient(empresaId: string, id: string, input: ClientFormInput): Promise<ClientAccount> {
  const dto = await httpClient.request<ClientAccountDTO>({
    method: 'PUT',
    path: `/clients/${id}`,
    body: { empresaId, ...clientFormInputToDTO(input) },
    mock: () => {
      const existing = clientsStore.find((c) => c.id === id);
      if (!existing) throw new ApiError(404, 'CLIENT_ERROR', 'El cliente que intenta editar ya no existe.');

      const updated: ClientAccount = { ...existing, ...input };
      clientsStore = clientsStore.map((c) => (c.id === id ? updated : c));
      return clientToDTO(updated);
    },
  });
  return clientFromDTO(dto);
}

// ============================================================
// CUENTAS CORRIENTES — paginado server-side (M7/3.5). Reemplaza a la
// tabla HTML propia de ClientAccountsTable, que recibia el array
// completo ya filtrado por ClientsPage. Solo busqueda por nombre/CUIT
// (M6) — zona/vendedor/estado del filtro superior siguen aplicando
// unicamente al Directorio (fuera de alcance de esta tarea, ver
// DECISIONES_TECNICAS.md): agregarlos al contrato paginado no fue
// pedido y hubiera sido diseñar filtros que nadie definio.
//
// COPIADO LITERAL desde services/mock/clients.service.ts (Tanda 3d) —
// sin ningun cambio de logica, prohibido tocarla.
// ============================================================

// dateFrom/dateTo (DateRangeFilter, tarea transversal) — Opcion A
// (decidida explicitamente, ver DECISIONES_TECNICAS.md): filtro de
// EXISTENCIA. Solo acota QUE clientes aparecen (los que tengan al
// menos una transaccion en el rango); totalDebit/totalCredit/
// currentBalance de la fila siguen siendo los saldos reales de la
// cuenta completa, nunca recalculados sobre el rango — la Opcion B
// (recalcular saldos sobre el rango) es una feature de reporteria
// distinta, fuera de alcance de esta tarea.
export interface ClientAccountsQueryFilters extends DateRangeQueryFilters {
  search?: string;
}

export type ClientAccountsSortField = 'clientName' | 'currentBalance' | 'creditLimit';

function matchesSearch(text: string, cuit: string, search: string | undefined): boolean {
  if (!search || !search.trim()) return true;
  const q = search.trim().toLowerCase();
  return text.toLowerCase().includes(q) || cuit.includes(q);
}

// Compartida por accounts (existencia sobre transactions[].date) y por
// morosos (dueDate de facturas) — compara solo la porcion yyyy-MM-dd,
// funciona igual para un ISO date puro que para un ISO datetime
// completo.
function isWithinDateRange(dateISO: string, dateFrom: string | undefined, dateTo: string | undefined): boolean {
  const day = dateISO.slice(0, 10);
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

function hasTransactionInRange(client: ClientAccount, dateFrom: string | undefined, dateTo: string | undefined): boolean {
  if (!dateFrom && !dateTo) return true;
  return client.transactions.some((t) => isWithinDateRange(t.date, dateFrom, dateTo));
}

function compareClientAccounts(a: ClientAccount, b: ClientAccount, field: ClientAccountsSortField): number {
  switch (field) {
    case 'currentBalance':
      return a.currentBalance - b.currentBalance;
    case 'creditLimit':
      return a.creditLimit - b.creditLimit;
    case 'clientName':
    default:
      return a.clientName.localeCompare(b.clientName);
  }
}

// Compartido entre getClientAccountsPage y exportClientAccounts (no se
// duplica la logica de filtrado entre paginado y export).
function filterClientAccountsInScope(filters: ClientAccountsQueryFilters): ClientAccount[] {
  return clientsStore.filter(
    (c) => matchesSearch(c.clientName, c.cuit, filters.search) && hasTransactionInRange(c, filters.dateFrom, filters.dateTo)
  );
}

function sortClientAccounts(
  clients: ClientAccount[],
  sort: { field: ClientAccountsSortField; direction: 'asc' | 'desc' } | undefined
): ClientAccount[] {
  const sortField = sort?.field ?? 'clientName';
  const direction = sort?.direction ?? 'asc';
  return [...clients].sort((a, b) => {
    const cmp = compareClientAccounts(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.3): un orden ambiguo hace que el
    // mismo cliente aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

export async function getClientAccountsPage(
  query: PageQuery<ClientAccountsQueryFilters, ClientAccountsSortField>,
  signal?: AbortSignal
): Promise<PageResult<ClientAccount>> {
  return httpClient.request<PageResult<ClientAccount>>({
    method: 'GET',
    path: '/clients/accounts',
    params: {
      search: query.filters.search,
      dateFrom: query.filters.dateFrom,
      dateTo: query.filters.dateTo,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query;
      const sorted = sortClientAccounts(filterClientAccountsInScope(filters), sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return { items: structuredClone(items), total, page: safePage, pageSize };
    },
  });
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros, sin paginar, hasta MAX_EXPORT_ROWS.
export async function exportClientAccounts(
  filters: ClientAccountsQueryFilters,
  sort?: { field: ClientAccountsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<ClientAccount>> {
  return httpClient.request<ExportResult<ClientAccount>>({
    method: 'GET',
    path: '/clients/accounts/export',
    params: { search: filters.search, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    mock: () => {
      const sorted = sortClientAccounts(filterClientAccountsInScope(filters), sort);
      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS);

      return { items: structuredClone(items), truncated };
    },
  });
}

// ============================================================
// DEUDA VENCIDA / AGING (M1-M4) — imputacion FIFO de pagos y ajustes
// contra facturas, tramos de aging y agregados por tramo. Ver
// DECISIONES_TECNICAS.md, entrada de esta tarea, para el razonamiento
// completo de la regla de negocio y de por que el computo vive en un
// cache invalidado por referencia (no se reimputa por pagina — 3.3).
//
// COPIADO LITERAL desde services/mock/clients.service.ts (Tanda 3d) —
// sin ningun cambio de logica, prohibido tocarla.
// ============================================================

const AGING_BUCKETS: readonly AgingBucket[] = ['1-30', '31-60', '61-90', '90+'];

function bucketForDays(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

// Imputacion FIFO (M2, decision de negocio): las facturas se cancelan
// de la mas vieja a la mas nueva con el total disponible de pagos +
// ajustes de credito. Se suma primero TODO el pool disponible y se
// aplica en orden — matematicamente equivalente a aplicar cada pago en
// el momento historico en que ocurrio (lo unico que determina el saldo
// abierto final de cada factura es cuanto dinero llego en total y en
// que orden de antiguedad se cancelan las facturas, no la fecha exacta
// de cada pago individual), pero mucho mas simple de calcular sobre un
// snapshot.
//
// Por MONEDA (C1, DECISIONES_TECNICAS.md): un pago en ARS no puede
// cancelar una factura en USD. El pool no es un numero unico: es un
// Map por moneda, y cada factura solo consume del pool de SU propia
// moneda. Antes de este fix el pool era un solo numero — un pago en
// cualquier moneda cancelaba facturas de cualquier otra, lo cual
// contradecia M5 y no se notaba porque el mock era todo ARS.
//
// Ajustes: un ajuste con credit > 0 (nota de credito / descuento) se
// suma al pool de su moneda igual que un pago. Un ajuste con debit > 0
// (nota de debito / recargo) NO se imputa contra ninguna factura ni
// genera un item vencible propio — no tiene dueDate (M1: "los ajustes
// no vencen"), asi que no puede entrar en un tramo de mora por si
// mismo. Queda reflejado solo en los totales legacy de la cuenta
// (ClientAccount.totalDebit/currentBalance), fuera del calculo de
// aging de esta vista.
//
// Orden del pool (C3, DECISIONES_TECNICAS.md): las facturas se ordenan
// por `date` (fecha de EMISION), no por `dueDate` (vencimiento). Es una
// decision de negocio tomada por defecto al construir la imputacion
// original — se documenta y se deja asi en esta tarea, ver la entrada
// de C3 para el razonamiento y el caso en que da un resultado distinto
// del criterio alternativo.
function imputeOpenInvoices(transactions: ClientTransaction[], today: Date): OpenInvoice[] {
  const invoices = transactions
    .filter((t) => t.type === 'invoice')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const poolByCurrency = new Map<Currency, number>();
  for (const t of transactions) {
    if (t.type === 'payment' || t.type === 'adjustment') {
      // solo el credito se imputa; el debito de un ajuste se ignora a proposito
      poolByCurrency.set(t.currency, (poolByCurrency.get(t.currency) ?? 0) + t.credit);
    }
  }

  const open: OpenInvoice[] = [];
  for (const invoice of invoices) {
    const pool = poolByCurrency.get(invoice.currency) ?? 0;
    const applied = Math.min(pool, invoice.debit);
    poolByCurrency.set(invoice.currency, pool - applied);
    const openBalance = invoice.debit - applied;
    if (openBalance <= 0) continue;

    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
    const isOverdue = daysOverdue > 0;

    open.push({
      transactionId: invoice.id,
      dueDate: invoice.dueDate,
      originalAmount: invoice.debit,
      openBalance,
      currency: invoice.currency,
      daysOverdue: isOverdue ? daysOverdue : 0,
      bucket: isOverdue ? bucketForDays(daysOverdue) : null,
    });
  }
  return open;
}

interface OverdueSnapshotEntry {
  row: OverdueClientRow;
  openInvoices: OpenInvoice[]; // solo las vencidas, para los agregados por tramo
}

// Cache invalidado por referencia (3.3): la imputacion FIFO es
// invariante respecto de la consulta (pagina/busqueda/tramo/orden) —
// solo depende de los datos crudos. Se recalcula UNA vez por cada
// version de `clientsStore` (comparando la referencia del array, que
// cambia en createClient/updateClient) y se reutiliza para cualquier
// cantidad de paginas que se pidan despues, en vez de recorrer las
// transacciones de los 29 (o 50.000) clientes en cada request. Pedir
// la pagina 5 solo filtra/ordena/corta el snapshot ya calculado.
let overdueSnapshotCache: {
  computedFor: ClientAccount[];
  computedOnDay: string;
  snapshot: OverdueSnapshotEntry[];
} | null = null;

// Extraido de computeOverdueSnapshot para poder reusarlo (tarea
// transversal, dateFrom/dateTo) recomputando SOLO oldest/overdueByCurrency
// sobre un subconjunto de facturas ya vencidas (nunca sobre facturas al
// dia: bucket !== null sigue siendo responsabilidad de quien llama).
// clientName/cuit/creditLimit/currentBalance son campos de la CUENTA,
// no de las facturas — no cambian entre el snapshot completo y un
// recorte por rango de fecha, asi que este helper los recibe ya
// resueltos en vez de necesitar el ClientAccount completo.
function buildOverdueRow(
  identity: Pick<OverdueClientRow, 'clientId' | 'clientName' | 'cuit' | 'creditLimit' | 'currentBalance'>,
  overdueInvoices: OpenInvoice[]
): OverdueClientRow | null {
  if (overdueInvoices.length === 0) return null; // al dia, o sin facturas vencidas en el recorte pedido (M8/M3)

  // El tramo/antiguedad mas critico es del CLIENTE, no de una moneda en
  // particular (C1): los dias de mora no se suman ni se mezclan, solo
  // se compara "cual es mayor", asi que da igual que las facturas
  // comparadas esten en distinta moneda.
  const oldest = overdueInvoices.reduce((older, inv) => (inv.daysOverdue > older.daysOverdue ? inv : older));

  // Total vencido POR MONEDA (C1): nunca un numero suelto que suma
  // monedas distintas. La moneda de la factura mas antigua queda
  // primera en el array (la mas relevante para cobranza), el resto en
  // orden alfabetico para que el orden sea deterministico.
  const totalsByCurrency = new Map<Currency, number>();
  for (const inv of overdueInvoices) {
    totalsByCurrency.set(inv.currency, (totalsByCurrency.get(inv.currency) ?? 0) + inv.openBalance);
  }
  const overdueByCurrency: OverdueAmountByCurrency[] = [...totalsByCurrency.entries()]
    .sort(([currencyA], [currencyB]) => {
      if (currencyA === oldest.currency) return -1;
      if (currencyB === oldest.currency) return 1;
      return currencyA.localeCompare(currencyB);
    })
    .map(([currency, amount]) => ({ currency, amount }));

  return {
    clientId: identity.clientId,
    clientName: identity.clientName,
    cuit: identity.cuit,
    overdueByCurrency,
    oldestOverdueDays: oldest.daysOverdue,
    oldestBucket: oldest.bucket as AgingBucket,
    creditLimit: identity.creditLimit,
    currentBalance: identity.currentBalance,
  };
}

function computeOverdueSnapshot(clients: ClientAccount[]): OverdueSnapshotEntry[] {
  const today = new Date();
  const entries: OverdueSnapshotEntry[] = [];

  for (const client of clients) {
    const openInvoices = imputeOpenInvoices(client.transactions, today);
    const overdueInvoices = openInvoices.filter((inv) => inv.bucket !== null);
    const row = buildOverdueRow(
      {
        clientId: client.id,
        clientName: client.clientName,
        cuit: client.cuit,
        creditLimit: client.creditLimit,
        currentBalance: client.currentBalance,
      },
      overdueInvoices
    );
    if (!row) continue;
    entries.push({ row, openInvoices: overdueInvoices });
  }
  return entries;
}

// Dia calendario (local) con el que se calculo el snapshot cacheado
// (C2, DECISIONES_TECNICAS.md). computeOverdueSnapshot usa `new
// Date()` para dias de mora/tramos, pero el cache solo invalidaba por
// referencia de `clientsStore` — si la sesion queda abierta y cruza la
// medianoche, la pagina 5 de manana seguia devolviendo el aging de
// ayer hasta que alguien editara un cliente. `toDateString()` alcanza
// como clave: no importa la hora exacta, solo si cambio el dia.
function currentDayKey(): string {
  return new Date().toDateString();
}

function getOverdueSnapshot(): OverdueSnapshotEntry[] {
  const day = currentDayKey();
  if (
    overdueSnapshotCache &&
    overdueSnapshotCache.computedFor === clientsStore &&
    overdueSnapshotCache.computedOnDay === day
  ) {
    return overdueSnapshotCache.snapshot;
  }
  const snapshot = computeOverdueSnapshot(clientsStore);
  overdueSnapshotCache = { computedFor: clientsStore, computedOnDay: day, snapshot };
  return snapshot;
}

// dateFrom/dateTo (DateRangeFilter, tarea transversal) filtran por
// `dueDate` de las facturas VENCIDAS — dimension ADICIONAL e
// independiente del tramo de aging, que sigue calculandose igual que
// antes (relativo a HOY, ver bucketForDays/imputeOpenInvoices, sin
// tocar). Se aplica DESPUES de leer el cache del dia (nunca invalida
// ni reconstruye overdueSnapshotCache: ese sigue siendo invariante
// respecto de la consulta, ver el comentario de mas arriba) — recorta
// `openInvoices` de cada entrada cacheada al rango pedido y recomputa
// oldest/overdueByCurrency SOLO sobre ese subconjunto via
// buildOverdueRow. Un cliente sin ninguna factura vencida dentro del
// rango desaparece de este scope, igual que "al dia" en M8.
function applyDateRangeToSnapshot(
  snapshot: OverdueSnapshotEntry[],
  dateFrom: string | undefined,
  dateTo: string | undefined
): OverdueSnapshotEntry[] {
  if (!dateFrom && !dateTo) return snapshot;

  const result: OverdueSnapshotEntry[] = [];
  for (const entry of snapshot) {
    const openInvoices = entry.openInvoices.filter((inv) => isWithinDateRange(inv.dueDate, dateFrom, dateTo));
    const row = buildOverdueRow(entry.row, openInvoices);
    if (!row) continue;
    result.push({ row, openInvoices });
  }
  return result;
}

// Suma nominal entre monedas SOLO para ordenar (nunca se muestra este
// numero en la UI, y no hay orden clickeable expuesto todavia — ver
// M4/3.4). No es el mismo error que C1: ahi se mostraba un total
// combinado como si fuera plata real; aca es un criterio de
// desempate interno que nunca llega a pantalla. Si el dia de manana
// se agregan monedas de magnitud muy distinta (ej. una con miles de
// unidades por peso) esta heuristica dejaria de ordenar de forma util
// y habria que revisarla — documentado a proposito para no perderlo.
function totalOverdueForSorting(row: OverdueClientRow): number {
  return row.overdueByCurrency.reduce((sum, entry) => sum + entry.amount, 0);
}

function compareOverdueRows(a: OverdueClientRow, b: OverdueClientRow, field: OverdueClientsSortField): number {
  switch (field) {
    case 'overdueAmount':
      return totalOverdueForSorting(a) - totalOverdueForSorting(b);
    case 'oldestDueDate':
      return a.oldestOverdueDays - b.oldestOverdueDays;
    case 'clientName':
    default:
      return a.clientName.localeCompare(b.clientName);
  }
}

// Compartido entre getOverdueClientsPage y exportOverdueClients (no se
// duplica la logica de orden entre paginado y export).
function sortOverdueEntries(
  entries: OverdueSnapshotEntry[],
  sort: { field: OverdueClientsSortField; direction: 'asc' | 'desc' } | undefined
): OverdueSnapshotEntry[] {
  const sortField = sort?.field ?? 'oldestDueDate';
  const direction = sort?.direction ?? 'desc'; // mas vencido primero por default, tiene mas sentido para cobranzas
  return [...entries].sort((a, b) => {
    const cmp = compareOverdueRows(a.row, b.row, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.3).
    return primary !== 0 ? primary : a.row.clientId.localeCompare(b.row.clientId);
  });
}

// Agregados por tramo (M4): sobre TODAS las facturas vencidas de los
// clientes que matchean la busqueda (search SI acota el universo, como
// branchId+date en logistics), sin aplicar el filtro de tramo — asi el
// resumen de aging no cambia segun cual tramo este seleccionado, mismo
// criterio que DeliveryAggregates en deliveries.service.ts. clientCount
// cuenta clientes distintos con al menos una factura vencida en ese
// tramo especifico (un cliente con facturas en dos tramos cuenta en
// los dos — reporte de antiguedad de saldos estandar).
function computeAggregates(entries: OverdueSnapshotEntry[]): OverdueClientsAggregates {
  const totals = new Map<string, AgingBucketAggregate>(); // key = `${bucket}:${currency}`
  const clientsSeen = new Map<string, Set<string>>(); // key = `${bucket}:${currency}` -> set de clientId

  for (const entry of entries) {
    for (const inv of entry.openInvoices) {
      const bucket = inv.bucket as AgingBucket;
      const key = `${bucket}:${inv.currency}`;
      const current = totals.get(key) ?? { bucket, currency: inv.currency, totalOverdue: 0, clientCount: 0 };
      current.totalOverdue += inv.openBalance;
      totals.set(key, current);

      const seen = clientsSeen.get(key) ?? new Set<string>();
      seen.add(entry.row.clientId);
      clientsSeen.set(key, seen);
    }
  }

  for (const [key, bucketTotal] of totals) {
    bucketTotal.clientCount = clientsSeen.get(key)?.size ?? 0;
  }

  // Devuelve siempre los 4 tramos (en orden), en 0 si no hay datos —
  // asi el resumen de aging no "salta" columnas cuando un tramo queda
  // vacio tras una busqueda.
  const currencies = new Set<Currency>(totals.size > 0 ? [...totals.values()].map((t) => t.currency) : (['ARS'] as Currency[]));
  const byBucket: AgingBucketAggregate[] = [];
  for (const currency of currencies) {
    for (const bucket of AGING_BUCKETS) {
      byBucket.push(totals.get(`${bucket}:${currency}`) ?? { bucket, currency, totalOverdue: 0, clientCount: 0 });
    }
  }
  return { byBucket };
}

export async function getOverdueClientsPage(
  query: PageQuery<OverdueClientsQueryFilters, OverdueClientsSortField>,
  signal?: AbortSignal
): Promise<PageResult<OverdueClientRow, OverdueClientsAggregates>> {
  return httpClient.request<PageResult<OverdueClientRow, OverdueClientsAggregates>>({
    method: 'GET',
    path: '/clients/overdue',
    params: {
      search: query.filters.search,
      bucket: query.filters.bucket,
      dateFrom: query.filters.dateFrom,
      dateTo: query.filters.dateTo,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query;
      const snapshot = applyDateRangeToSnapshot(getOverdueSnapshot(), filters.dateFrom, filters.dateTo);

      const inScope = snapshot.filter((entry) =>
        matchesSearch(entry.row.clientName, entry.row.cuit, filters.search)
      );

      const aggregates = computeAggregates(inScope);

      const filtered = filters.bucket
        ? inScope.filter((entry) => entry.row.oldestBucket === filters.bucket)
        : inScope;

      const sorted = sortOverdueEntries(filtered, sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize).map((entry) => entry.row);

      return {
        items: structuredClone(items),
        total,
        page: safePage,
        pageSize,
        aggregates,
      };
    },
  });
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros+tramo, sin paginar, hasta MAX_EXPORT_ROWS. Reusa
// applyDateRangeToSnapshot/sortOverdueEntries (misma logica que
// getOverdueClientsPage, no duplicada).
export async function exportOverdueClients(
  filters: OverdueClientsQueryFilters,
  sort?: { field: OverdueClientsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<OverdueClientRow>> {
  return httpClient.request<ExportResult<OverdueClientRow>>({
    method: 'GET',
    path: '/clients/overdue/export',
    params: { search: filters.search, bucket: filters.bucket, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    mock: () => {
      const snapshot = applyDateRangeToSnapshot(getOverdueSnapshot(), filters.dateFrom, filters.dateTo);
      const inScope = snapshot.filter((entry) => matchesSearch(entry.row.clientName, entry.row.cuit, filters.search));
      const filtered = filters.bucket ? inScope.filter((entry) => entry.row.oldestBucket === filters.bucket) : inScope;
      const sorted = sortOverdueEntries(filtered, sort);

      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS).map((entry) => entry.row);

      return { items: structuredClone(items), truncated };
    },
  });
}
