import { useEffect, useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import type { Driver } from '@/shared/types/driver.types';
import type { DriverId } from '@/shared/types/ids.types';
import type { DriverFormInput } from '@/shared/api/drivers/drivers.service';
import { driverFormSchema, driverFormDefaultValues, type DriverFormInputValues, type DriverFormValues } from './DriverFormModal.schema';
import './VehicleDriverModals.css';

// ============================================================
// DriverFormModal — Tanda 10B (ADR-011). Mismo patron que
// VehicleFormModal.tsx (react-hook-form + zod).
// ============================================================

interface DriverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSave: (input: DriverFormInput, driverId?: DriverId) => Promise<void>;
}

export const DriverFormModal: FC<DriverFormModalProps> = ({ isOpen, onClose, driver, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverFormInputValues, unknown, DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: driverFormDefaultValues(driver),
  });

  useEffect(() => {
    if (isOpen) reset(driverFormDefaultValues(driver));
  }, [isOpen, driver, reset]);

  const onSubmit = async (values: DriverFormValues) => {
    setIsSubmitting(true);
    try {
      await onSave(values, driver?.id);
      toast.success(driver ? 'Chofer actualizado correctamente.' : 'Chofer creado correctamente.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el chofer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={driver ? 'Editar Chofer' : 'Nuevo Chofer'}
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
        <div className="vd-modal-field">
          <label>Nombre</label>
          <input type="text" {...register('nombre')} placeholder="Nombre y apellido" />
          {errors.nombre && <span className="vd-modal__error">{errors.nombre.message}</span>}
        </div>
        <div className="vd-modal-grid">
          <div className="vd-modal-field">
            <label>Licencia</label>
            <input type="text" {...register('licencia')} placeholder="B-1234567" />
            {errors.licencia && <span className="vd-modal__error">{errors.licencia.message}</span>}
          </div>
          <div className="vd-modal-field">
            <label>Teléfono</label>
            <input type="tel" {...register('telefono')} placeholder="+54 11 0000-0000" />
            {errors.telefono && <span className="vd-modal__error">{errors.telefono.message}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
};
