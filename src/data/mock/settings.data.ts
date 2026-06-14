import type { AuditLogItem, InvoiceRecord, PermissionMatrix, UserAccount } from '../../types/settings.types';

export const SETTINGS_MOCK_USERS: UserAccount[] = [
  { id: 'usr-1', name: 'Administrador General', email: 'admin@distribuidora.com', role: 'Admin', status: 'active' },
  { id: 'usr-2', name: 'Vendedor Centro', email: 'ventas1@distribuidora.com', role: 'Vendedor', status: 'active' },
  { id: 'usr-3', name: 'Vendedor Norte', email: 'ventas2@distribuidora.com', role: 'Vendedor', status: 'inactive' },
  { id: 'usr-4', name: 'Chofer Principal', email: 'logistica@distribuidora.com', role: 'Chofer', status: 'active' },
  { id: 'usr-5', name: 'Encargado Deposito', email: 'deposito@distribuidora.com', role: 'Deposito', status: 'active' },
];

export const SETTINGS_MOCK_PERMISSIONS: PermissionMatrix[] = [
  {
    role: 'Admin',
    modules: { dashboard: true, pedidos: true, inventario: true, clientes: true, proveedores: true, logistica: true, caja: true, analitica: true }
  },
  {
    role: 'Vendedor',
    modules: { dashboard: true, pedidos: true, inventario: false, clientes: true, proveedores: false, logistica: false, caja: false, analitica: false }
  },
  {
    role: 'Chofer',
    modules: { dashboard: false, pedidos: false, inventario: false, clientes: false, proveedores: false, logistica: true, caja: false, analitica: false }
  },
  {
    role: 'Deposito',
    modules: { dashboard: false, pedidos: false, inventario: true, clientes: false, proveedores: true, logistica: false, caja: false, analitica: false }
  }
];

export const SETTINGS_MOCK_AUDIT: AuditLogItem[] = [
  { id: 'log-1', timestamp: 'Hace 5 min', user: 'Admin', action: 'Modificó Permisos', details: 'Acceso a Caja removido para Vendedor' },
  { id: 'log-2', timestamp: 'Hace 1 hora', user: 'Admin', action: 'Actualizó Precio', details: 'Lista Mayorista +15%' },
  { id: 'log-3', timestamp: 'Ayer', user: 'Vendedor Centro', action: 'Inicio de Sesión', details: 'IP: 192.168.0.45' },
  { id: 'log-4', timestamp: 'Hace 2 días', user: 'Admin', action: 'Exportó Base de Datos', details: 'Backup Completo generado' },
];

export const SETTINGS_MOCK_INVOICES: InvoiceRecord[] = [
  { id: 'inv-001', date: '01/06/2026', amount: 15000, status: 'paid', plan: 'Premium SaaS' },
  { id: 'inv-002', date: '01/05/2026', amount: 15000, status: 'paid', plan: 'Premium SaaS' },
  { id: 'inv-003', date: '01/04/2026', amount: 15000, status: 'paid', plan: 'Premium SaaS' },
];
