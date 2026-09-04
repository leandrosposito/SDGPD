import type { InvoiceRecord } from '@/shared/types/settings.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { SETTINGS_MOCK_INVOICES } from '@/data/mock/settings.data';
import { httpClient } from '@/shared/api/httpClient';
import type { InvoiceRecordDTO, InvoicesPageDTO } from './dto';
import { invoiceFromDTO, invoiceToDTO } from './mapper';

// ============================================================
// subscription.service — Único punto que habla con httpClient para
// el Historial de Cobros (Tanda 3c de escalabilidad). Sin branchId
// (confirmado contra el código): la suscripción es de la empresa.
//
// Sin mutaciones: "Actualizar Medio de Pago" (TabSubscription.tsx) no
// tiene ningún `onClick` — decorativo desde antes de esta tanda, no
// se le inventa una acción acá. La card "Plan Actual" tampoco se
// migra (texto hardcodeado, sin dato real detrás — ver dto.ts).
// ============================================================

export interface InvoicesQueryFilters {
  empresaId: string;
}

export type InvoicesSortField = 'date';

// const, no let: sin mutaciones (ver comentario del encabezado).
const invoicesDTOStore: InvoiceRecordDTO[] = SETTINGS_MOCK_INVOICES.map(invoiceToDTO);

// `fecha` es DD/MM/YYYY (no ISO) — un localeCompare de texto
// ordenaría mal (compara el día antes que el año). Se parsea a un
// timestamp comparable para que el orden sea correcto de verdad,
// aunque hoy la UI no expone ningún selector de orden.
function parseInvoiceDate(fecha: string): number {
  const [day, month, year] = fecha.split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function compareInvoices(a: InvoiceRecordDTO, b: InvoiceRecordDTO): number {
  return parseInvoiceDate(a.fecha) - parseInvoiceDate(b.fecha);
}

function resolveMockInvoicesPage(query: PageQuery<InvoicesQueryFilters, InvoicesSortField>): InvoicesPageDTO {
  const direction = query.sort?.direction ?? 'desc'; // mas reciente primero, mismo orden que el mock
  const sorted = [...invoicesDTOStore].sort((a, b) => {
    const cmp = compareInvoices(a, b);
    return direction === 'asc' ? cmp : -cmp;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize),
    meta: { total, page: safePage, page_size: query.pageSize },
  };
}

export async function getInvoicesPage(
  query: PageQuery<InvoicesQueryFilters, InvoicesSortField>,
  signal?: AbortSignal
): Promise<PageResult<InvoiceRecord>> {
  const pageDTO = await httpClient.request<InvoicesPageDTO>({
    method: 'GET',
    path: '/settings/invoices',
    params: { empresaId: query.filters.empresaId, page: query.page, pageSize: query.pageSize },
    signal,
    mock: () => resolveMockInvoicesPage(query),
  });

  return {
    items: pageDTO.data.map(invoiceFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}
