// ============================================================
// dto.ts (settings/audit) — Forma que tendría la respuesta de un
// backend real (Tanda 3c de escalabilidad). Sin envoltorio de página
// (`data`/`meta`): AuditLogWidget.tsx es un feed chico de sidebar sin
// paginación, se consulta vía useCachedQuery, no usePagedQuery — ver
// docs/DECISIONES_TECNICAS.md.
// ============================================================

export interface AuditLogItemDTO {
  id: string;
  fecha: string; // string relativo ("Hace 5 min", "Ayer") — no ISO, ver mapper.ts
  usuario: string;
  accion: string;
  detalle: string;
}
