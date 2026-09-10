import { useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { todayLocalDateString } from '@/shared/utils/date';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { Driver } from '@/shared/types/driver.types';
import type { BranchId, VehicleId, DriverId, DeliveryId, StopId, TripId } from '@/shared/types/ids.types';
import { asVehicleId, asDriverId } from '@/shared/types/ids.types';
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
//
// Tanda 11: override de capacidad (ADR-011 seccion 2, sub-opcion A2 —
// el servicio ya lo soportaba desde Tanda 10B, esta tanda solo agrega
// el boton). Si alguna parada excede la capacidad nominal del
// vehiculo, el modal NO se cierra — pasa a un segundo paso ("revision
// de capacidad") listando esas paradas puntuales, cada una con su
// propio campo de motivo (obligatorio, ADR-011: "sin una razon
// registrada, el warning es cosmetico") y un boton "Asignar de todas
// formas" que reintenta esa parada con `forzar`. El motivo se pide UNA
// vez por parada, nunca generico para todo el viaje — cada override
// queda auditado server-side con su propio motivo (Trip.overrides).
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

interface CapacityConflict {
  stopId: StopId;
  clientName: string;
  deliveryIds: DeliveryId[];
  motivo: string;
  isRetrying: boolean;
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

  // Estado del segundo paso (revision de capacidad) — null mientras
  // seguimos en el formulario inicial. Una vez que createTrip corrio,
  // el viaje YA EXISTE (no se puede "cancelar" desde este punto, solo
  // cerrar el modal dejando las paradas conflictivas sin esas entregas
  // asignadas) — por eso `tripId`/`tripVersion` quedan en estado
  // propio, no se reusa `selected`/`vehicleId` del paso 1.
  const [tripId, setTripId] = useState<TripId | null>(null);
  const [tripVersion, setTripVersion] = useState(0);
  const [conflicts, setConflicts] = useState<CapacityConflict[]>([]);

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

  function resetAndClose() {
    setSelected(new Set());
    setTripId(null);
    setTripVersion(0);
    setConflicts([]);
    onClose();
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
      const nuevosConflictos: CapacityConflict[] = [];
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
          if (assignResult.reason === 'exceeds-capacity') {
            nuevosConflictos.push({
              stopId: stop.id,
              clientName: stop.clientName,
              deliveryIds: gruposArr[i].deliveryIds,
              motivo: '',
              isRetrying: false,
            });
          } else {
            toast.error(`No se pudo asignar entregas a la parada de ${stop.clientName} (${assignResult.reason ?? 'error'}).`);
          }
          continue;
        }
        currentVersion = assignResult.trip.version;
        ultimaCapacidad = assignResult.trip.capacidadUsada;
      }

      const vehicle = vehicles.find((v) => v.id === vehicleId);

      if (nuevosConflictos.length > 0) {
        setTripId(createResult.trip.id);
        setTripVersion(currentVersion);
        setConflicts(nuevosConflictos);
        toast.warning(
          `Viaje ${createResult.trip.id} creado — ${nuevosConflictos.length} parada(s) exceden la capacidad del vehículo. Revisalas abajo.`,
          { duration: 8000 }
        );
        return;
      }

      toast.success(`Viaje ${createResult.trip.id} creado. Capacidad usada: ${ultimaCapacidad.bultos}/${vehicle?.capacidad.bultos ?? '—'} bultos.`);
      resetAndClose();
      onCreated();
    } finally {
      setIsSaving(false);
    }
  }

  function updateConflictMotivo(stopId: StopId, motivo: string) {
    setConflicts((prev) => prev.map((c) => (c.stopId === stopId ? { ...c, motivo } : c)));
  }

  async function handleForceAssign(conflict: CapacityConflict) {
    if (!tripId || !conflict.motivo.trim()) return;
    setConflicts((prev) => prev.map((c) => (c.stopId === conflict.stopId ? { ...c, isRetrying: true } : c)));
    try {
      const result = await assignDeliveriesToStop(
        empresaId,
        crypto.randomUUID(),
        tripId,
        conflict.stopId,
        { modo: 'lista', deliveryIds: conflict.deliveryIds },
        { expectedVersion: tripVersion, forzar: { motivo: conflict.motivo.trim() } },
        fullName
      );
      if (result.success && result.trip) {
        setTripVersion(result.trip.version);
        setConflicts((prev) => prev.filter((c) => c.stopId !== conflict.stopId));
        toast.success(`Parada de ${conflict.clientName} asignada de todas formas.`);
        onCreated();
        return;
      }
      toast.error(`No se pudo forzar la asignación (${result.reason ?? 'error'}).`);
      setConflicts((prev) => prev.map((c) => (c.stopId === conflict.stopId ? { ...c, isRetrying: false } : c)));
    } catch {
      toast.error('No se pudo forzar la asignación.');
      setConflicts((prev) => prev.map((c) => (c.stopId === conflict.stopId ? { ...c, isRetrying: false } : c)));
    }
  }

  function handleSkipConflict(stopId: StopId) {
    setConflicts((prev) => prev.filter((c) => c.stopId !== stopId));
  }

  const inCapacityReview = tripId !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={inCapacityReview ? 'Revisión de capacidad' : 'Nuevo viaje'}
      size="lg"
      footer={
        inCapacityReview ? (
          <button type="button" className="create-trip__confirm" onClick={() => { resetAndClose(); onCreated(); }} disabled={conflicts.some((c) => c.isRetrying)}>
            {conflicts.length > 0 ? 'Cerrar (dejar paradas sin asignar)' : 'Listo'}
          </button>
        ) : (
          <>
            <button type="button" className="create-trip__cancel" onClick={resetAndClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="button" className="create-trip__confirm" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? 'Creando...' : 'Crear viaje'}
            </button>
          </>
        )
      }
    >
      {inCapacityReview ? (
        <div className="create-trip">
          <p>
            El viaje <strong>{tripId}</strong> ya se creó. Las siguientes paradas exceden la capacidad nominal del vehículo — cargá un motivo
            para asignarlas de todas formas (queda auditado), o cerrá el modal para dejarlas sin asignar y reasignarlas a otro viaje después.
          </p>
          <div className="create-trip__conflicts">
            {conflicts.map((c) => (
              <div key={c.stopId} className="create-trip__conflict-row">
                <div className="create-trip__conflict-info">
                  <strong>{c.clientName}</strong>
                  <span>{c.deliveryIds.length} entrega(s)</span>
                </div>
                <input
                  type="text"
                  placeholder="Motivo del override (obligatorio)"
                  value={c.motivo}
                  onChange={(e) => updateConflictMotivo(c.stopId, e.target.value)}
                  disabled={c.isRetrying}
                />
                <button type="button" onClick={() => handleForceAssign(c)} disabled={!c.motivo.trim() || c.isRetrying}>
                  {c.isRetrying ? 'Asignando…' : 'Asignar de todas formas'}
                </button>
                <button type="button" onClick={() => handleSkipConflict(c.stopId)} disabled={c.isRetrying}>
                  Omitir
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="create-trip">
          <div className="create-trip__grid">
            <div className="create-trip__field">
              <label>Vehículo</label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value ? asVehicleId(e.target.value) : '')}>
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
              <select value={driverId} onChange={(e) => setDriverId(e.target.value ? asDriverId(e.target.value) : '')}>
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
      )}
    </Modal>
  );
};
