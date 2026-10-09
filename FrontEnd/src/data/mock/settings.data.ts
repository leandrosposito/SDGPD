import type { Action, Module, Permission, Role, User } from '@sdgpd/contracts';
import type { AuditLogItem, InvoiceRecord } from '@/shared/types/settings.types';
import { MOCK_ALL_PERMISSIONS } from '@/data/mock/session.mock';

// BE-1b: usuarios y roles con la forma del contrato (@sdgpd/contracts). Los 4
// roles iniciales y sus matrices son los mismos que siembra el backend
// (BackEnd/src/auth/default-roles.ts); se repiten aca porque el mock no puede
// importar codigo del backend. Las sucursales son las 4 de la empresa demo
// (UUID fijos, session.mock.ts).
const grant = (module: Module, ...actions: Action[]): Permission[] => actions.map((action) => ({ module, action }));
const CENTRO = '0192f000-0000-7000-8000-000000000001';
const NORTE = '0192f000-0000-7000-8000-000000000002';
const SUR = '0192f000-0000-7000-8000-000000000003';

export const SETTINGS_MOCK_ROLES: Role[] = [
  { id: 'role-admin', name: 'Admin', version: 1, permissions: [...MOCK_ALL_PERMISSIONS] },
  {
    id: 'role-vendedor',
    name: 'Vendedor',
    version: 1,
    permissions: [
      ...grant('dashboard', 'ver'),
      ...grant('orders', 'ver', 'crear', 'editar', 'anular'),
      ...grant('clients', 'ver', 'crear', 'editar'),
      ...grant('inventory', 'ver'),
    ],
  },
  { id: 'role-chofer', name: 'Chofer', version: 1, permissions: grant('logistics', 'ver', 'editar') },
  {
    id: 'role-deposito',
    name: 'Deposito',
    version: 1,
    permissions: [
      ...grant('dashboard', 'ver'),
      ...grant('inventory', 'ver', 'crear', 'editar'),
      ...grant('logistics', 'ver', 'editar'),
      ...grant('compras', 'ver', 'crear', 'editar'),
      ...grant('suppliers', 'ver'),
    ],
  },
];

const CREATED = '2026-09-01T12:00:00.000Z';
export const SETTINGS_MOCK_USERS: User[] = [
  { id: 'usr-1', fullName: 'Administrador General', email: 'admin@distribuidora.com', roleId: 'role-admin', active: true, branchIds: [CENTRO, NORTE, SUR], version: 1, createdAt: CREATED },
  { id: 'usr-2', fullName: 'Vendedor Centro', email: 'ventas1@distribuidora.com', roleId: 'role-vendedor', active: true, branchIds: [CENTRO], version: 1, createdAt: CREATED },
  { id: 'usr-3', fullName: 'Vendedor Norte', email: 'ventas2@distribuidora.com', roleId: 'role-vendedor', active: false, branchIds: [NORTE], version: 1, createdAt: CREATED },
  { id: 'usr-4', fullName: 'Chofer Principal', email: 'logistica@distribuidora.com', roleId: 'role-chofer', active: true, branchIds: [CENTRO, SUR], version: 1, createdAt: CREATED },
  { id: 'usr-5', fullName: 'Encargado Deposito', email: 'deposito@distribuidora.com', roleId: 'role-deposito', active: true, branchIds: [SUR], version: 1, createdAt: CREATED },
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
