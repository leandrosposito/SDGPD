import type { SessionUser } from '@/shared/types/session.types';

// ============================================================
// MOCK DATA — Session (empresa, usuario y sucursales)
// Una empresa, un usuario, 3 sucursales activas + 1 inactiva
// (branch-004). La inactiva no tiene entregas asignadas en
// logistics.data.ts a proposito: una sucursal inactiva no deberia
// ser alcanzable, y si tuviera datos ocultaria el problema si el
// rechazo de setActiveBranch fallara silenciosamente.
// ============================================================

export const SESSION_MOCK_DATA: SessionUser = {
  id: 'user-001',
  fullName: 'Lucia Fernandez',
  email: 'lucia.fernandez@distribuidora-lp.com.ar',
  company: {
    id: 'company-001',
    name: 'Distribuidora La Proveedora S.A.',
  },
  branches: [
    {
      id: 'branch-001',
      name: 'Sucursal Centro',
      code: 'CTR',
      city: 'Cordoba',
      address: 'Av. Colon 1234',
      status: 'active',
    },
    {
      id: 'branch-002',
      name: 'Sucursal Norte',
      code: 'NOR',
      city: 'Cordoba',
      address: 'Av. Rafael Nunez 4567',
      status: 'active',
    },
    {
      id: 'branch-003',
      name: 'Sucursal Sur',
      code: 'SUR',
      city: 'Cordoba',
      address: 'Bv. Los Granaderos 890',
      status: 'active',
    },
    {
      id: 'branch-004',
      name: 'Sucursal Villa Maria (cerrada)',
      code: 'VMA',
      city: 'Villa Maria',
      address: 'Av. San Martin 210',
      status: 'inactive',
    },
  ],
  defaultBranchId: 'branch-001',
};
