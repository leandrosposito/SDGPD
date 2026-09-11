import type { Trip, Stop, TripStatus, TripPosition, CapacityOverrideEvent } from '@/shared/types/trip.types';
import type { Delivery } from '@/shared/types/logistics.types';
import type { TripId, StopId, VehicleId, DriverId, DeliveryId, BranchId } from '@/shared/types/ids.types';
import { asTripId, asStopId } from '@/shared/types/ids.types';
import { puedeTransicionarViaje, computeAllowedTripTransitions } from '@/shared/types/tripStatus.types';
import { computeCapacidadUsada, excedeCapacidad } from '@/shared/utils/tripCapacity';
import { getStopNoVisitadaBlockReason } from '@/shared/utils/stopVisitEligibility';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { TRIPS_MOCK_DATA } from '@/data/mock/trips.data';
import { httpClient } from '@/shared/api/httpClient';
import { withIdempotency } from '@/shared/utils/idempotency';
import { getVehicleById } from '@/shared/api/vehicles/vehicles.service';
import {
  getDeliveryById,
  getDeliveryIdsMatchingFilter,
  transitionDelivery,
  reprogramDelivery,
  type DeliveryQueryFilters,
} from './deliveries.service';
import { registerPodEvidence, type PodInput } from './pod.service';

// ============================================================
// trips.service — Viajes, asignacion y POD (Tanda 10B, ADR-011).
// Alcance SUCURSAL: branchId obligatorio en getTripsPage y presente en
// Trip.branchId — mismo criterio que deliveries.service.ts.
//
// Limitacion conocida (documentada, no oculta): ni Order ni Delivery
// modelan hoy peso/volumen/bultos por producto — no existe ese dato en
// el dominio todavia. capacidadUsada.bultos se calcula server-side
// como la CANTIDAD DE ENTREGAS asignadas al viaje (un hecho real y
// contable), pesoKg/volumenM3 quedan en 0 (no hay de donde derivarlos
// honestamente hoy) — el chequeo de sobrecarga (ADR-011 seccion 2) solo
// puede evaluar la dimension bultos hasta que el dominio de
// productos/pedidos modele peso/volumen.
// ============================================================

let tripsStore: Trip[] = structuredClone(TRIPS_MOCK_DATA);

export const MAX_TRIP_ASSIGNMENT = 100;
export const MAX_ROUTE_POINTS = 500;

function nowISO(): string {
  return new Date().toISOString();
}

function findTripContainingDelivery(deliveryId: DeliveryId): Trip | undefined {
  return tripsStore.find((t) => t.paradas.some((s) => s.deliveryIds.includes(deliveryId)));
}

// ------------------------------------------------------------
// releaseDeliveryFromTrip — ADR-013 seccion 1. Llamada "servidor a
// servidor" (mismo criterio que getDeliveryById/getVehicleById — sin
// pasar por httpClient, sin duplicar latencia simulada) desde
// deliveries.service.ts#reprogramDelivery, en la direccion CONTRARIA a
// la que este archivo ya usa hacia deliveries.service.ts — ver el
// comentario en deliveries.service.ts sobre por que es seguro.
//
// No-op si la entrega no esta asignada a ninguna Parada hoy — no es un
// error, la mayoria de las reprogramaciones son de entregas que
// todavia no se asignaron a ningun viaje.
// ------------------------------------------------------------
export function releaseDeliveryFromTrip(deliveryId: DeliveryId): void {
  const trip = findTripContainingDelivery(deliveryId);
  if (!trip) return;

  const paradas = trip.paradas.map((s) =>
    s.deliveryIds.includes(deliveryId) ? { ...s, deliveryIds: s.deliveryIds.filter((id) => id !== deliveryId) } : s
  );
  const capacidadUsada = computeCapacidadUsada(paradas);
  const vehicle = getVehicleById(trip.vehicleId);
  // Liberar una entrega solo puede BAJAR capacidadUsada — pero si el
  // viaje ya estaba sobrecargado por varias entregas, sacar una sola
  // no necesariamente lo deja dentro del limite: se recalcula de
  // verdad, nunca se asume `false` a secas.
  const sobrecargado = vehicle !== undefined && excedeCapacidad(capacidadUsada, vehicle.capacidad);
  const updated: Trip = { ...trip, paradas, capacidadUsada, sobrecargado, version: trip.version + 1, updatedAt: nowISO() };
  tripsStore = tripsStore.map((t) => (t.id === trip.id ? updated : t));
}

