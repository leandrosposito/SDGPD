// ============================================================
// SHARED TYPE DEFINITIONS — Settings domain
//
// BE-1b: usuarios y roles ya no se definen aca. Son los del contrato
// (@sdgpd/contracts: User, Role, Permission), el mismo que valida el
// backend (ADR-BE-003 § Decision 2: SessionUser y el usuario de Settings
// son proyecciones de la misma tabla). Se borraron SystemRole, UserAccount
// y la matriz de 8 booleanos (PermissionMatrix): la matriz es modulo ×
// accion, 10 modulos × 7 acciones.
// ============================================================

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface InvoiceRecord {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending';
  plan: string;
}
