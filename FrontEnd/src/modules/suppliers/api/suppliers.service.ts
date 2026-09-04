import type { Supplier } from '@/shared/types/supplier.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { SUPPLIERS_MOCK_DATA } from '@/data/mock/suppliers.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type { SupplierDTO, SuppliersPageDTO } from './dto';
import { supplierFromDTO, supplierToDTO, supplierFormInputToDTO, type SupplierFormInput } from './mapper';

export type { SupplierFormInput };

// ============================================================
// suppliers.service — Unico punto del proyecto que habla con
// httpClient para Proveedores (D1, AUDITORIA_ESCALABILIDAD.md; ver
// tambien la entrada de arquitectura api/ en DECISIONES_TECNICAS.md).
// Todo lo que sale de aca ya esta en forma de dominio (Supplier) —
// SupplierDTO/SuppliersPageDTO nunca cruzan este archivo hacia
// afuera. Modulo piloto: plantilla para migrar los 16 listados
// restantes (ver docs/GUIA_MIGRACION_MODULO.md).
// ============================================================

export interface SuppliersQueryFilters {
  // Todo metodo de este service recibe empresaId explicito desde
  // ahora (aunque hoy el mock no lo use para filtrar de verdad — hay
  // una sola empresa, hallazgo #14 de la auditoria queda fuera de
  // alcance): asi el dia que exista backend real y multiples
  // empresas, el cambio es "que valor se manda", no la firma de cada
  // funcion. Sin branchId a proposito: un proveedor es de la empresa,
  // no de una sucursal (mismo criterio que ClientAccount, M9).
  empresaId: string;
  search?: string;
  category?: string;
}

export type SuppliersSortField = 'name' | 'cuit' | 'currentBalance' | 'category';

// ------------------------------------------------------------
// "Servidor" mock — trabaja en espacio DTO (snake_case, forma de
// backend), no en forma de dominio: un backend real filtra/ordena
// sobre SU propio almacenamiento, no sobre el shape que consume nuestro
// frontend. Sembrado una sola vez desde data/mock/suppliers.data.ts
// (dominio) via supplierToDTO — no se duplico el dataset a mano en
// forma de DTO. Reasignada (nunca mutada in-place) por
// create/update, mismo patron que el resto de services/mock/*.ts.
// ------------------------------------------------------------
let suppliersDTOStore: SupplierDTO[] = SUPPLIERS_MOCK_DATA.map(supplierToDTO);

function matchesFilters(dto: SupplierDTO, filters: SuppliersQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const matchesSearch =
    !search || dto.razon_social.toLowerCase().includes(search) || dto.cuit.includes(search);
  const matchesCategory = !filters.category || dto.rubro === filters.category;
  return matchesSearch && matchesCategory;
}

function compareSuppliers(a: SupplierDTO, b: SupplierDTO, field: SuppliersSortField): number {
  switch (field) {
    case 'cuit':
      return a.cuit.localeCompare(b.cuit);
    case 'category':
      return a.rubro.localeCompare(b.rubro);
    case 'currentBalance':
      return a.cuenta.saldo_actual - b.cuenta.saldo_actual;
    case 'name':
    default:
      return a.razon_social.localeCompare(b.razon_social);
  }
}