function withComputedFields(trip: Trip): Trip {
  return { ...trip, allowedTransitions: computeAllowedTripTransitions(trip.estado) };
}

// ============================================================
// Lectura paginada + por id
// ============================================================

export interface TripQueryFilters {
  empresaId: string;
  branchId: BranchId | null;
  estado?: TripStatus;
  fecha?: string; // ISO date exact-match
  vehicleId?: VehicleId;
  driverId?: DriverId;
}

export type TripSortField = 'fecha' | 'estado';

function matchesTripFilters(t: Trip, filters: TripQueryFilters): boolean {
  return (
    t.branchId === filters.branchId &&
    (!filters.estado || t.estado === filters.estado) &&
    (!filters.fecha || t.fecha === filters.fecha) &&
    (!filters.vehicleId || t.vehicleId === filters.vehicleId) &&
    (!filters.driverId || t.driverId === filters.driverId)
  );
}

function compareTrips(a: Trip, b: Trip, field: TripSortField): number {
  switch (field) {
    case 'estado':
      return a.estado.localeCompare(b.estado);
    case 'fecha':
    default:
      return a.fecha.localeCompare(b.fecha);
  }
}

// Firma alineada con deliveries.service.ts#getDeliveriesPage a
// proposito (Fase C, hallazgo propio corregido en la misma sesion):
// la version anterior recibia branchId como parametro SUELTO en vez de
// dentro de `query.filters` — usePagedQuery arma la query key de
// TanStack Query solo a partir de `filters` (mas empresaId, que si lee
// de la sesion), asi que un branchId pasado por fuera de `filters`
// quedaba invisible para la key: cambiar de sucursal activa en
// TripsPage.tsx NO iba a disparar un refetch, serviria del cache la
// pagina de la sucursal VIEJA (regla 3.4 del protocolo, "toda query
// key incluye... branchId si el dominio es de alcance sucursal").
export async function getTripsPage(
  query: PageQuery<TripQueryFilters, TripSortField>,
  signal?: AbortSignal
): Promise<PageResult<Trip, undefined>> {
  const filters = query.filters;
  return httpClient.request<PageResult<Trip, undefined>>({
    method: 'GET',
    path: '/trips',
    params: {
      empresaId: filters.empresaId,
      branchId: filters.branchId ?? undefined,
      estado: filters.estado,
      fecha: filters.fecha,
      vehicleId: filters.vehicleId,
      driverId: filters.driverId,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const inScope = tripsStore.filter((t) => matchesTripFilters(t, filters));
      const sortField = query.sort?.field ?? 'fecha';
      const direction = query.sort?.direction ?? 'desc';
      const sorted = [...inScope].sort((a, b) => {
        const cmp = compareTrips(a, b, sortField);
        const primary = direction === 'asc' ? cmp : -cmp;
        return primary !== 0 ? primary : a.id.localeCompare(b.id);
      });

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const safePage = Math.min(Math.max(1, query.page), totalPages);
      const start = (safePage - 1) * query.pageSize;

      return {
        items: structuredClone(sorted.slice(start, start + query.pageSize).map(withComputedFields)),
        total,
        page: safePage,
        pageSize: query.pageSize,
      };
    },
  });
}

export async function getTripById(empresaId: string, tripId: TripId, signal?: AbortSignal): Promise<Trip | null> {
  return httpClient.request<Trip | null>({
    method: 'GET',
    path: `/trips/${tripId}`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = tripsStore.find((t) => t.id === tripId);
      return trip ? structuredClone(withComputedFields(trip)) : null;
    },
  });
}

