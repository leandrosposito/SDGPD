import { useEffect, useState, type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { VehicleId } from '@/shared/types/ids.types';
import {
  vehicleFormSchema,
  vehicleFormDefaultValues,
  vehicleFormValuesToServiceInput,
  ZONAS_DISPONIBLES,
  type VehicleFormInputValues,
  type VehicleFormValues,
} from './VehicleFormModal.schema';
import './VehicleDriverModals.css';

// ============================================================
// VehicleFormModal — Tanda 10B (ADR-011). Alta/edicion de vehiculo,
// validacion react-hook-form + zod (estandar obligatorio del proyecto,
// mismo patron que ProductFormModal.tsx).
// ============================================================

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onSave: (input: ReturnType<typeof vehicleFormValuesToServiceInput>, vehicleId?: VehicleId) => Promise<void>;
}

export const VehicleFormModal: FC<VehicleFormModalProps> = ({ isOpen, onClose, vehicle, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<VehicleFormInputValues, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicleFormDefaultValues(vehicle),
  });

  useEffect(() => {
    if (isOpen) reset(vehicleFormDefaultValues(vehicle));
  }, [isOpen, vehicle, reset]);

  const onSubmit = async (values: VehicleFormValues) => {
    setIsSubmitting(true);
    try {
      await onSave(vehicleFormValuesToServiceInput(values), vehicle?.id);
      toast.success(vehicle ? 'Vehículo actualizado correctamente.' : 'Vehículo creado correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el vehículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}
      size="md"
      footer={
        <>
          <button type="button" className="vd-modal__cancel" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="vd-modal__confirm" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form className="vd-modal-form" onSubmit={(e) => e.preventDefault()}>
        <div className="vd-modal-grid">
          <div className="vd-modal-field">
            <label>Patente</label>
            <input type="text" {...register('patente')} placeholder="AB123CD" />
            {errors.patente && <span className="vd-modal__error">{errors.patente.message}</span>}
          </div>
          <div className="vd-modal-field">
            <label>Tipo</label>
            <input type="text" {...register('tipo')} placeholder="Camioneta, Camion, Utilitario..." />
            {errors.tipo && <span className="vd-modal__error">{errors.tipo.message}</span>}
          </div>
        </div>

        <h4 className="vd-modal__section-title">Capacidad</h4>
        <div className="vd-modal-grid">
          <div className="vd-modal-field">
            <label>Bultos</label>
            <input type="number" min={0} {...register('bultos')} />
            {errors.bultos && <span className="vd-modal__error">{errors.bultos.message}</span>}
          </div>
          <div className="vd-modal-field">
            <label>Peso (kg)</label>
            <input type="number" min={0} {...register('pesoKg')} />
            {errors.pesoKg && <span className="vd-modal__error">{errors.pesoKg.message}</span>}
          </div>
          <div className="vd-modal-field">
            <label>Volumen (m³)</label>
            <input type="number" min={0} step="0.1" {...register('volumenM3')} />
            {errors.volumenM3 && <span className="vd-modal__error">{errors.volumenM3.message}</span>}
          </div>
        </div>

        <div className="vd-modal-field">
          <label className="vd-modal__checkbox-label">
            <input type="checkbox" {...register('refrigerado')} />
            Refrigerado
          </label>
        </div>

        <div className="vd-modal-field">
          <label>Zonas habilitadas</label>
          <Controller
            name="zonasHabilitadas"
            control={control}
            render={({ field }) => (
              <div className="vd-modal__zone-checks">
                {ZONAS_DISPONIBLES.map((zona) => {
                  const checked = (field.value ?? []).includes(zona);
                  return (
                    <label key={zona} className="vd-modal__checkbox-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = field.value ?? [];
                          field.onChange(e.target.checked ? [...current, zona] : current.filter((z) => z !== zona));
                        }}
                      />
                      {zona}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {errors.zonasHabilitadas && <span className="vd-modal__error">{errors.zonasHabilitadas.message}</span>}
        </div>
      </form>
    </Modal>
  );
};
