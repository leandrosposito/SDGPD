import { useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import type { Order } from '@/shared/types/order.types';
import type { Delivery } from '@/shared/types/logistics.types';
import { asBranchId } from '@/shared/types/ids.types';
import { createDelivery } from '@/modules/logistics/services/deliveries.service';
import './CreateDeliveryModal.css';

// ============================================================
// CreateDeliveryModal — Tanda 9, hallazgo A15#1 (el item mas
// importante de la tanda): primer punto de entrada real para que un
// pedido genere una entrega. Vive en `orders/components` (lo abre
// OrderDetailPanel) pero llama directo a
// `logistics/services/deliveries.service.ts#createDelivery` — regla R2
// del protocolo: un modulo puede llamar la funcion de servicio PUBLICA
// de otro modulo, lo que no puede es importar un COMPONENTE interno de
// otro modulo. No hay ciclo: logistics no importa nada de orders/components.
//
// collectionAmount/date/estimatedTime/zone/priority/branchId se piden
// en el formulario, no se derivan del pedido (ver el comentario de
// createDelivery en deliveries.service.ts: un pedido puede repartirse
// en mas de una entrega, dividir el monto automaticamente es una regla
// de negocio que no existe todavia).
//
// Idempotente (ADR-010 seccion 4): la clave se genera al abrir el
// modal, mismo criterio que RegistrarEntregaModal/ReprogramarModal —
// junto con el reseteo de campos, ajustados durante el render (no en
// un useEffect con microtask: esa es la trampa conocida de este
// proyecto, PROTOCOLO.md seccion 6, #5).
// ============================================================

interface CreateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onCreated: (delivery: Delivery) => void;
}

const ZONES: Delivery['zone'][] = ['Norte', 'Centro', 'Sur'];
const PRIORITIES: Delivery['priority'][] = ['high', 'medium', 'low'];
const PRIORITY_LABEL: Record<Delivery['priority'], string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export const CreateDeliveryModal: FC<CreateDeliveryModalProps> = ({ isOpen, onClose, order, onCreated }) => {
  const fullName = useSessionStore((s) => s.session?.fullName) ?? 'Usuario';
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const branches = useSessionStore((s) => s.session?.branches) ?? [];
  const activeBranchId = useSessionStore((s) => s.activeBranchId);

  const [branchId, setBranchId] = useState(activeBranchId ?? branches[0]?.id ?? '');
  const [date, setDate] = useState(todayLocalDateString());
  const [estimatedTime, setEstimatedTime] = useState('09:00 - 11:00');
  const [zone, setZone] = useState<Delivery['zone']>('Centro');
  const [priority, setPriority] = useState<Delivery['priority']>('medium');
  const [collectionAmount, setCollectionAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Ajuste de estado durante el render (react.dev/learn/you-might-not-
  // need-an-effect): cuando `openTrigger` cambia (el modal pasa a
  // abierto, para este pedido u otro), se resetean campos + clave en
  // el mismo render extra que React descarta antes de pintar.
  // Depende de `order` (no solo de `order?.id`) porque
  // `collectionAmount` se precarga del pedido — sigue disparando una
  // sola vez por apertura porque `openTrigger` solo cambia con
  // isOpen/order.id, no con cada render.
  const openTrigger = isOpen ? (order?.id ?? '') : null;
  const [lastOpenTrigger, setLastOpenTrigger] = useState<string | null>(null);
  if (openTrigger !== null && openTrigger !== lastOpenTrigger && order) {
    setLastOpenTrigger(openTrigger);
    setIdempotencyKey(crypto.randomUUID());
    setBranchId(activeBranchId ?? branches[0]?.id ?? '');
    setDate(todayLocalDateString());
    setEstimatedTime('09:00 - 11:00');
    setZone('Centro');
    setPriority('medium');
    setCollectionAmount(order.paymentMethod === 'Cuenta Corriente' ? 0 : order.totalAmount);
  }

  if (!order) return null;

  async function handleConfirm() {
    if (!order || !empresaId || !branchId || !idempotencyKey) return;

    setIsSaving(true);
    try {
      const result = await createDelivery(
        empresaId,
        idempotencyKey,
        order.id,
        { branchId, date, estimatedTime, zone, priority, collectionAmount },
        fullName
      );
      if (result.success && result.delivery) {
        toast.success(`Entrega ${result.delivery.id} creada para el pedido ${order.orderNumber}.`);
        onCreated(result.delivery);
        onClose();
        return;
      }
      const message =
        result.reason === 'order-not-confirmado'
          ? 'Solo un pedido confirmado puede generar una entrega.'
          : 'No se encontró el pedido.';
      toast.error(message);
    } catch {
      toast.error('No se pudo crear la entrega.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Nueva entrega — ${order.orderNumber}`}
      size="sm"
      footer={
        <>
          <button type="button" className="create-delivery__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="create-delivery__confirm" onClick={handleConfirm} disabled={isSaving || !branchId}>
            {isSaving ? 'Creando...' : 'Crear entrega'}
          </button>
        </>
      }
    >
      <div className="create-delivery">
        <label className="create-delivery__field">
          Sucursal
          <select value={branchId} onChange={(e) => setBranchId(asBranchId(e.target.value))}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="create-delivery__field">
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="create-delivery__field">
          Horario estimado
          <input type="text" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="09:00 - 11:00" />
        </label>
        <label className="create-delivery__field">
          Zona
          <select value={zone} onChange={(e) => setZone(e.target.value as Delivery['zone'])}>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="create-delivery__field">
          Prioridad
          <select value={priority} onChange={(e) => setPriority(e.target.value as Delivery['priority'])}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="create-delivery__field">
          Monto a cobrar
          <input
            type="number"
            min={0}
            value={collectionAmount}
            onChange={(e) => setCollectionAmount(Number(e.target.value))}
          />
        </label>
      </div>
    </Modal>
  );
};
