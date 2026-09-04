// ============================================================
// dto.ts — Forma que tendria la respuesta de un backend real para
// Proveedores. Deliberadamente DISTINTA del tipo de dominio
// (shared/types/supplier.types.ts): snake_case, campos agrupados
// (contacto/direccion/cuenta) en vez de planos — asi el mapper (
// mapper.ts) tiene algo real que traducir, en vez de ser un pasamano
// que copia campos 1 a 1 con otro nombre de tipo (eso no probaria
// nada distinto de la ausencia de capa que señala el hallazgo #1,
// AUDITORIA_ESCALABILIDAD.md). Nadie fuera de api/ importa este
// archivo — ni el resto de modules/suppliers, ni ningun otro modulo.
// ============================================================

export interface SupplierContactDTO {
  nombre: string;
  email: string;
}

export interface SupplierAddressDTO {
  calle: string;
  ciudad: string;
}

// "Cuenta" agrupa lo financiero/comercial del proveedor — separado de
// los datos de contacto porque en un backend real esto probablemente
// salga de un sistema distinto (cuentas corrientes) que el ABM de
// proveedores en si.
export interface SupplierAccountDTO {
  ordenes_pendientes: number;
  dias_hasta_vencimiento: number | null;
  saldo_actual: number;
  tiene_deuda_vencida: boolean;
}

export interface SupplierProductDTO {
  id: string;
  sku: string;
  nombre: string;
  rubro: string;
  costo: number;
  actualizado_en: string;
}

export interface SupplierDTO {
  id: string;
  razon_social: string;
  cuit: string;
  telefono: string;
  rubro: string;
  condiciones_pago: string;
  contacto: SupplierContactDTO;
  direccion: SupplierAddressDTO;
  cuenta: SupplierAccountDTO;
  productos: SupplierProductDTO[];
}

// Envoltorio de lista paginada tal como lo devolveria el backend real
// — NO es PageResult (shared/types/pagination.types.ts): ese es el
// contrato ya interno del frontend (P2, DECISIONES_TECNICAS.md), este
// es la forma de la respuesta HTTP cruda que el mapper traduce a
// PageResult<Supplier, undefined> dentro de suppliers.service.ts.
export interface SuppliersPageDTO {
  data: SupplierDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}

// Payload de alta — solo los campos que el formulario de verdad pide
// (SupplierFormInput), en forma de DTO. Los campos que el backend
// completaria solo (id, cuenta en cero, sin productos todavia) no
// viajan.
export interface CreateSupplierDTO {
  empresa_id: string;
  razon_social: string;
  cuit: string;
  rubro: string;
  telefono: string;
  contacto: Pick<SupplierContactDTO, 'email'>;
}

export type UpdateSupplierDTO = CreateSupplierDTO;
