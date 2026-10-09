// Ids fijos de la empresa demo del seed de desarrollo y de sus 4 sucursales (BE-1b). Son los MISMOS que
// usa el mock del frontend (FrontEnd/src/data/mock/session.mock.ts y los datos que referencian esas
// sucursales), así un módulo que va por http y otro que sigue en mock hablan de las mismas sucursales.
// Solo constantes, sin dependencias: lo importan scripts/db/seed-dev.ts, scripts/db/demo-branches.ts,
// los tests y la verificación del frontend (scripts/verificacion/v18-ids-demo.mjs) que compara los dos lados.
// No son secretos. La empresa conserva el id que le dio el seed de BE-1a en el entorno de desarrollo.

export const DEMO_EMPRESA_ID = '01a121ca-8df0-7552-9004-881c8ee2a687'

export type DemoBranch = {
  id: string
  name: string
  code: string
  city: string
  address: string
  status: 'active' | 'inactive'
}

/** Las 4 sucursales del mock de sesión del frontend: mismos ids, nombres, códigos, ciudades y estado. */
export const DEMO_BRANCHES: readonly DemoBranch[] = [
  { id: '0192f000-0000-7000-8000-000000000001', name: 'Sucursal Centro', code: 'CTR', city: 'Cordoba', address: 'Av. Colon 1234', status: 'active' },
  { id: '0192f000-0000-7000-8000-000000000002', name: 'Sucursal Norte', code: 'NOR', city: 'Cordoba', address: 'Av. Rafael Nunez 4567', status: 'active' },
  { id: '0192f000-0000-7000-8000-000000000003', name: 'Sucursal Sur', code: 'SUR', city: 'Cordoba', address: 'Bv. Los Granaderos 890', status: 'active' },
  {
    id: '0192f000-0000-7000-8000-000000000004',
    name: 'Sucursal Villa Maria (cerrada)',
    code: 'VMA',
    city: 'Villa Maria',
    address: 'Av. San Martin 210',
    status: 'inactive',
  },
]
