import type { AuditLogItem } from '@/shared/types/settings.types';
import type { AuditLogItemDTO } from './dto';

// ============================================================
// mapper.ts (settings/audit) — Único lugar que traduce DTO↔dominio
// para el Registro de Auditoría. Nada fuera de `audit.service.ts` lo
// importa.
// ============================================================

export function auditLogItemFromDTO(dto: AuditLogItemDTO): AuditLogItem {
  return {
    id: dto.id,
    timestamp: dto.fecha,
    user: dto.usuario,
    action: dto.accion,
    details: dto.detalle,
  };
}

// Usada SOLO para sembrar el mock desde data/mock/settings.data.ts.
export function auditLogItemToDTO(item: AuditLogItem): AuditLogItemDTO {
  return {
    id: item.id,
    fecha: item.timestamp,
    usuario: item.user,
    accion: item.action,
    detalle: item.details,
  };
}
