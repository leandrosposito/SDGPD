import type { DriverId } from './ids.types'

// ============================================================
// driver.types — Choferes (Tanda 10B, ADR-011). Alcance EMPRESA, mismo
// criterio y misma razon que Vehicle — ver vehicle.types.ts.
// ============================================================

export interface Driver {
  id: DriverId
  nombre: string
  licencia: string
  telefono: string
  activo: boolean
  // Concurrencia optimista (ADR-BE-005): solo la trae el backend (BE-2); el mock no la usa.
  version?: number
}