// ============================================================
// Alta de viaje
// ============================================================

// Sin deliveryIds a proposito: la asignacion de entregas a una parada
// pasa SIEMPRE por assignDeliveriesToStop (aunque sea la primera vez,
// justo despues de crear el viaje — ver CreateTripModal.tsx), nunca
// pre-cargada aca — es el unico camino que valida techo/capacidad/
// concurrencia (ADR-011 secciones 1/2/3). Si createTrip aceptara
// deliveryIds directo, existirian DOS caminos para asignar una
// entrega a una parada, uno validado y otro no.
export interface CreateTripStopInput {
  clientName: string;
  address: string;
}

export interface CreateTripInput {
  branchId: BranchId;
  vehicleId: VehicleId;
  driverId: DriverId;
  fecha: string;
  paradas: CreateTripStopInput[];
}

export type CreateTripReason = 'vehicle-not-found';

export interface CreateTripResult {
  success: boolean;
  trip?: Trip;
  reason?: CreateTripReason;
}

export async function createTrip(
  empresaId: string,
  idempotencyKey: string,
  input: CreateTripInput,
  quien: string
): Promise<CreateTripResult> {
  return httpClient.request<CreateTripResult>({
    method: 'POST',
    path: '/trips',
    body: { empresaId, idempotencyKey, ...input },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const vehicle = getVehicleById(input.vehicleId);
        if (!vehicle) {
          return { success: false, reason: 'vehicle-not-found' as const };
        }

        const now = nowISO();
        const id = asTripId(`trip-${Date.now()}`);
        const paradas: Stop[] = input.paradas.map((stop, index) => ({
          id: asStopId(`stop-${Date.now()}-${index}`),
          tripId: id,
          orden: index + 1,
          clientName: stop.clientName,
          address: stop.address,
          deliveryIds: [],
          estado: 'Pendiente',
          preferenciasEntrega: null,
        }));

        const trip: Trip = {
          id,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          branchId: input.branchId,
          empresaId,
          fecha: input.fecha,
          estado: 'Planificado',
          paradas,
          version: 1,
          capacidadUsada: computeCapacidadUsada(paradas),
          sobrecargado: false,
          overrides: [],
          createdAt: now,
          updatedAt: now,
        };

        tripsStore = [...tripsStore, trip];
        void quien; // sin historial de viaje en esta tanda (ver comentario de transitionTrip) — quien queda reservado para cuando se agregue.
        return { success: true, trip: structuredClone(withComputedFields(trip)) };
      }),
  });
}

// ============================================================
// Asignacion de entregas a una parada (ADR-011 secciones 1/2/3)
// ============================================================

export type AssignDeliveriesInput =
  | { modo: 'lista'; deliveryIds: DeliveryId[] }
  | { modo: 'filtro'; filtros: Omit<DeliveryQueryFilters, 'empresaId'>; excluidos: DeliveryId[] };

export interface AssignDeliveriesOptions {
  expectedVersion: number;
  // Sub-opcion A2 (ADR-011 seccion 2, correccion: motivo obligatorio en
  // el override): sin forzar, una asignacion que excede la capacidad
  // nominal del vehiculo se rechaza entera (ver reason 'exceeds-capacity').
  forzar?: { motivo: string };
}

export type AssignDeliveriesReason =
  | 'not-found'
  | 'stale-version'
  | 'exceeds-limit'
  | 'exceeds-capacity'
  | 'motivo-requerido';

export interface AssignDeliveriesConflict {
  deliveryId: DeliveryId;
  asignadoATripId: TripId;
}

export interface AssignDeliveriesResult {
  success: boolean;
  trip?: Trip;
  reason?: AssignDeliveriesReason;
  matched?: number;
  limit?: number;
  conflictos?: AssignDeliveriesConflict[];
  asignados?: DeliveryId[];
}

