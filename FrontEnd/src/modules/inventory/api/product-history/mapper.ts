import type { ProductHistoryEvent } from '@/shared/types/inventory.types';
import { asBranchId } from '@/shared/types/ids.types';
import type { ProductHistoryEventDTO } from './dto';

// ============================================================
// mapper.ts (product-history) — Único lugar que traduce DTO↔dominio.
// Nada fuera de `product-history.service.ts` lo importa.
// ============================================================

export function productHistoryEventFromDTO(dto: ProductHistoryEventDTO): ProductHistoryEvent {
  return {
    id: dto.id,
    date: dto.fecha,
    sku: dto.sku,
    productName: dto.nombre_producto,
    eventType: dto.tipo_evento,
    description: dto.descripcion,
    user: dto.usuario,
    branchId: asBranchId(dto.sucursal_id),
  };
}

// Usada solo para sembrar el store desde data/mock/inventory.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function productHistoryEventToDTO(event: ProductHistoryEvent): ProductHistoryEventDTO {
  return {
    id: event.id,
    fecha: event.date,
    sku: event.sku,
    nombre_producto: event.productName,
    tipo_evento: event.eventType,
    descripcion: event.description,
    usuario: event.user,
    sucursal_id: event.branchId,
  };
}
