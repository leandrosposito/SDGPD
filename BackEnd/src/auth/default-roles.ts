import { ACTIONS, type Action, MODULES, type Module } from '@sdgpd/contracts'

/**
 * Los 4 roles iniciales de cada empresa nueva (ADR-BE-003, sub-decisión 5): los `SystemRole` del
 * frontend (`settings.types.ts`). La empresa los puede editar después. Admin tiene toda la matriz; el
 * resto, un punto de partida razonable (sub-decisión de BE-1a), no una regla de negocio.
 * Sin decoradores ni dependencias de Nest: lo importa también scripts/db/seed-dev.ts, que corre con Node sin compilar.
 */
export type DefaultRole = { name: string; permissions: { module: Module; action: Action }[] }

const grant = (module: Module, ...actions: Action[]) => actions.map(action => ({ module, action }))

export const DEFAULT_ROLES: readonly DefaultRole[] = [
  { name: 'Admin', permissions: MODULES.flatMap(module => ACTIONS.map(action => ({ module, action }))) },
  {
    name: 'Vendedor',
    permissions: [
      ...grant('dashboard', 'ver'),
      ...grant('orders', 'ver', 'crear', 'editar', 'anular'),
      ...grant('clients', 'ver', 'crear', 'editar'),
      ...grant('inventory', 'ver'),
    ],
  },
  { name: 'Chofer', permissions: grant('logistics', 'ver', 'editar') },
  {
    name: 'Deposito',
    permissions: [
      ...grant('dashboard', 'ver'),
      ...grant('inventory', 'ver', 'crear', 'editar'),
      ...grant('logistics', 'ver', 'editar'),
      ...grant('compras', 'ver', 'crear', 'editar'),
      ...grant('suppliers', 'ver'),
    ],
  },
]