export async function assignDeliveriesToStop(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  stopId: StopId,
  input: AssignDeliveriesInput,
  options: AssignDeliveriesOptions,
  quien: string
): Promise<AssignDeliveriesResult> {
  return httpClient.request<AssignDeliveriesResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/assign`,
    body: { empresaId, idempotencyKey, tripId, stopId, input, ...options },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const trip = tripsStore.find((t) => t.id === tripId);
        if (!trip || !trip.paradas.some((s) => s.id === stopId)) {
          return { success: false, reason: 'not-found' as const };
        }
        if (trip.version !== options.expectedVersion) {
          return { success: false, reason: 'stale-version' as const };
        }

        // Resuelve la lista de candidatos: 'lista' explicita, o
        // 'filtro' reaplicado server-side (ADR-011 seccion 1) contra el
        // MISMO matcher que usa getDeliveriesPage — nunca reinterpretado
        // aca.
        const candidateIds =
          input.modo === 'lista'
            ? input.deliveryIds
            : getDeliveryIdsMatchingFilter({ empresaId, ...input.filtros }).filter((id) => !input.excluidos.includes(id));

        if (candidateIds.length > MAX_TRIP_ASSIGNMENT) {
          return { success: false, reason: 'exceeds-limit' as const, matched: candidateIds.length, limit: MAX_TRIP_ASSIGNMENT };
        }

        // Concurrencia granular (ADR-011 seccion 3, correccion): cada
        // deliveryId ya tomado por OTRO viaje se reporta como conflicto
        // puntual; los que siguen libres se aplican igual.
        const conflictos: AssignDeliveriesConflict[] = [];
        const libres: DeliveryId[] = [];
        for (const deliveryId of candidateIds) {
          const owner = findTripContainingDelivery(deliveryId);
          if (owner && owner.id !== tripId) {
            conflictos.push({ deliveryId, asignadoATripId: owner.id });
          } else {
            libres.push(deliveryId);
          }
        }

        const paradasConAsignacion = trip.paradas.map((s) =>
          s.id === stopId ? { ...s, deliveryIds: [...new Set([...s.deliveryIds, ...libres])] } : s
        );
        const capacidadUsada = computeCapacidadUsada(paradasConAsignacion);
        const vehicle = getVehicleById(trip.vehicleId);
        const sobrecargado = vehicle !== undefined && excedeCapacidad(capacidadUsada, vehicle.capacidad);

        if (sobrecargado && !options.forzar) {
          return { success: false, reason: 'exceeds-capacity' as const };
        }
        if (sobrecargado && options.forzar && !options.forzar.motivo.trim()) {
          return { success: false, reason: 'motivo-requerido' as const };
        }

        const now = nowISO();
        const overrideEvent: CapacityOverrideEvent[] = sobrecargado
          ? [{ quien, cuando: now, motivo: options.forzar!.motivo, deltaBultos: capacidadUsada.bultos - (vehicle?.capacidad.bultos ?? 0) }]
          : [];

        const updated: Trip = {
          ...trip,
          paradas: paradasConAsignacion,
          version: trip.version + 1,
          capacidadUsada,
          sobrecargado,
          overrides: [...trip.overrides, ...overrideEvent],
          updatedAt: now,
        };
        tripsStore = tripsStore.map((t) => (t.id === tripId ? updated : t));

        return {
          success: true,
          trip: structuredClone(withComputedFields(updated)),
          conflictos: conflictos.length > 0 ? conflictos : undefined,
          asignados: libres,
        };
      }),
  });
}

// ============================================================
// Maquina de estados del viaje (ADR-011, mismo patron que
// transitionDelivery en deliveries.service.ts)
// ============================================================

export type TransitionTripReason = 'not-found' | 'invalid-transition';

export interface TransitionTripResult {
  success: boolean;
  tripId: string;
  previousStatus?: TripStatus;
  newStatus?: TripStatus;
  reason?: TransitionTripReason;
}

// Sin historial de eventos propio para Trip en esta tanda (a
// diferencia de Delivery.historial, ADR-002) — no esta pedido por
// ADR-011 ni por la tarea. `quien` se recibe igual (misma firma que
// transitionDelivery) para cuando se agregue, sin usarse todavia.
export async function transitionTrip(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  hasta: TripStatus,
  quien: string
): Promise<TransitionTripResult> {
  return httpClient.request<TransitionTripResult>({
    method: 'PUT',
    path: `/trips/${tripId}/transition`,
    body: { empresaId, idempotencyKey, hasta, quien },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        void quien;
        const trip = tripsStore.find((t) => t.id === tripId);
        if (!trip) {
          return { success: false, tripId, reason: 'not-found' as const };
        }
        if (!puedeTransicionarViaje(trip.estado, hasta)) {
          return { success: false, tripId, previousStatus: trip.estado, reason: 'invalid-transition' as const };
        }

        const previousStatus = trip.estado;
        const updated: Trip = { ...trip, estado: hasta, version: trip.version + 1, updatedAt: nowISO() };
        tripsStore = tripsStore.map((t) => (t.id === tripId ? updated : t));

        return { success: true, tripId, previousStatus, newStatus: hasta };
      }),
  });
}

// ============================================================
// Reordenar paradas (ADR-011 seccion 5): orden manual, sin
// optimizador — updateStopOrder solo reescribe `orden` segun la
// posicion del array recibido, nunca calcula una secuencia.
// ============================================================

export type UpdateStopOrderReason = 'not-found' | 'stops-mismatch';

export interface UpdateStopOrderResult {
  success: boolean;
  trip?: Trip;
  reason?: UpdateStopOrderReason;
}

export async function updateStopOrder(empresaId: string, tripId: TripId, stops: StopId[]): Promise<UpdateStopOrderResult> {
  return httpClient.request<UpdateStopOrderResult>({
    method: 'PUT',
    path: `/trips/${tripId}/stops/order`,
    body: { empresaId, stops },
    mock: () => {
      const trip = tripsStore.find((t) => t.id === tripId);
      if (!trip) {
        return { success: false, reason: 'not-found' as const };
      }
      if (stops.length !== trip.paradas.length || !stops.every((id) => trip.paradas.some((s) => s.id === id))) {
        return { success: false, reason: 'stops-mismatch' as const };
      }

      const paradas = stops.map((stopId, index) => {
        const stop = trip.paradas.find((s) => s.id === stopId)!;
        return { ...stop, orden: index + 1 };
      });
      const updated: Trip = { ...trip, paradas, version: trip.version + 1, updatedAt: nowISO() };
      tripsStore = tripsStore.map((t) => (t.id === tripId ? updated : t));

      return { success: true, trip: structuredClone(withComputedFields(updated)) };
    },
  });
}

// ============================================================
// POD (ADR-010 seccion 7 / ADR-011): graba el POD (delegado a
// pod.service.ts, que ya tiene el store propio) y dispara la
// confirmacion de entrega fisica — marca la Delivery FINALIZADO si
// todavia no lo estaba (via transitionDelivery, deliveries.service.ts)
// y la Parada 'Visitada'.
// ============================================================

export type RegisterPodReason = 'not-found' | 'delivery-not-found';

export interface RegisterPodResult {
  success: boolean;
  trip?: Trip;
  reason?: RegisterPodReason;
  // Fase C (hallazgo propio): el intento de marcar la Delivery
  // FINALIZADO puede fallar (ej. todavia esta en CREADO, nunca salio a
  // EN_TRANSITO — transitionDelivery no permite ese salto directo,
  // deliveryStatus.types.ts). El POD en si (evidencia fisica) SI queda
  // registrado igual — es un hecho ya ocurrido, no se descarta por
  // esto (mismo criterio que 'propagation-failed' en
  // deliveries.service.ts#registrarEntrega) — pero `success: true` sin
  // este campo mentiria sobre un efecto que en realidad no se aplico.
  deliveryFinalized: boolean;
}

export async function registerPod(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  deliveryId: DeliveryId,
  stopId: StopId,
  input: PodInput,
  quien: string
): Promise<RegisterPodResult> {
  return httpClient.request<RegisterPodResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/pod`,
    body: { empresaId, idempotencyKey, deliveryId, stopId, ...input, creadoPor: quien },
    mock: () =>
      withIdempotency(idempotencyKey, async () => {
        const trip = tripsStore.find((t) => t.id === tripId);
        const stop = trip?.paradas.find((s) => s.id === stopId);
        if (!trip || !stop || !stop.deliveryIds.includes(deliveryId)) {
          return { success: false, reason: 'not-found' as const, deliveryFinalized: false };
        }
        const delivery = getDeliveryById(deliveryId);
        if (!delivery) {
          return { success: false, reason: 'delivery-not-found' as const, deliveryFinalized: false };
        }

        await registerPodEvidence(empresaId, deliveryId, stopId, input, quien);

        // "si no lo estaba" (tarea): FINALIZADO ya alcanzado (ej. via
        // registrarEntrega) no se reintenta — transitionDelivery con la
        // misma clave ya es idempotente igual, pero se evita el llamado
        // de mas cuando el estado actual ya no admite la transicion.
        //
        // Fase C (hallazgo propio): si la Delivery todavia esta CREADO
        // (nunca salio a EN_TRANSITO), transitionDelivery a FINALIZADO
        // no esta permitido (deliveryStatus.types.ts) y el intento
        // falla — antes esto se ignoraba en silencio y el POD reportaba
        // `success: true` sin aclarar que el efecto derivado (finalizar
        // la entrega) no se aplico. El POD (evidencia fisica) se
        // guarda igual — es un hecho ya ocurrido, mismo criterio que
        // 'propagation-failed' en registrarEntrega — pero
        // `deliveryFinalized` ahora dice la verdad sobre ese efecto.
        const deliveryFinalized =
          delivery.status === 'FINALIZADO' ||
          (await transitionDelivery(empresaId, `${idempotencyKey}-finalizar`, deliveryId, 'FINALIZADO', quien)).success;

        const paradas = trip.paradas.map((s) => (s.id === stopId ? { ...s, estado: 'Visitada' as const } : s));
        const updated: Trip = { ...trip, paradas, updatedAt: nowISO() };
        tripsStore = tripsStore.map((t) => (t.id === tripId ? updated : t));

        return { success: true, trip: structuredClone(withComputedFields(updated)), deliveryFinalized };
      }),
  });
}

