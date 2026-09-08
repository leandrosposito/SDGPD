import { useEffect, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import type { Delivery } from '@/shared/types/logistics.types';
import { reprogramDelivery } from '../services/deliveries.service';
import './ReprogramarModal.css';

// ============================================================
// ReprogramarModal — ADR-002 (Tanda 8, corrida completa). Fecha
// nueva + motivo (requerido) + responsable (prellenado con el usuario
// de sesion, editable). Al confirmar, la entrega vuelve a CREADO con
// la fecha nueva (deliveries.service.ts#reprogramDelivery se encarga
// de los 2 pasos de transicion internos).
// ============================================================

interface ReprogramarModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  onReprogrammed: () => void;
}

export const ReprogramarModal: FC<ReprogramarModalProps> = ({ isOpen, onClose, delivery, onReprogrammed }) => {
  const fullName = useSessionStore((s) => s.session?.fullName) ?? 'Usuario';
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [fechaNueva, setFechaNueva] = useState(todayLocalDateString());
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState(fullName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Microtask (mismo patron que RegistrarEntregaModal/AlertsBell,
    // Tanda 7/8) para no disparar setState sincronico en el cuerpo del
    // efecto.
    Promise.resolve().then(() => {
      if (isOpen) {
        setFechaNueva(todayLocalDateString());
        setMotivo('');
        setResponsable(fullName);
      }
    });
  }, [isOpen, fullName]);

  if (!delivery) return null;

  async function handleConfirm() {
    if (!delivery || !empresaId) return;
    if (!motivo.trim()) {
      toast.error('El motivo de la reprogramación es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await reprogramDelivery(empresaId, delivery.id, {
        fechaNueva,
        motivo: motivo.trim(),
        responsable: responsable.trim() || fullName,
      });
      if (result.success) {
        toast.success('Entrega reprogramada — vuelve a estado Creada.');
        onReprogrammed();
        onClose();
        return;
      }
      const message = result.reason === 'invalid-transition' ? 'Esta entrega ya no admite reprogramarse.' : 'No se encontró la entrega.';
      toast.error(message);
    } catch {
      toast.error('No se pudo reprogramar la entrega.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reprogramar entrega — ${delivery.id}`}
      size="sm"
      footer={
        <>
          <button type="button" className="reprogramar__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="reprogramar__confirm" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Reprogramar'}
          </button>
        </>
      }
    >
      <div className="reprogramar">
        <label className="reprogramar__field">
          Fecha nueva
          <input type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} />
        </label>
        <label className="reprogramar__field">
          Motivo
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Motivo de la reprogramación" />
        </label>
        <label className="reprogramar__field">
          Responsable
          <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
};
