import { useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import { getMotivoCatalog } from '@/shared/api/motivos/motivos.service';
import { MOTIVO_OTRO_CODIGO } from '@/shared/types/motivo.types';
import type { TripId, StopId } from '@/shared/types/ids.types';
import type { Trip } from '@/shared/types/trip.types';
import { markStopNoVisitada } from '../services/trips.service';
import './ReprogramarModal.css';

// ============================================================
// NoEntregaModal — Tanda 11 (ADR-013 seccion 3). "El chofer llego a
// esta direccion y no pudo entregar nada" — accion por PARADA (no por
// entrega aislada, ver ADR-013), disparada desde TripDetailPanel.tsx.
// Reusa el mismo shell visual de ReprogramarModal.css: mismo tipo de
// formulario (fecha + motivo + Otro), otro catalogo ('no-entrega' en
// vez de 'reprogramacion') y otro efecto (marca la Parada NoVisitada
// ademas de reprogramar cada entrega).
//
// Idempotencia (ADR-010 seccion 4): la clave se genera al ABRIR el
// modal, mismo patron que PodModal/ReprogramarModal — ajuste de estado
// durante el render, no en un useEffect.
// ============================================================

interface NoEntregaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: TripId;
  stopId: StopId | null;
  stopLabel: string;
  fullName: string;
  onRegistered: (updatedTrip: Trip) => void;
}

export const NoEntregaModal: FC<NoEntregaModalProps> = ({ isOpen, onClose, tripId, stopId, stopLabel, fullName, onRegistered }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id) ?? '';
  const [fechaNueva, setFechaNueva] = useState(todayLocalDateString());
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [motivoOtroTexto, setMotivoOtroTexto] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openTrigger = isOpen ? (stopId ?? '') : null;
  const [lastOpenTrigger, setLastOpenTrigger] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  if (openTrigger !== null && openTrigger !== lastOpenTrigger) {
    setLastOpenTrigger(openTrigger);
    setIdempotencyKey(crypto.randomUUID());
    setFechaNueva(todayLocalDateString());
    setMotivoCodigo('');
    setMotivoOtroTexto('');
  }

  const { data: motivoCatalog = [] } = useCachedQuery(
    'motivo-catalog',
    'no-entrega',
    (signal) => {
      if (!empresaId) throw new Error('NoEntregaModal: fetch de catalogo de motivos sin empresaId.');
      return getMotivoCatalog(empresaId, 'no-entrega', signal);
    },
    { enabled: isOpen && Boolean(empresaId), staleTime: CACHE_STALE_TIME.CATALOG }
  );

  if (!stopId) return null;

  async function handleConfirm() {
    if (!stopId || !idempotencyKey) return;
    if (!motivoCodigo) {
      toast.error('El motivo es obligatorio.');
      return;
    }
    if (motivoCodigo === MOTIVO_OTRO_CODIGO && !motivoOtroTexto.trim()) {
      toast.error('El motivo "Otro" necesita una aclaración.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await markStopNoVisitada(
        empresaId,
        idempotencyKey,
        tripId,
        stopId,
        {
          fechaNueva,
          motivoCodigo,
          motivoOtroTexto: motivoCodigo === MOTIVO_OTRO_CODIGO ? motivoOtroTexto.trim() : undefined,
        },
        fullName
      );

      if (result.success && result.trip) {
        const fallidas = result.resultadosPorEntrega?.filter((r) => !r.success) ?? [];
        if (fallidas.length === 0) {
          toast.success('Parada marcada como no visitada — las entregas se reprogramaron.');
        } else {
          // Mismo criterio que PodModal#deliveryFinalized: el hecho
          // principal (parada no visitada) se guarda igual, pero si
          // reprogramar alguna entrega puntual fallo, se avisa en vez
          // de reportar un exito completo en silencio.
          toast.warning(`Parada marcada como no visitada, pero ${fallidas.length} entrega(s) no se pudieron reprogramar — revisalas a mano.`, {
            duration: 8000,
          });
        }
        onRegistered(result.trip);
        onClose();
        return;
      }
      toast.error(result.reason === 'no-deliveries' ? 'Esta parada no tiene entregas para reprogramar.' : 'No se pudo registrar la no-entrega.');
    } catch {
      toast.error('No se pudo registrar la no-entrega.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Entrega no realizada — ${stopLabel}`}
      size="sm"
      footer={
        <>
          <button type="button" className="reprogramar__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="reprogramar__confirm" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="reprogramar">
        <label className="reprogramar__field">
          Próximo intento
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
      </div>
    </Modal>
  );
};
