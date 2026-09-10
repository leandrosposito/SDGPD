import { useMemo, useState, type FC } from 'react';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useCachedQuery, CACHE_STALE_TIME } from '@/shared/hooks/useCachedQuery';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { SkeletonTable } from '@/shared/components/ui/SkeletonLoader';
import type { Trip, TripStatus } from '@/shared/types/trip.types';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { Driver } from '@/shared/types/driver.types';
import type { VehicleId, DriverId } from '@/shared/types/ids.types';
import { getTripsPage, type TripQueryFilters, type TripSortField } from './services/trips.service';
import { fetchActiveVehicles } from '@/shared/api/vehicles/vehicles.service';
import { fetchActiveDrivers } from '@/shared/api/drivers/drivers.service';
import { TripsTable } from './components/TripsTable';
import { TripDetailPanel } from './components/TripDetailPanel';
import { CreateTripModal } from './components/CreateTripModal';
import { TRIP_STATUS_LABEL } from './tripStatusLabels';
import './LogisticsAdminPage.css';

// ============================================================
// TripsPage — Listado de viajes (Tanda 10B, ADR-011). Alcance SUCURSAL
// (branchId de la sesion activa, mismo criterio que LogisticsPage) —
// filtros estado/fecha/vehiculo/chofer viven en la URL.
// ============================================================

const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_DRIVERS: Driver[] = [];
const TRIP_STATUSES: TripStatus[] = ['Planificado', 'Despachado', 'EnTransito', 'Rendido', 'Cancelado'];

export const TripsPage: FC = () => {
  const activeBranchId = useSessionStore((s) => s.activeBranchId);
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const fullName = useSessionStore((s) => s.session?.fullName) ?? 'Usuario';

  const urlState = useUrlListState<never, 'estado' | 'fecha' | 'vehicleId' | 'driverId'>({
    filterKeys: ['estado', 'fecha', 'vehicleId', 'driverId'],
  });

  const { data: vehiclesData } = useCachedQuery('vehicles-active', undefined, (signal) => fetchActiveVehicles(empresaId ?? '', signal), {
    enabled: Boolean(empresaId),
    staleTime: CACHE_STALE_TIME.CATALOG,
  });
  const { data: driversData } = useCachedQuery('drivers-active', undefined, (signal) => fetchActiveDrivers(empresaId ?? '', signal), {
    enabled: Boolean(empresaId),
    staleTime: CACHE_STALE_TIME.CATALOG,
  });
  const vehicles = vehiclesData ?? EMPTY_VEHICLES;
  const drivers = driversData ?? EMPTY_DRIVERS;
  const vehiclesById = useMemo(() => new Map(vehicles.map((v) => [v.id as string, v])), [vehicles]);
  const driversById = useMemo(() => new Map(drivers.map((d) => [d.id as string, d])), [drivers]);

  // Fase C (hallazgo propio corregido en la misma sesion): empresaId y
  // branchId viven DENTRO de `filters`, no como parametros sueltos de
  // fetchPage — usePagedQuery arma la query key de TanStack Query a
  // partir de este objeto (mas el empresaId que lee de la sesion), asi
  // que un branchId fuera de aca queda invisible para la key y un
  // cambio de sucursal activa no dispara refetch (regla 3.4 del
  // protocolo). Ver el comentario de getTripsPage en trips.service.ts.
  const filters: TripQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      branchId: activeBranchId,
      estado: (urlState.filters.estado as TripStatus | undefined) ?? undefined,
      fecha: urlState.filters.fecha,
      vehicleId: urlState.filters.vehicleId as VehicleId | undefined,
      driverId: urlState.filters.driverId as DriverId | undefined,
    }),
    [empresaId, activeBranchId, urlState.filters.estado, urlState.filters.fecha, urlState.filters.vehicleId, urlState.filters.driverId]
  );

  const {
    items: trips,
    page,
    pageSize,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedQuery<Trip, TripQueryFilters, TripSortField, undefined>(getTripsPage, filters, {
    enabled: Boolean(empresaId) && activeBranchId !== null,
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleRowClick = (trip: Trip) => {
    setSelectedTrip(trip);
    setIsPanelOpen(true);
  };

  return (
    <div className="logistics-admin-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Viajes</h2>
          <p className="page-header__subtitle">Asignación de vehículo, chofer y paradas por viaje</p>
        </div>
        <div className="page-header__actions">
          <button className="logistics-admin-page__btn-primary" onClick={() => setIsCreateOpen(true)}>
            Nuevo viaje
          </button>
        </div>
      </header>

      <div className="logistics-admin-page__filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select value={urlState.filters.estado ?? ''} onChange={(e) => urlState.setFilter('estado', e.target.value || undefined)}>
          <option value="">Todos los estados</option>
          {TRIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRIP_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input type="date" value={urlState.filters.fecha ?? ''} onChange={(e) => urlState.setFilter('fecha', e.target.value || undefined)} />
        <select value={urlState.filters.vehicleId ?? ''} onChange={(e) => urlState.setFilter('vehicleId', e.target.value || undefined)}>
          <option value="">Todos los vehículos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
            </option>
          ))}
        </select>
        <select value={urlState.filters.driverId ?? ''} onChange={(e) => urlState.setFilter('driverId', e.target.value || undefined)}>
          <option value="">Todos los choferes</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      {activeBranchId ? (
        <ErrorBoundary fallbackTitle="No se pudo mostrar el listado de viajes." fallbackMessage="Intenta de nuevo.">
          {isLoading ? (
            <LoadingState message="Cargando viajes..." />
          ) : error ? (
            <ErrorState message="No se pudo cargar el listado de viajes." onRetry={refetch} />
          ) : (
            <div className="logistics-admin-page__content">
              <FetchingOverlay isFetching={isFetching}>
                <TripsTable trips={trips} vehiclesById={vehiclesById} driversById={driversById} onRowClick={handleRowClick} />
              </FetchingOverlay>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </ErrorBoundary>
      ) : (
        <div className="logistics-admin-page__content">
          <SkeletonTable rows={6} cols={7} />
        </div>
      )}

      <TripDetailPanel
        trip={selectedTrip}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        vehicle={selectedTrip ? vehiclesById.get(selectedTrip.vehicleId) : undefined}
        driver={selectedTrip ? driversById.get(selectedTrip.driverId) : undefined}
        fullName={fullName}
        onChanged={refetch}
      />

      <CreateTripModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        branchId={activeBranchId}
        vehicles={vehicles}
        drivers={drivers}
        fullName={fullName}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
};
