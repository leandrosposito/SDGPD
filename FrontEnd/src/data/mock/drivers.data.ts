import { asDriverId } from '@/shared/types/ids.types';
import type { Driver } from '@/shared/types/driver.types';

// ============================================================
// MOCK DATA — Choferes (Tanda 10B, ADR-011). Alcance EMPRESA (ver
// driver.types.ts).
// ============================================================

export const DRIVERS_MOCK_DATA: Driver[] = [
  { id: asDriverId('drv-001'), nombre: 'Carlos Fernandez', licencia: 'B-1234567', telefono: '+54 11 5551-0001', activo: true },
  { id: asDriverId('drv-002'), nombre: 'Marina Gomez', licencia: 'B-2345678', telefono: '+54 11 5551-0002', activo: true },
  { id: asDriverId('drv-003'), nombre: 'Julian Ibarra', licencia: 'C-3456789', telefono: '+54 11 5551-0003', activo: true },
];
