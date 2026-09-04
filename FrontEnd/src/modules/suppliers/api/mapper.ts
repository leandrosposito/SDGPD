import type { Supplier, SupplierProduct } from '@/shared/types/supplier.types';
import type { CreateSupplierDTO, SupplierDTO, SupplierProductDTO } from './dto';

// ============================================================
// mapper.ts — Unico lugar del proyecto que sabe traducir entre la
// forma del backend (dto.ts) y el modelo de dominio
// (shared/types/supplier.types.ts). Nada fuera de suppliers.service.ts
// llama a estas funciones — ni un componente, ni otro modulo.
//
// SupplierFormInput vive aca (no en suppliers.service.ts) para que
// mapper.ts no dependa del service — evita un ciclo de import entre
// los dos archivos de api/. suppliers.service.ts la re-exporta para
// que los consumidores externos (SupplierFormModal.tsx) sigan
// importandola desde el service, que es su punto de entrada publico.
// ============================================================

export type SupplierFormInput = Pick<Supplier, 'name' | 'cuit' | 'category' | 'phone' | 'contactEmail'>;

function productFromDTO(dto: SupplierProductDTO): SupplierProduct {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.nombre,
    category: dto.rubro,
    cost: dto.costo,
    lastUpdate: dto.actualizado_en,
  };
}

export function supplierFromDTO(dto: SupplierDTO): Supplier {
  return {
    id: dto.id,
    name: dto.razon_social,
    cuit: dto.cuit,
    phone: dto.telefono,
    contactName: dto.contacto.nombre,
    contactEmail: dto.contacto.email,
    address: dto.direccion.calle,
    city: dto.direccion.ciudad,
    paymentTerms: dto.condiciones_pago,
    category: dto.rubro,
    pendingOrdersCount: dto.cuenta.ordenes_pendientes,
    daysUntilExpiration: dto.cuenta.dias_hasta_vencimiento,
    currentBalance: dto.cuenta.saldo_actual,
    hasOverdueDebt: dto.cuenta.tiene_deuda_vencida,
    products: dto.productos.map(productFromDTO),
  };
}

// Direccion inversa (dominio -> DTO), usada solo para sembrar el mock
// en forma de DTO a partir de data/mock/suppliers.data.ts (que sigue
// en forma de dominio — no se duplico a mano en forma de DTO, ver
// suppliers.service.ts). Un backend real nunca la necesitaria (el
// dominio nace de deserializar SU DTO, no al reves) pero acá cumple
// el rol de "seed" del store en memoria.
export function supplierToDTO(supplier: Supplier): SupplierDTO {
  return {
    id: supplier.id,
    razon_social: supplier.name,
    cuit: supplier.cuit,
    telefono: supplier.phone,
    rubro: supplier.category,
    condiciones_pago: supplier.paymentTerms,
    contacto: { nombre: supplier.contactName, email: supplier.contactEmail },
    direccion: { calle: supplier.address, ciudad: supplier.city },
    cuenta: {
      ordenes_pendientes: supplier.pendingOrdersCount,
      dias_hasta_vencimiento: supplier.daysUntilExpiration,
      saldo_actual: supplier.currentBalance,
      tiene_deuda_vencida: supplier.hasOverdueDebt,
    },
    productos: supplier.products.map((p) => ({
      id: p.id,
      sku: p.sku,
      nombre: p.name,
      rubro: p.category,
      costo: p.cost,
      actualizado_en: p.lastUpdate,
    })),
  };
}

// Dominio (input de formulario) -> DTO de alta/edicion. `empresaId`
// viaja explicito (no se lee de ningun store aca — mismo criterio que
// branchId en el resto de los services, ver DECISIONES_TECNICAS.md).
export function supplierFormInputToDTO(empresaId: string, input: SupplierFormInput): CreateSupplierDTO {
  return {
    empresa_id: empresaId,
    razon_social: input.name,
    cuit: input.cuit,
    rubro: input.category,
    telefono: input.phone,
    contacto: { email: input.contactEmail },
  };
}
