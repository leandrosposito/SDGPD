import { z } from 'zod';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { VehicleFormInput } from '@/shared/api/vehicles/vehicles.service';

// ============================================================
// VehicleFormModal.schema — Tanda 10B. Validacion zod + react-hook-form
// (estandar obligatorio del proyecto, docs/DECISIONES_TECNICAS.md),
// mismo patron que ProductFormModal.schema.ts.
// ============================================================

export const ZONAS_DISPONIBLES = ['Norte', 'Centro', 'Sur'] as const;

export const vehicleFormSchema = z.object({
  patente: z.string().trim().min(1, 'La patente es obligatoria.'),
  tipo: z.string().trim().min(1, 'El tipo es obligatorio.'),
  bultos: z.coerce.number().min(0, 'No puede ser negativo.'),
  pesoKg: z.coerce.number().min(0, 'No puede ser negativo.'),
  volumenM3: z.coerce.number().min(0, 'No puede ser negativo.'),
  refrigerado: z.boolean(),
  zonasHabilitadas: z.array(z.string()).min(1, 'Elegí al menos una zona habilitada.'),
});

export type VehicleFormInputValues = z.input<typeof vehicleFormSchema>;
export type VehicleFormValues = z.output<typeof vehicleFormSchema>;

export function vehicleFormDefaultValues(vehicle?: Vehicle | null): VehicleFormInputValues {
  if (!vehicle) {
    return { patente: '', tipo: '', bultos: 0, pesoKg: 0, volumenM3: 0, refrigerado: false, zonasHabilitadas: [] };
  }
  return {
    patente: vehicle.patente,
    tipo: vehicle.tipo,
    bultos: vehicle.capacidad.bultos,
    pesoKg: vehicle.capacidad.pesoKg,
    volumenM3: vehicle.capacidad.volumenM3,
    refrigerado: vehicle.capacidad.refrigerado,
    zonasHabilitadas: vehicle.capacidad.zonasHabilitadas,
  };
}

export function vehicleFormValuesToServiceInput(values: VehicleFormValues): VehicleFormInput {
  return {
    patente: values.patente,
    tipo: values.tipo,
    capacidad: {
      bultos: values.bultos,
      pesoKg: values.pesoKg,
      volumenM3: values.volumenM3,
      refrigerado: values.refrigerado,
      zonasHabilitadas: values.zonasHabilitadas,
    },
  };
}
