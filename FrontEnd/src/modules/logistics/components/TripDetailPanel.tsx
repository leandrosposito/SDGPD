import { useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, Route as RouteIcon } from 'lucide-react';
import { SidePanel } from '@/shared/components/ui/SidePanel';
import { Badge } from '@/shared/components/ui/Badge';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useLiveQuery } from '@/shared/hooks/useLiveQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import type { Trip, TripStatus, TripPosition } from '@/shared/types/trip.types';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { Driver } from '@/shared/types/driver.types';
import type { Delivery } from '@/shared/types/logistics.types';
import type { Pod } from '@/shared/types/pod.types';
import type { DeliveryId, StopId } from '@/shared/types/ids.types';
import {
  getTripById,
  transitionTrip,
  updateStopOrder,
  getTripPosition,
  getTripRoute,
  type TripPositionQueryFilters,
} from '../services/trips.service';
import { getDeliveriesByIds } from '../services/deliveries.service';
import { getPodForDelivery } from '../services/pod.service';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_VARIANT } from '../deliveryStatusLabels';
import { TRIP_STATUS_LABEL, TRIP_STATUS_VARIANT } from '../tripStatusLabels';
import { PodModal } from './PodModal';
import './TripDetailPanel.css';

// ============================================================
// TripDetailPanel — Tanda 10B (ADR-011). Mismo patron que
// OrderDetailPanel.tsx (SidePanel + datos derivados de fetches
// propios). Reordenar paradas: botones arriba/abajo, sin
// drag-and-drop (requeriria dependencia nueva, prohibido — ADR-011
// seccion 5). Posicion: texto, nunca mapa (fuera de alcance
// explicito de esta tanda).
//
// Fase C (gate 5, "conexion"): getTripById/getTripRoute/
// getPodForDelivery quedaban exportados sin call-site real — este
// panel es su unico consumidor. getTripById reemplaza el patron previo
// de parchear `localTrip` a mano tras cada mutacion: ahora cada accion
// exitosa solo pide `refetchTripDetail()` (P10, mismo criterio que el
// resto del proyecto — "refetchear la pagina vigente" en vez de
// reconstruir el objeto en el cliente).
// ============================================================

const EMPTY_DELIVERIES: Delivery[] = [];
const EMPTY_ROUTE: TripPosition[] = [];
const TRIP_LIVE_INTERVAL_MS = 12_000; // ADR-011 seccion 4 / enmienda ADR-003: rango 10-15s

function isTripTransitionPermitida(trip: Trip, transicion: TripStatus): boolean {
  return trip.allowedTransitions?.find((t) => t.transicion === transicion)?.permitida ?? false;
}

function formatPosition(position: TripPosition | undefined): string {
  if (!position) return 'Sin posición reportada todavía.';
  const hora = new Date(position.timestampDispositivo).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `lat ${position.lat.toFixed(5)}, lng ${position.lng.toFixed(5)} — ${hora}`;
}

interface TripDetailPanelProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | undefined;
  driver: Driver | undefined;
  fullName: string;
  onChanged: () => void;
}