// Compartido entre el resolver paginado y exportSuppliers — no se
// duplica filtro+orden entre los dos (mismo criterio que el resto de
// services/*.ts migrados a paginacion server-side).
function filterAndSortSuppliers(
  filters: SuppliersQueryFilters,
  sort: { field: SuppliersSortField; direction: 'asc' | 'desc' } | undefined
): SupplierDTO[] {
  const inScope = suppliersDTOStore.filter((dto) => matchesFilters(dto, filters));
  const sortField = sort?.field ?? 'name';
  const direction = sort?.direction ?? 'asc';
  return [...inScope].sort((a, b) => {
    const cmp = compareSuppliers(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.4, mismo criterio que el resto del
    // proyecto): evita que un proveedor aparezca en dos paginas o en
    // ninguna si el campo de orden empata entre dos filas.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

function resolveMockSuppliersPage(query: PageQuery<SuppliersQueryFilters, SuppliersSortField>): SuppliersPageDTO {
  const sorted = filterAndSortSuppliers(query.filters, query.sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  // Igual criterio que el resto de PageResult: si la pagina pedida
  // quedo fuera de rango, se devuelve la ultima valida.
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize),
    meta: { total, page: safePage, page_size: query.pageSize },
  };
}

// fetchPage de usePagedQuery (Paso 3c): unico consumidor de esta
// firma es SuppliersPage. El segundo parametro (`signal`) lo agrega
// esta tanda a usePagedQuery (retrocompatible: los 5 fetchPage ya
// migrados que no lo declaran simplemente lo ignoran) para que
// cancelar una busqueda en vuelo corte de verdad el trabajo pendiente
// via httpClient/AbortController, no solo descarte la respuesta tarde
// (mata el hallazgo #9, AUDITORIA_ESCALABILIDAD.md).
export async function fetchSuppliersPage(
  query: PageQuery<SuppliersQueryFilters, SuppliersSortField>,
  signal?: AbortSignal
): Promise<PageResult<Supplier, undefined>> {
  const pageDTO = await httpClient.request<SuppliersPageDTO>({
    method: 'GET',
    path: '/suppliers',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      category: query.filters.category,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => resolveMockSuppliersPage(query),
  });

  return {
    items: pageDTO.data.map(supplierFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

// Trae TODO lo filtrado sin paginar, hasta MAX_EXPORT_ROWS — mismo
// patron que exportDeliveries/exportPurchaseOrders/exportOverdueClients
// (P1/Tarea C, DECISIONES_TECNICAS.md): reusa filterAndSortSuppliers,
// no duplica la logica de filtro+orden del listado paginado.
export async function exportSuppliers(
  filters: SuppliersQueryFilters,
  sort?: { field: SuppliersSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<Supplier>> {
  const sorted = await httpClient.request<SupplierDTO[]>({
    method: 'GET',
    path: '/suppliers/export',
    params: { empresaId: filters.empresaId, search: filters.search, category: filters.category },
    mock: () => filterAndSortSuppliers(filters, sort),
  });

  const truncated = sorted.length > MAX_EXPORT_ROWS;
  return { items: sorted.slice(0, MAX_EXPORT_ROWS).map(supplierFromDTO), truncated };
}

// Usado hoy por ComprasPage/InventoryPage (poblar un <select> de
// proveedores, no un listado paginado) y por SuppliersPage para su
// propio panel de detalle/formulario. Sin filtros/paginacion — trae
// todo lo de la empresa, mismo alcance que el fetchSuppliers() previo
// a esta tanda.
export async function fetchSuppliers(empresaId: string): Promise<Supplier[]> {
  const dtos = await httpClient.request<SupplierDTO[]>({
    method: 'GET',
    path: '/suppliers',
    params: { empresaId },
    mock: () => suppliersDTOStore,
  });
  return dtos.map(supplierFromDTO);
}

export async function createSupplier(empresaId: string, input: SupplierFormInput): Promise<Supplier> {
  const dto = await httpClient.request<SupplierDTO>({
    method: 'POST',
    path: '/suppliers',
    body: supplierFormInputToDTO(empresaId, input),
    mock: () => {
      if (!input.name || !input.cuit) {
        throw new ApiError(400, 'CLIENT_ERROR', 'Razon Social y CUIT son obligatorios.');
      }
      const newDTO: SupplierDTO = {
        id: `sup-${Date.now()}`,
        razon_social: input.name,
        cuit: input.cuit,
        telefono: input.phone,
        rubro: input.category,
        condiciones_pago: '',
        contacto: { nombre: '', email: input.contactEmail },
        direccion: { calle: '', ciudad: '' },
        cuenta: {
          ordenes_pendientes: 0,
          dias_hasta_vencimiento: null,
          saldo_actual: 0,
          tiene_deuda_vencida: false,
        },
        productos: [],
      };
      suppliersDTOStore = [...suppliersDTOStore, newDTO];
      return newDTO;
    },
  });
  return supplierFromDTO(dto);
}

export async function updateSupplier(empresaId: string, id: string, input: SupplierFormInput): Promise<Supplier> {
  const dto = await httpClient.request<SupplierDTO>({
    method: 'PUT',
    path: `/suppliers/${id}`,
    body: supplierFormInputToDTO(empresaId, input),
    mock: () => {
      if (!input.name || !input.cuit) {
        throw new ApiError(400, 'CLIENT_ERROR', 'Razon Social y CUIT son obligatorios.');
      }
      const existing = suppliersDTOStore.find((s) => s.id === id);
      if (!existing) {
        throw new ApiError(404, 'CLIENT_ERROR', 'El proveedor que intenta editar ya no existe.');
      }
      const updated: SupplierDTO = {
        ...existing,
        razon_social: input.name,
        cuit: input.cuit,
        telefono: input.phone,
        rubro: input.category,
        contacto: { ...existing.contacto, email: input.contactEmail },
      };
      suppliersDTOStore = suppliersDTOStore.map((s) => (s.id === id ? updated : s));
      return updated;
    },
  });
  return supplierFromDTO(dto);
}
