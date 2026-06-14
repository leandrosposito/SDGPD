// ============================================================
// SHARED TYPE DEFINITIONS — Settings domain
// ============================================================

export type SystemRole = 'Admin' | 'Vendedor' | 'Chofer' | 'Deposito';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  status: 'active' | 'inactive';
}

export interface PermissionMatrix {
  role: SystemRole;
  modules: {
    dashboard: boolean;
    pedidos: boolean;
    inventario: boolean;
    clientes: boolean;
    proveedores: boolean;
    logistica: boolean;
    caja: boolean;
    analitica: boolean;
  };
}

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
