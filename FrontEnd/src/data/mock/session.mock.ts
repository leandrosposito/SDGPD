import type { Action, Module, Permission } from '@sdgpd/contracts';
import type { SessionUser } from '@/shared/types/session.types';
import { asBranchId } from '@/shared/types/ids.types';

// ============================================================
// MOCK DATA — Session (empresa, usuario y sucursales)
// Una empresa, un usuario, 3 sucursales activas + 1 inactiva
// (branch-004). La inactiva no tiene entregas asignadas en
// logistics.data.ts a proposito: una sucursal inactiva no deberia
// ser alcanzable, y si tuviera datos ocultaria el problema si el
// rechazo de setActiveBranch fallara silenciosamente.
//
// BE-1b: la empresa y las 4 sucursales usan los MISMOS UUID fijos que el
// seed de desarrollo del backend (BackEnd/scripts/db/demo-ids.ts; lo
// verifica scripts/verificacion/v18-ids-demo.mjs). En los comentarios de
// los otros mocks, "branch-001".."branch-004" siguen nombrando a Centro,
// Norte, Sur y Villa Maria (ids ...0001 a ...0004). El usuario mock es Admin
// con toda la matriz: en modo mock todos los botones se ven, como antes.
// ============================================================

// Record<..., true>: TS exige los 10 modulos y las 7 acciones del contrato,
// sin importar valores de @sdgpd/contracts en runtime (los scripts de node
// que cargan este mock no lo necesitan compilado).
const ALL_MODULES: Record<Module, true> = {
  analytics: true,
  cash: true,
  clients: true,
  compras: true,
  dashboard: true,
  inventory: true,
  logistics: true,
  orders: true,
  settings: true,
  suppliers: true,
};
const ALL_ACTIONS: Record<Action, true> = {
  ver: true,
  crear: true,
  editar: true,
  anular: true,
  aprobar: true,
  exportar: true,
  forzar: true,
};
function keysOf<K extends string>(record: Record<K, true>): K[] {
  return Object.keys(record).filter((k): k is K => k in record);
}
export const MOCK_ALL_PERMISSIONS: readonly Permission[] = keysOf(ALL_MODULES).flatMap((module) =>
  keysOf(ALL_ACTIONS).map((action) => ({ module, action }))
);

export const SESSION_MOCK_DATA: SessionUser = {
  id: 'user-001',
  fullName: 'Lucia Fernandez',
  email: 'lucia.fernandez@distribuidora-lp.com.ar',
  company: {
    id: '01a121ca-8df0-7552-9004-881c8ee2a687',
    name: 'Distribuidora La Proveedora S.A.',
  },
  role: { id: 'role-admin', name: 'Admin' },
  permissions: MOCK_ALL_PERMISSIONS,
  branches: [
    {
      id: asBranchId('0192f000-0000-7000-8000-000000000001'),
      name: 'Sucursal Centro',
      code: 'CTR',
      city: 'Cordoba',
      address: 'Av. Colon 1234',
      status: 'active',
    },
    {
      id: asBranchId('0192f000-0000-7000-8000-000000000002'),
      name: 'Sucursal Norte',
      code: 'NOR',
      city: 'Cordoba',
      address: 'Av. Rafael Nunez 4567',
      status: 'active',
    },
    {
      id: asBranchId('0192f000-0000-7000-8000-000000000003'),
      name: 'Sucursal Sur',
      code: 'SUR',
      city: 'Cordoba',
      address: 'Bv. Los Granaderos 890',
      status: 'active',
    },
    {
      id: asBranchId('0192f000-0000-7000-8000-000000000004'),
      name: 'Sucursal Villa Maria (cerrada)',
      code: 'VMA',
      city: 'Villa Maria',
      address: 'Av. San Martin 210',
      status: 'inactive',
    },
  ],
  defaultBranchId: asBranchId('0192f000-0000-7000-8000-000000000001'),
};