// ============================================================
// "Entrega no realizada" (ADR-013 seccion 3): el chofer llego a la
// direccion de la Parada y no pudo entregar nada — es un hecho de la
// PARADA (ADR-010: "una visita fisica"), no de una Delivery aislada,
// por eso el disparador vive en TripDetailPanel.tsx, no en
// DeliveriesTable.tsx (que sigue siendo ReprogramarModal, una
// reprogramacion "administrativa" sin viaje en curso).
//
// Reusa reprogramDelivery (motivoTipo 'no-entrega') por cada entrega de
// la Parada en vez de duplicar la maquina de transiciones — eso ya
// libera cada entrega de esta misma Parada como efecto secundario
// (ADR-013 seccion 1), asi que no hace falta vaciar `deliveryIds` a
// mano aca. Sin campo de motivo propio en Stop: el motivo real queda
// en Delivery.reprogramaciones de cada entrega (ver ADR-013,
// "alternativas descartadas" — duplicarlo en Stop seria una segunda
// fuente de verdad para el mismo hecho).
// ============================================================

export interface MarkStopNoVisitadaInput {
  motivoCodigo: string;
  motivoOtroTexto?: string;
  fechaNueva: string; // ISO date (yyyy-MM-dd) — proximo intento
}

// Tanda 13 — HALLAZGO ALTO corregido (enmienda ADR-013): antes esta
// funcion no validaba NADA antes de reprogramar — se podia llamar
// sobre una Parada ya 'Visitada' (con POD registrado) o sobre un viaje
// 'Planificado'/'Rendido'/'Cancelado', y devolvia `success: true`
// marcando la Parada 'NoVisitada' aunque TODAS las reprogramaciones de
// sus entregas fallaran. Las 4 primeras razones vienen de
// getStopNoVisitadaBlockReason (unica fuente de la regla, compartida
// con el chequeo client-side de TripDetailPanel.tsx — ver
// shared/utils/stopVisitEligibility.ts); 'reprogram-failed' es nueva:
// si CUALQUIER reprogramDelivery de la Parada falla, la Parada NO se
// marca NoVisitada (ver el comentario en el cuerpo de la funcion sobre
// por que las entregas que SI tuvieron exito no se revierten).
export type MarkStopNoVisitadaReason =
  | 'not-found'
  | 'trip-not-en-curso'
  | 'stop-not-pendiente'
  | 'no-deliveries'
  | 'delivery-en-estado-terminal'
  | 'reprogram-failed';

