import type { InventoryMovement } from '@/shared/types/inventory.types';
import { asBranchId } from '@/shared/types/ids.types';
import type { InventoryMovementDTO } from './dto';

// ============================================================
// mapper.ts (movements) — Único lugar que traduce DTO↔dominio. Nada
// fuera de `movements.service.ts` lo importa.
// ============================================================

export function inventoryMovementFromDTO(dto: InventoryMovementDTO): InventoryMovement {
  return {
    id: dto.id,
    date: dto.fecha,
    sku: dto.sku,
    productName: dto.nombre_producto,
    type: dto.tipo,
    quantity: dto.cantidad,
    user: dto.usuario,
    notes: dto.notas,
    branchId: asBranchId(dto.sucursal_id),
  };
}

// Usada solo para sembrar el store desde data/mock/inventory.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function inventoryMovementToDTO(item: InventoryMovement): InventoryMovementDTO {
  return {
    id: item.id,
    fecha: item.date,
    sku: item.sku,
    nombre_producto: item.productName,
    tipo: item.type,
    cantidad: item.quantity,
    usuario: item.user,
    notas: item.notes,
    sucursal_id: item.branchId,
  };
}
