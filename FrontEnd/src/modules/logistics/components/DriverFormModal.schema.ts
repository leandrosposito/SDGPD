import { z } from 'zod';
import type { Driver } from '@/shared/types/driver.types';

// ============================================================
// DriverFormModal.schema — Tanda 10B. Mismo patron que
// VehicleFormModal.schema.ts.
// ============================================================

export const driverFormSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.'),
  licencia: z.string().trim().min(1, 'La licencia es obligatoria.'),
  telefono: z.string().trim().min(1, 'El telefono es obligatorio.'),
});

export type DriverFormInputValues = z.input<typeof driverFormSchema>;
export type DriverFormValues = z.output<typeof driverFormSchema>;

export function driverFormDefaultValues(driver?: Driver | null): DriverFormInputValues {
  if (!driver) return { nombre: '', licencia: '', telefono: '' };
  return { nombre: driver.nombre, licencia: driver.licencia, telefono: driver.telefono };
}
