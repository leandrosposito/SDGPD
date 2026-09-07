import type { FC } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import type { Delivery } from '@/shared/types/logistics.types';
import { DELIVERY_STATUS_LABEL } from '../deliveryStatusLabels';
import { getDeliveryNotesForDelivery } from '../services/deliveries.service';
import './DeliveryHistoryModal.css';

// ============================================================
// DeliveryHistoryModal — historial append-only de una entrega (ADR-002):
// transiciones de estado, reprogramaciones y remitos aplicados. Panel
// simple de solo lectura, sin acciones.
// ============================================================

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
}

export const DeliveryHistoryModal: FC<DeliveryHistoryModalProps> = ({ isOpen, onClose, delivery }) => {
  if (!delivery) return null;

  const notes = getDeliveryNotesForDelivery(delivery.id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Historial — ${delivery.id}`} size="md">
      <div className="delivery-history">
        <section>
          <h4>Transiciones de estado</h4>
          <ul className="delivery-history__list">
            {delivery.historial.map((event) => (
              <li key={event.id}>
                {event.desde ? DELIVERY_STATUS_LABEL[event.desde] : 'Alta'} → {DELIVERY_STATUS_LABEL[event.hasta]}
                {' — '}
                {event.quien} ({new Date(event.cuando).toLocaleString('es-AR')})
              </li>
            ))}
          </ul>
        </section>

        {delivery.reprogramaciones.length > 0 && (
          <section>
            <h4>Reprogramaciones</h4>
            <ul className="delivery-history__list">
              {delivery.reprogramaciones.map((r, i) => (
                <li key={i}>
                  {r.fechaAnterior} → {r.fechaNueva} — {r.motivo} ({r.responsable}, {new Date(r.timestamp).toLocaleString('es-AR')})
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.length > 0 && (
          <section>
            <h4>Remitos</h4>
            <ul className="delivery-history__list">
              {notes.map((note) => (
                <li key={note.id}>
                  {note.id} — {note.lines.length} línea(s), {note.creadoPor} ({new Date(note.creadoEn).toLocaleString('es-AR')})
                  {note.evidenciaIds.length > 0 && ` — ${note.evidenciaIds.length} evidencia(s)`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
};
