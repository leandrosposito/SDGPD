import { useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { Driver } from '@/shared/types/driver.types';
import type { BranchId, VehicleId, DriverId, DeliveryId } from '@/shared/types/ids.types';
import type { Delivery } from '@/shared/types/logistics.types';
import { getDeliveriesPage } from '../services/deliveries.service';
import { createTrip, assignDeliveriesToStop, MAX_TRIP_ASSIGNMENT, type CreateTripStopInput } from '../services/trips.service';
import './CreateTripModal.css';

// ============================================================
// CreateTripModal — Tanda 10B (ADR-011). Alta de viaje: elegir
// vehiculo/chofer/fecha, seleccionar entregas CREADO de la sucursal
// activa (techo visual MAX_TRIP_ASSIGNMENT) y confirmar. La asignacion
// real (capacidad/concurrencia/techo, ADR-011 secciones 1/2/3) pasa
// SIEMPRE por assignDeliveriesToStop, nunca precargada en createTrip
// (ver el comentario de CreateTripStopInput en trips.service.ts) — por
// eso el flujo llama createTrip (paradas sin entregas todavia) y
// despues, por cada parada, assignDeliveriesToStop.
//
// Agrupacion en paradas: las entregas seleccionadas se agrupan por
// (clientName, address) — mismo cliente/direccion = 1 sola visita
// fisica (ADR-010 seccion 2, Parada multi-pedido), aunque tenga mas de
// un pedido/Delivery.
// ============================================================

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: BranchId | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  fullName: string;
  onCreated: () => void;
}

function formatCapacity(v: Vehicle): string {
  const c = v.capacidad;
  return `${v.patente} — ${v.tipo} (${c.bultos} bultos, ${c.pesoKg}kg, ${c.volumenM3}m³${c.refrigerado ? ', refrigerado' : ''})`;
}

export const CreateTripModal: FC<CreateTripModalProps> = ({ isOpen, onClose, branchId, vehicles, drivers, fullName, onCreated }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id) ?? '';
  const [vehicleId, setVehicleId] = useState<VehicleId | ''>('');
  const [driverId, setDriverId] = useState<DriverId | ''>('');
  const [fecha, setFecha] = useState(todayLocalDateString());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const deliveriesFilters = useMemo(
    () => ({ empresaId, branchId, status: 'CREADO' as const, dateFrom: undefined, dateTo: undefined }),
    [empresaId, branchId]
  );

  const { data: candidatesPage } = useCachedQuery(
    'trip-candidate-deliveries',
    branchId,
    (signal) =>
      getDeliveriesPage(
        { page: 1, pageSize: MAX_TRIP_ASSIGNMENT, filters: deliveriesFilters, sort: { field: 'clientName', direction: 'asc' } },
        signal
      ),
    { enabled: isOpen && Boolean(branchId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const candidates: Delivery[] = candidatesPage?.items ?? [];
  const totalCandidates = candidatesPage?.total ?? 0;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!branchId || !vehicleId || !driverId || selected.size === 0) {
      toast.error('Elegí vehículo, chofer y al menos una entrega.');
      return;
    }

    const seleccionadas = candidates.filter((d) => selected.has(d.id));
    const grupos = new Map<string, { clientName: string; address: string; deliveryIds: DeliveryId[] }>();
    for (const d of seleccionadas) {
      const key = `${d.clientName}__${d.address}`;
      const existing = grupos.get(key);
      if (existing) existing.deliveryIds.push(d.id);
      else grupos.set(key, { clientName: d.clientName, address: d.address, deliveryIds: [d.id] });
    }
    const gruposArr = [...grupos.values()];
    const paradasInput: CreateTripStopInput[] = gruposArr.map((g) => ({ clientName: g.clientName, address: g.address }));

    setIsSaving(true);
    try {
      const createResult = await createTrip(
        empresaId,
        crypto.randomUUID(),
        { branchId, vehicleId, driverId, fecha, paradas: paradasInput },
        fullName
      );
      if (!createResult.success || !createResult.trip) {
        toast.error('No se pudo crear el viaje.');
        return;
      }

      let currentVersion = createResult.trip.version;
      let ultimaCapacidad = createResult.trip.capacidadUsada;
      for (let i = 0; i < gruposArr.length; i++) {
        const stop = createResult.trip.paradas[i];
        const assignResult = await assignDeliveriesToStop(
          empresaId,
          crypto.randomUUID(),
          createResult.trip.id,
          stop.id,
          { modo: 'lista', deliveryIds: gruposArr[i].deliveryIds },
          { expectedVersion: currentVersion },
          fullName
        );
        if (!assignResult.success || !assignResult.trip) {
          toast.error(`No se pudo asignar entregas a la parada de ${stop.clientName} (${assignResult.reason ?? 'error'}).`);
          continue;
        }
        currentVersion = assignResult.trip.version;
        ultimaCapacidad = assignResult.trip.capacidadUsada;
      }

      const vehicle = vehicles.find((v) => v.id === vehicleId);
      toast.success(
        `Viaje ${createResult.trip.id} creado. Capacidad usada: ${ultimaCapacidad.bultos}/${vehicle?.capacidad.bultos ?? '—'} bultos.`
      );
      setSelected(new Set());
      onCreated();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo viaje"
      size="lg"
      footer={
        <>
          <button type="button" className="create-trip__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="create-trip__confirm" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? 'Creando...' : 'Crear viaje'}
          </button>
        </>
      }
    >
      <div className="create-trip">
        <div className="create-trip__grid">
          <div className="create-trip__field">
            <label>Vehículo</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value as VehicleId)}>
              <option value="">Elegí un vehículo…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatCapacity(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="create-trip__field">
            <label>Chofer</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value as DriverId)}>
              <option value="">Elegí un chofer…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="create-trip__field">
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <h4 className="create-trip__section-title">
          Entregas disponibles ({candidates.length}
          {totalCandidates > candidates.length ? ` de ${totalCandidates}, mostrando máximo ${MAX_TRIP_ASSIGNMENT}` : ''})
        </h4>
        <div className="create-trip__deliveries">
          {candidates.length === 0 && <p>No hay entregas en estado Creada para esta sucursal.</p>}
          {candidates.map((d) => (
            <label key={d.id} className="create-trip__delivery-row">
              <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelected(d.id)} />
              <span className="create-trip__delivery-id">{d.id}</span>
              <span>{d.clientName}</span>
              <span className="create-trip__delivery-address">{d.address}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
};