export interface MarkStopNoVisitadaDeliveryResult {
  deliveryId: DeliveryId;
  success: boolean;
}

export interface MarkStopNoVisitadaResult {
  success: boolean;
  trip?: Trip;
  reason?: MarkStopNoVisitadaReason;
  resultadosPorEntrega?: MarkStopNoVisitadaDeliveryResult[];
}

export async function markStopNoVisitada(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  stopId: StopId,
  input: MarkStopNoVisitadaInput,
  quien: string
): Promise<MarkStopNoVisitadaResult> {
  return httpClient.request<MarkStopNoVisitadaResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/no-visitada`,
    body: { empresaId, idempotencyKey, ...input },
    mock: async () => {
      const trip = tripsStore.find((t) => t.id === tripId);
      const stop = trip?.paradas.find((s) => s.id === stopId);
      if (!trip || !stop) {
        return { success: false, reason: 'not-found' as const };
      }

      // Precondiciones (Tanda 13, hallazgo ALTO) — fuera de
      // withIdempotency a proposito, mismo criterio que
      // reprogramDelivery: un `success: false` nunca se cachea (ver
      // withIdempotency), asi que revalidar aca o adentro es
      // funcionalmente identico, pero afuera deja mas claro que estos
      // chequeos SIEMPRE corren de nuevo en cada intento, nunca se
      // saltan por una clave repetida.
      const deliveries: Delivery[] = stop.deliveryIds
        .map((id) => getDeliveryById(id))
        .filter((d): d is Delivery => d !== undefined);
      const blockReason = getStopNoVisitadaBlockReason(trip, stop, deliveries);
      if (blockReason) {
        return { success: false, reason: blockReason };
      }

      return withIdempotency(idempotencyKey, async () => {
        // Sub-clave por entrega, mismo criterio que registerPod
        // (`${idempotencyKey}-finalizar`) — cada llamado a
        // reprogramDelivery necesita su propia clave, la misma clave
        // repetida N veces cachearia solo el primer resultado para las
        // N entregas.
        const resultadosPorEntrega: MarkStopNoVisitadaDeliveryResult[] = [];
        for (const deliveryId of stop.deliveryIds) {
          const result = await reprogramDelivery(empresaId, `${idempotencyKey}-${deliveryId}`, deliveryId, {
            fechaNueva: input.fechaNueva,
            motivoCodigo: input.motivoCodigo,
            motivoOtroTexto: input.motivoOtroTexto,
            motivoTipo: 'no-entrega',
            responsable: quien,
            tripId,
            stopId,
          });
          resultadosPorEntrega.push({ deliveryId, success: result.success });
        }

        // Tanda 13 (hallazgo ALTO): si CUALQUIER reprogramacion fallo,
        // la Parada NO se marca NoVisitada — un "exito parcial" no es
        // un hecho real de negocio ("no se pudo entregar NADA en esta
        // parada"), es una mezcla ambigua. Las entregas que SI tuvieron
        // exito quedan reprogramadas igual (reprogramDelivery ya aplico
        // ese cambio, es un hecho fisico — mismo criterio de "no se
        // deshace" que registrarEntrega/registerPod en Tanda 8/10B):
        // no hay rollback real en este mock, y agregar uno solo para
        // este caso de borde no fue pedido. `resultadosPorEntrega`
        // queda en la respuesta para que quien llama sepa exactamente
        // que entregas reprogramo y cuales no, y pueda reintentar sobre
        // las que fallaron.
        if (resultadosPorEntrega.some((r) => !r.success)) {
          return { success: false, reason: 'reprogram-failed' as const, resultadosPorEntrega };
        }

        // trip pudo cambiar (capacidadUsada/version) por cada
        // liberacion de entrega de arriba (releaseDeliveryFromTrip,
        // ADR-013 seccion 1) — se relee de tripsStore, no se reusa la
        // referencia `trip` de antes del loop.
        const tripActualizado = tripsStore.find((t) => t.id === tripId)!;
        const paradas = tripActualizado.paradas.map((s) => (s.id === stopId ? { ...s, estado: 'NoVisitada' as const } : s));
        const updated: Trip = { ...tripActualizado, paradas, updatedAt: nowISO() };
        tripsStore = tripsStore.map((t) => (t.id === tripId ? updated : t));

        return { success: true, trip: structuredClone(withComputedFields(updated)), resultadosPorEntrega };
      });
    },
  });
}

// ============================================================
// Posicion en vivo (ADR-011 seccion 4). Enmienda 2026-09-09 de
// ADR-003: todo "tiempo real" pasa por useLiveQuery, nunca un
// setInterval paralelo — useLiveQuery esta construido sobre
// usePagedQuery (PageQuery/PageResult). Un punto de posicion no es
// una lista, pero envolverlo como una "pagina de 1 elemento" permite
// reusar exactamente el mismo mecanismo de polling (intervalMs
// configurable, refetchIntervalInBackground:false) sin inventar un
// hook de polling paralelo — decision tomada sin ADR propio (regla 2.9
// del protocolo), documentada aca porque ADR-011 seccion 4 describe el
// payload como "un solo punto" sin especificar como se conecta al
// mecanismo de tiempo real ya existente.
// ============================================================

export interface TripPositionQueryFilters {
  empresaId: string;
  tripId: TripId;
}

export async function getTripPosition(
  query: PageQuery<TripPositionQueryFilters>,
  signal?: AbortSignal
): Promise<PageResult<TripPosition, undefined>> {
  const { tripId, empresaId } = query.filters;
  return httpClient.request<PageResult<TripPosition, undefined>>({
    method: 'GET',
    path: `/trips/${tripId}/posicion`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = tripsStore.find((t) => t.id === tripId);
      const items = trip?.posicionActual ? [trip.posicionActual] : [];
      return { items, total: items.length, page: 1, pageSize: 1 };
    },
  });
}

// ============================================================
// Recorrido historico (ADR-011 seccion 4): bajo demanda, simplificado
// server-side, techo MAX_ROUTE_POINTS. Sin almacenamiento real de
// trazas GPS en este mock (no hay dispositivo real empujando
// posiciones) — se sintetiza una traza corta y deterministica a partir
// de posicionActual para que el endpoint tenga algo real que devolver
// y decimar, documentado como simulacion (no hay traza cruda que
// decimar de verdad todavia).
// ============================================================

export async function getTripRoute(empresaId: string, tripId: TripId, signal?: AbortSignal): Promise<TripPosition[]> {
  return httpClient.request<TripPosition[]>({
    method: 'GET',
    path: `/trips/${tripId}/recorrido`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = tripsStore.find((t) => t.id === tripId);
      if (!trip?.posicionActual) return [];

      const { lat, lng, timestampServidor } = trip.posicionActual;
      const base = new Date(timestampServidor).getTime();
      const synthetic: TripPosition[] = Array.from({ length: 5 }, (_, i) => ({
        lat: lat - (4 - i) * 0.002,
        lng: lng - (4 - i) * 0.002,
        timestampDispositivo: new Date(base - (4 - i) * 5 * 60_000).toISOString(),
        timestampServidor: new Date(base - (4 - i) * 5 * 60_000).toISOString(),
      }));
      return synthetic.slice(0, MAX_ROUTE_POINTS);
    },
  });
}
