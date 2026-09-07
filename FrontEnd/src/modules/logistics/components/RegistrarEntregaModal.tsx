import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { EvidenceUploader } from '@/shared/components/ui/EvidenceUploader';
import { useEvidenceUpload } from '@/shared/hooks/useEvidenceUpload';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Delivery } from '@/shared/types/logistics.types';
import type { Order } from '@/shared/types/order.types';
import { derivePendingQuantity } from '@/shared/utils/orderFulfillment';
import { getOrderById } from '@/modules/orders/api/orders.service';
import { registrarEntrega, type RegistrarEntregaLineInput } from '../services/deliveries.service';
import './RegistrarEntregaModal.css';

// ============================================================
// RegistrarEntregaModal — ADR-001/ADR-002/ADR-005 (Tanda 8, corrida
// completa). Muestra las lineas del pedido (pedida/entregada hasta
// ahora/pendiente, derivadas siempre — nunca un campo persistido) y
// permite cargar, por linea, cuanto se entrega ahora y cuanto se
// rechaza — con motivo y evidencia si hay rechazo. Al confirmar crea
// el remito (append-only) y finaliza el viaje.
// ============================================================

interface LineDraft {
  entregar: number;
  rechazar: number;
  motivo: string;
}

interface RegistrarEntregaModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  onRegistered: () => void;
}

export const RegistrarEntregaModal: FC<RegistrarEntregaModalProps> = ({ isOpen, onClose, delivery, onRegistered }) => {
  const fullName = useSessionStore((s) => s.session?.fullName) ?? 'Usuario';
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [isSaving, setIsSaving] = useState(false);
  const evidence = useEvidenceUpload();

  useEffect(() => {
    // setState se dispara desde el callback de un microtask
    // (Promise.resolve().then), nunca de forma sincronica en el cuerpo
    // del efecto — evita el cascading render que react-hooks/set-state-in-effect
    // senala (mismo patron ya usado en AlertsBell.tsx, Tanda 7).
    Promise.resolve().then(() => {
      if (!isOpen || !delivery || !empresaId) {
        setOrder(null);
        setDrafts({});
        evidence.reset();
        return;
      }
      setIsLoadingOrder(true);
      getOrderById(empresaId, delivery.orderId)
        .then((found) => {
          setOrder(found ?? null);
          if (found) {
            const initial: Record<string, LineDraft> = {};
            for (const item of found.items) {
              const pending = derivePendingQuantity(item);
              initial[item.id] = { entregar: pending, rechazar: 0, motivo: '' };
            }
            setDrafts(initial);
          }
        })
        .catch(() => toast.error('No se pudo cargar el pedido de esta entrega.'))
        .finally(() => setIsLoadingOrder(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr al abrir/cambiar de entrega
  }, [isOpen, delivery]);

  const hasAnyRejection = useMemo(() => Object.values(drafts).some((d) => d.rechazar > 0), [drafts]);

  if (!delivery) return null;

  function updateDraft(lineId: string, patch: Partial<LineDraft>) {
    setDrafts((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  async function handleConfirm() {
    if (!order || !delivery) return;

    const lines: RegistrarEntregaLineInput[] = order.items
      .map((item) => {
        const draft = drafts[item.id];
        return {
          orderLineId: item.id,
          cantidadEntregada: draft?.entregar ?? 0,
          cantidadRechazada: draft?.rechazar ?? 0,
          motivoRechazo: draft?.rechazar > 0 ? draft.motivo || undefined : undefined,
        };
      })
      .filter((l) => l.cantidadEntregada > 0 || l.cantidadRechazada > 0);

    if (lines.length === 0) {
      toast.error('Cargá al menos una cantidad entregada o rechazada.');
      return;
    }
    if (lines.some((l) => l.cantidadRechazada > 0 && !l.motivoRechazo)) {
      toast.error('Toda cantidad rechazada necesita un motivo.');
      return;
    }
    if (evidence.isUploading) {
      toast.error('Esperá a que terminen de subirse los archivos de evidencia.');
      return;
    }
    if (hasAnyRejection && evidence.hasErrors) {
      toast.error('Hay archivos de evidencia con error — reintentalos o quitalos antes de confirmar.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await registrarEntrega(delivery.id, lines, evidence.uploadedFileIds, fullName);
      if (result.success) {
        toast.success('Entrega registrada correctamente.');
        onRegistered();
        onClose();
        return;
      }
      const message =
        result.reason === 'invalid-transition'
          ? 'Esta entrega ya no admite registrar una entrega (estado actual no lo permite).'
          : result.reason === 'no-lines'
            ? 'No se cargó ninguna línea.'
            : 'No se encontró la entrega.';
      toast.error(message);
    } catch {
      toast.error('No se pudo registrar la entrega.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar entrega — ${delivery.id}`}
      size="lg"
      footer={
        <>
          <button type="button" className="registrar-entrega__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="registrar-entrega__confirm" onClick={handleConfirm} disabled={isSaving || isLoadingOrder || !order}>
            {isSaving ? 'Guardando...' : 'Confirmar entrega'}
          </button>
        </>
      }
    >
      {isLoadingOrder && <p>Cargando pedido...</p>}
      {!isLoadingOrder && !order && <p>No se encontró el pedido de esta entrega.</p>}
      {!isLoadingOrder && order && (
        <div className="registrar-entrega">
          <table className="registrar-entrega__table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Pedida</th>
                <th>Entregada</th>
                <th>Pendiente</th>
                <th>Entregar ahora</th>
                <th>Rechazar ahora</th>
                <th>Motivo rechazo</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const pending = derivePendingQuantity(item);
                const draft = drafts[item.id] ?? { entregar: pending, rechazar: 0, motivo: '' };
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.cantidadEntregada}</td>
                    <td>{pending}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={pending}
                        value={draft.entregar}
                        onChange={(e) => updateDraft(item.id, { entregar: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={pending}
                        value={draft.rechazar}
                        onChange={(e) => updateDraft(item.id, { rechazar: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      {draft.rechazar > 0 && (
                        <input
                          type="text"
                          placeholder="Motivo"
                          value={draft.motivo}
                          onChange={(e) => updateDraft(item.id, { motivo: e.target.value })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasAnyRejection && (
            <EvidenceUploader
              files={evidence.files}
              rejectedMessages={evidence.rejectedMessages}
              onAddFiles={evidence.addFiles}
              onRetry={evidence.retry}
              onRemove={evidence.remove}
            />
          )}
        </div>
      )}
    </Modal>
  );
};
