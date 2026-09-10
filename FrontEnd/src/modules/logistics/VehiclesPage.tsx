import { useEffect, useMemo, useState, type FC } from 'react';
import { toast } from 'sonner';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import type { Vehicle } from '@/shared/types/vehicle.types';
import type { VehicleId } from '@/shared/types/ids.types';
import {
  getVehiclesPage,
  createVehicle,
  updateVehicle,
  toggleVehicleActivo,
  type VehicleFormInput,
  type VehiclesQueryFilters,
  type VehiclesSortField,
} from '@/shared/api/vehicles/vehicles.service';
import { VehiclesTable } from './components/VehiclesTable';
import { VehicleFormModal } from './components/VehicleFormModal';
import './LogisticsAdminPage.css';

// ============================================================
// VehiclesPage — ABM de flota (Tanda 10B, ADR-011). Alcance EMPRESA
// (ver vehicle.types.ts): sin filtro de sucursal, a diferencia de
// TripsPage.
// ============================================================

export const VehiclesPage: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const urlState = useUrlListState<never, 'q'>({ filterKeys: ['q'] });
  const [searchTerm, setSearchTerm] = useState(urlState.filters.q ?? '');

  useEffect(() => {
    if (searchTerm !== (urlState.filters.q ?? '')) urlState.setFilter('q', searchTerm || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacciona solo al input local, mismo patron que SuppliersPage
  }, [searchTerm]);

  const filters = useMemo(() => ({ empresaId: empresaId ?? '', search: urlState.filters.q || undefined }), [empresaId, urlState.filters.q]);

  const {
    items: vehicles,
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
  } = usePagedQuery<Vehicle, VehiclesQueryFilters, VehiclesSortField, undefined>((query, signal) => getVehiclesPage(empresaId ?? '', query, signal), filters, {
    enabled: Boolean(empresaId),
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  const [formTarget, setFormTarget] = useState<Vehicle | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = async (input: VehicleFormInput, vehicleId?: VehicleId) => {
    if (!empresaId) throw new Error('Todavía no hay una sesión activa.');
    const idempotencyKey = crypto.randomUUID();
    const result = vehicleId
      ? await updateVehicle(empresaId, idempotencyKey, vehicleId, input)
      : await createVehicle(empresaId, idempotencyKey, input);
    if (!result.success) throw new Error('No se pudo guardar el vehículo.');
    refetch();
  };

  const handleToggleActivo = async (vehicle: Vehicle) => {
    if (!empresaId) return;
    const idempotencyKey = crypto.randomUUID();
    const result = await toggleVehicleActivo(empresaId, idempotencyKey, vehicle.id);
    if (result.success) {
      toast.success(`Vehículo ${vehicle.patente} ${result.vehicle?.activo ? 'activado' : 'desactivado'}.`);
      refetch();
      return;
    }
    toast.error('No se pudo cambiar el estado del vehículo.');
  };

  return (
    <div className="logistics-admin-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Vehículos</h2>
          <p className="page-header__subtitle">Flota de reparto y capacidad de cada unidad</p>
        </div>
        <div className="page-header__actions">
          <button
            className="logistics-admin-page__btn-primary"
            onClick={() => {
              setFormTarget(null);
              setIsFormOpen(true);
            }}
          >
            Nuevo vehículo
          </button>
        </div>
      </header>

      <div className="logistics-admin-page__filters">
        <input
          type="search"
          className="logistics-admin-page__search"
          placeholder="Buscar por patente o tipo…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="logistics-admin-page__content">
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando vehículos..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de vehículos." onRetry={refetch} />
        ) : (
          <ErrorBoundary fallbackTitle="No se pudo mostrar el listado de vehículos." fallbackMessage="Intenta de nuevo.">
            <FetchingOverlay isFetching={isFetching}>
              <VehiclesTable
                vehicles={vehicles}
                onEdit={(v) => {
                  setFormTarget(v);
                  setIsFormOpen(true);
                }}
                onToggleActivo={handleToggleActivo}
              />
            </FetchingOverlay>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </ErrorBoundary>
        )}
      </div>

      <VehicleFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} vehicle={formTarget} onSave={handleSave} />
    </div>
  );
};
