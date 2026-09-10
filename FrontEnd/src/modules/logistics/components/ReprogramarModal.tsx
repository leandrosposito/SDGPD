import { useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import type { Delivery } from '@/shared/types/logistics.types';
import { getMotivoCatalog } from '@/shared/api/motivos/motivos.service';
import { MOTIVO_OTRO_CODIGO } from '@/shared/types/motivo.types';
import { reprogramDelivery } from '../services/deliveries.service';
import './ReprogramarModal.css';

// ============================================================
// ReprogramarModal — ADR-002 (Tanda 8, corrida completa). Fecha
// nueva + motivo (requerido) + responsable (prellenado con el usuario
// de sesion, editable). Al confirmar, la entrega vuelve a CREADO con
// la fecha nueva (deliveries.service.ts#reprogramDelivery se encarga
// de los 2 pasos de transicion internos, y desde Tanda 11 de liberarla
// de cualquier Parada que la tuviera asignada — ADR-013).
//
// Tanda 9 (ADR-010 seccion 4): idempotente — la clave se genera al
// abrir el modal (la intencion de reprogramar esta entrega), no al
// confirmar. Ajustada DURANTE el render, no dentro de un useEffect
// (PROTOCOLO.md seccion 6, #5).
//
// Tanda 11 (ADR-013 seccion 2): motivo de texto libre -> dropdown
// contra el catalogo 'reprogramacion' (con 'Otro' + texto aparte),
// mismo patron ya usado en RegistrarEntregaModal para 'rechazo'.
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
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [motivoOtroTexto, setMotivoOtroTexto] = useState('');
  const [responsable, setResponsable] = useState(fullName);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Ajuste de estado durante el render (react.dev/learn/you-might-not-
  // need-an-effect): cuando `openTrigger` cambia (el modal pasa a
  // abierto, para esta entrega u otra), se resetean campos + clave en
  // el mismo render extra que React descarta antes de pintar — no hay
  // useEffect involucrado.
  const openTrigger = isOpen ? (delivery?.id ?? '') : null;
  const [lastOpenTrigger, setLastOpenTrigger] = useState<string | null>(null);
  if (openTrigger !== null && openTrigger !== lastOpenTrigger) {
    setLastOpenTrigger(openTrigger);
    setIdempotencyKey(crypto.randomUUID());
    setFechaNueva(todayLocalDateString());
    setMotivoCodigo('');
    setMotivoOtroTexto('');
    setResponsable(fullName);
  }

  const { data: motivoCatalog = [] } = useCachedQuery(
    'motivo-catalog',
    'reprogramacion',
    (signal) => {
      if (!empresaId) throw new Error('ReprogramarModal: fetch de catalogo de motivos sin empresaId.');
      return getMotivoCatalog(empresaId, 'reprogramacion', signal);
    },
    { enabled: isOpen && Boolean(empresaId), staleTime: CACHE_STALE_TIME.CATALOG }
  );

  if (!delivery) return null;

  async function handleConfirm() {
    if (!delivery || !empresaId || !idempotencyKey) return;
    if (!motivoCodigo) {
      toast.error('El motivo de la reprogramación es obligatorio.');
      return;
    }
    if (motivoCodigo === MOTIVO_OTRO_CODIGO && !motivoOtroTexto.trim()) {
      toast.error('El motivo "Otro" necesita una aclaración.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await reprogramDelivery(empresaId, idempotencyKey, delivery.id, {
        fechaNueva,
        motivoCodigo,
        motivoOtroTexto: motivoCodigo === MOTIVO_OTRO_CODIGO ? motivoOtroTexto.trim() : undefined,
        motivoTipo: 'reprogramacion',
        responsable: responsable.trim() || fullName,
      });
      if (result.success) {
        toast.success('Entrega reprogramada — vuelve a estado Creada.');
        onReprogrammed();
        onClose();
        return;
      }
      const message =
        result.reason === 'invalid-transition'
          ? 'Esta entrega ya no admite reprogramarse.'
          : result.reason === 'motivo-invalido'
            ? 'Revisá el motivo cargado.'
            : 'No se encontró la entrega.';
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
          <select value={motivoCodigo} onChange={(e) => { setMotivoCodigo(e.target.value); setMotivoOtroTexto(''); }}>
            <option value="">Seleccioná un motivo…</option>
            {motivoCatalog.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.descripcion}
              </option>
            ))}
          </select>
        </label>
        {motivoCodigo === MOTIVO_OTRO_CODIGO && (
          <label className="reprogramar__field">
            Especificar
            <input type="text" value={motivoOtroTexto} onChange={(e) => setMotivoOtroTexto(e.target.value)} placeholder="Detalle del motivo" />
          </label>
        )}
        <label className="reprogramar__field">
          Responsable
          <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
};