export const TripDetailPanel: FC<TripDetailPanelProps> = ({ trip, isOpen, onClose, vehicle, driver, fullName, onChanged }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id) ?? '';

  // getTripById es la fuente autoritativa mientras el panel esta
  // abierto — `trip` (la fila que vino de la pagina de TripsPage)
  // solo sirve de placeholder para el primer render, mientras este
  // fetch todavia no resolvio (evita un parpadeo a vacio).
  const {
    data: tripDetail,
    refetch: refetchTripDetail,
  } = useCachedQuery(
    'trip-detail',
    trip?.id ?? null,
    (signal) => {
      if (!trip) throw new Error('TripDetailPanel: fetch de detalle sin trip.');
      return getTripById(empresaId, trip.id, signal);
    },
    { enabled: isOpen && Boolean(trip) && Boolean(empresaId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const localTrip = tripDetail ?? trip;

  const allDeliveryIds = useMemo(() => (localTrip ? localTrip.paradas.flatMap((s) => s.deliveryIds) : []), [localTrip]);

  const { data: deliveriesData, refetch: refetchDeliveries } = useCachedQuery(
    'trip-deliveries',
    localTrip?.id ?? null,
    (signal) => getDeliveriesByIds(empresaId, allDeliveryIds, signal),
    { enabled: isOpen && Boolean(localTrip) && Boolean(empresaId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const deliveries = deliveriesData ?? EMPTY_DELIVERIES;
  const deliveriesById = useMemo(() => new Map(deliveries.map((d) => [d.id as string, d])), [deliveries]);

  // POD ya registrado por entrega (D1: evita que "Registrar POD" quede
  // habilitado para una entrega que ya tiene evidencia — mismo criterio
  // que el resto del proyecto, un hecho append-only no se sobreescribe).
  const { data: podsData, refetch: refetchPods } = useCachedQuery(
    'trip-pods',
    localTrip?.id ?? null,
    async (signal) => {
      const entries = await Promise.all(allDeliveryIds.map(async (id) => [id as string, await getPodForDelivery(empresaId, id, signal)] as const));
      return new Map(entries);
    },
    { enabled: isOpen && Boolean(localTrip) && Boolean(empresaId), staleTime: CACHE_STALE_TIME.OPERATIONAL }
  );
  const podsByDeliveryId = podsData ?? new Map<string, Pod | null>();

  const positionFilters: TripPositionQueryFilters = useMemo(() => ({ empresaId, tripId: localTrip?.id ?? ('' as Trip['id']) }), [empresaId, localTrip?.id]);
  const { items: positionItems } = useLiveQuery(getTripPosition, positionFilters, {
    enabled: isOpen && localTrip?.estado === 'EnTransito' && Boolean(localTrip),
    intervalMs: TRIP_LIVE_INTERVAL_MS,
  });
  const livePosition = positionItems[0] as TripPosition | undefined;

  const [podTarget, setPodTarget] = useState<{ deliveryId: DeliveryId; stopId: StopId } | null>(null);
  const [route, setRoute] = useState<TripPosition[]>(EMPTY_ROUTE);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  if (!localTrip) return null;

  async function handleTransition(hasta: TripStatus) {
    if (!localTrip) return;
    const idempotencyKey = crypto.randomUUID();
    const result = await transitionTrip(empresaId, idempotencyKey, localTrip.id, hasta, fullName);
    if (result.success && result.newStatus) {
      toast.success(`Viaje ${localTrip.id} actualizado a "${TRIP_STATUS_LABEL[result.newStatus]}".`);
      refetchTripDetail();
      onChanged();
      return;
    }
    toast.error('No se pudo actualizar el estado del viaje.');
  }

  async function handleMove(stopId: StopId, direction: -1 | 1) {
    if (!localTrip) return;
    const ordered = [...localTrip.paradas].sort((a, b) => a.orden - b.orden);
    const index = ordered.findIndex((s) => s.id === stopId);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    const reordered = [...ordered];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

    const result = await updateStopOrder(empresaId, localTrip.id, reordered.map((s) => s.id));
    if (result.success) {
      refetchTripDetail();
      onChanged();
      return;
    }
    toast.error('No se pudo reordenar las paradas.');
  }

  function handlePodRegistered() {
    refetchTripDetail();
    refetchDeliveries();
    refetchPods();
    onChanged();
  }

  async function handleViewRoute() {
    if (!localTrip) return;
    setIsLoadingRoute(true);
    try {
      const points = await getTripRoute(empresaId, localTrip.id);
      setRoute(points);
      if (points.length === 0) toast.error('Este viaje todavía no tiene recorrido registrado.');
    } finally {
      setIsLoadingRoute(false);
    }
  }

  const paradasOrdenadas = [...localTrip.paradas].sort((a, b) => a.orden - b.orden);

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} title={localTrip.id} subtitle={`${localTrip.fecha} — ${vehicle?.patente ?? localTrip.vehicleId}`}>
      <div className="trip-detail">
        <div className="trip-detail__meta">
          <div className="trip-detail__meta-field">
            <span className="trip-detail__meta-label">Vehículo</span>
            <span className="trip-detail__meta-value">{vehicle ? `${vehicle.patente} — ${vehicle.tipo}` : localTrip.vehicleId}</span>
          </div>
          <div className="trip-detail__meta-field">
            <span className="trip-detail__meta-label">Chofer</span>
            <span className="trip-detail__meta-value">{driver?.nombre ?? localTrip.driverId}</span>
          </div>
          <div className="trip-detail__meta-field">
            <span className="trip-detail__meta-label">Fecha</span>
            <span className="trip-detail__meta-value">{localTrip.fecha}</span>
          </div>
          <div className="trip-detail__meta-field">
            <span className="trip-detail__meta-label">Estado</span>
            <Badge label={TRIP_STATUS_LABEL[localTrip.estado]} variant={TRIP_STATUS_VARIANT[localTrip.estado]} />
          </div>
          <div className="trip-detail__meta-field">
            <span className="trip-detail__meta-label">Capacidad usada (bultos)</span>
            <span className="trip-detail__meta-value">
              {localTrip.capacidadUsada.bultos} / {vehicle?.capacidad.bultos ?? '—'}
              {localTrip.sobrecargado && <Badge label="Sobrecargado" variant="warning" />}
            </span>
          </div>
          {localTrip.estado === 'EnTransito' && (
            <div className="trip-detail__meta-field trip-detail__meta-field--full">
              <span className="trip-detail__meta-label">Posición actual (sin mapa)</span>
              <span className="trip-detail__meta-value">{formatPosition(livePosition ?? localTrip.posicionActual)}</span>
            </div>
          )}
        </div>

        <div className="trip-detail__actions">
          {(['Despachado', 'EnTransito', 'Rendido', 'Cancelado'] as TripStatus[])
            .filter((t) => isTripTransitionPermitida(localTrip, t))
            .map((t) => (
              <button key={t} type="button" className="trip-detail__btn-transition" onClick={() => handleTransition(t)}>
                {t === 'Despachado' && 'Despachar'}
                {t === 'EnTransito' && 'Marcar en tránsito'}
                {t === 'Rendido' && 'Rendir viaje'}
                {t === 'Cancelado' && 'Cancelar viaje'}
              </button>
            ))}
          {(localTrip.estado === 'EnTransito' || localTrip.estado === 'Rendido') && (
            <button type="button" className="trip-detail__btn-transition" onClick={handleViewRoute} disabled={isLoadingRoute}>
              <RouteIcon size={14} aria-hidden="true" />
              {isLoadingRoute ? 'Cargando recorrido…' : 'Ver recorrido'}
            </button>
          )}
        </div>

        {route.length > 0 && (
          <div className="trip-detail__route">
            <h4 className="trip-detail__section-title">
              Recorrido (últimos {route.length} puntos — bajo demanda, sin mapa, ver ADR-011 sección 4)
            </h4>
            <ul className="trip-detail__route-list">
              {route.map((point, i) => (
                <li key={i}>{formatPosition(point)}</li>
              ))}
            </ul>
          </div>
        )}

        <h4 className="trip-detail__section-title">Paradas</h4>
        <div className="trip-detail__stops">
          {paradasOrdenadas.map((stop, index) => (
            <div key={stop.id} className="trip-detail__stop">
              <div className="trip-detail__stop-header">
                <span className="trip-detail__stop-order">{stop.orden}.</span>
                <div className="trip-detail__stop-info">
                  <strong>{stop.clientName}</strong>
                  <span>{stop.address}</span>
                </div>
                <Badge label={stop.estado} variant={stop.estado === 'Visitada' ? 'success' : stop.estado === 'NoVisitada' ? 'danger' : 'neutral'} />
                <div className="trip-detail__stop-move">
                  <button type="button" disabled={index === 0} onClick={() => handleMove(stop.id, -1)} aria-label={`Subir parada ${stop.orden}`}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === paradasOrdenadas.length - 1}
                    onClick={() => handleMove(stop.id, 1)}
                    aria-label={`Bajar parada ${stop.orden}`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
              <ul className="trip-detail__stop-deliveries">
                {stop.deliveryIds.map((deliveryId) => {
                  const delivery = deliveriesById.get(deliveryId as string);
                  // D1 (Fase C): el gate real es "ya tiene POD registrado"
                  // (getPodForDelivery, hecho append-only), no un proxy
                  // sobre delivery.status — una Delivery puede llegar a
                  // FINALIZADO por el camino del remito completo
                  // (registrarEntrega) sin pasar nunca por POD.
                  const yaTienePod = podsByDeliveryId.get(deliveryId as string) != null;
                  return (
                    <li key={deliveryId} className="trip-detail__delivery-row">
                      <span className="trip-detail__delivery-id">{deliveryId}</span>
                      {delivery && <Badge label={DELIVERY_STATUS_LABEL[delivery.status]} variant={DELIVERY_STATUS_VARIANT[delivery.status]} />}
                      <button
                        type="button"
                        className="trip-detail__btn-pod"
                        disabled={yaTienePod}
                        title={yaTienePod ? 'Esta entrega ya tiene POD registrado.' : undefined}
                        onClick={() => setPodTarget({ deliveryId, stopId: stop.id })}
                      >
                        {yaTienePod ? 'POD registrado' : 'Registrar POD'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <PodModal
        isOpen={podTarget !== null}
        onClose={() => setPodTarget(null)}
        tripId={localTrip.id}
        deliveryId={podTarget?.deliveryId ?? null}
        stopId={podTarget?.stopId ?? null}
        fullName={fullName}
        onRegistered={handlePodRegistered}
      />
    </SidePanel>
  );
};
