import type { AuditLogItem } from '@/shared/types/settings.types';
import { SETTINGS_MOCK_AUDIT } from '@/data/mock/settings.data';
import { httpClient } from '@/shared/api/httpClient';
import type { AuditLogItemDTO } from './dto';
import { auditLogItemFromDTO, auditLogItemToDTO } from './mapper';

// ============================================================
// audit.service — Único punto que habla con httpClient para el
// Registro de Auditoría (Tanda 3c de escalabilidad). Sin branchId
// (confirmado contra el código): la auditoría es de la empresa.
//
// Sin mutaciones: nada en el proyecto genera entradas de auditoría
// reales hoy — exponer un "createAuditLogEntry" sin ningún llamador
// sería una API muerta, no se agrega. Sin paginación: es un feed
// chico de sidebar (ver AuditLogWidget.tsx), se consume vía
// useCachedQuery en el componente.
// ============================================================

// const, no let: sin mutaciones (ver comentario del encabezado).
const auditLogDTOStore: AuditLogItemDTO[] = SETTINGS_MOCK_AUDIT.map(auditLogItemToDTO);

// El orden del store ya es cronológico por construcción (más
// reciente primero) — `timestamp` es un string relativo ("Hace 5
// min", "Ayer"), no un ISO date, así que no hay ningún campo por el
// que ordenar de verdad. Se devuelve el store tal cual, mismo
// comportamiento que el `.map()` directo de AuditLogWidget.tsx antes
// de esta tanda.
export async function getRecentAuditLog(empresaId: string, signal?: AbortSignal): Promise<AuditLogItem[]> {
  const dtos = await httpClient.request<AuditLogItemDTO[]>({
    method: 'GET',
    path: '/settings/audit-log',
    params: { empresaId },
    signal,
    mock: () => auditLogDTOStore,
  });
  return dtos.map(auditLogItemFromDTO);
}
