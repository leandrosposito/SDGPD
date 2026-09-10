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
import type { Driver } from '@/shared/types/driver.types';
import type { DriverId } from '@/shared/types/ids.types';
import {
  getDriversPage,
  createDriver,
  updateDriver,
  toggleDriverActivo,
  type DriverFormInput,
  type DriversQueryFilters,
  type DriversSortField,
} from '@/shared/api/drivers/drivers.service';
import { DriversTable } from './components/DriversTable';
import { DriverFormModal } from './components/DriverFormModal';
import './LogisticsAdminPage.css';

// ============================================================
// DriversPage — ABM de choferes (Tanda 10B, ADR-011). Mismo patron
// que VehiclesPage.tsx.
// ============================================================

export const DriversPage: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);

  const urlState = useUrlListState<never, 'q'>({ filterKeys: ['q'] });
  const [searchTerm, setSearchTerm] = useState(urlState.filters.q ?? '');

  useEffect(() => {
    if (searchTerm !== (urlState.filters.q ?? '')) urlState.setFilter('q', searchTerm || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacciona solo al input local, mismo patron que SuppliersPage
  }, [searchTerm]);

  const filters = useMemo(() => ({ empresaId: empresaId ?? '', search: urlState.filters.q || undefined }), [empresaId, urlState.filters.q]);

  const {
    items: drivers,
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
  } = usePagedQuery<Driver, DriversQueryFilters, DriversSortField, undefined>((query, signal) => getDriversPage(empresaId ?? '', query, signal), filters, {
    enabled: Boolean(empresaId),
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  const [formTarget, setFormTarget] = useState<Driver | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = async (input: DriverFormInput, driverId?: DriverId) => {
    if (!empresaId) throw new Error('Todavía no hay una sesión activa.');
    const idempotencyKey = crypto.randomUUID();
    const result = driverId ? await updateDriver(empresaId, idempotencyKey, driverId, input) : await createDriver(empresaId, idempotencyKey, input);
    if (!result.success) throw new Error('No se pudo guardar el chofer.');
    refetch();
  };

  const handleToggleActivo = async (driver: Driver) => {
    if (!empresaId) return;
    const idempotencyKey = crypto.randomUUID();
    const result = await toggleDriverActivo(empresaId, idempotencyKey, driver.id);
    if (result.success) {
      toast.success(`Chofer ${driver.nombre} ${result.driver?.activo ? 'activado' : 'desactivado'}.`);
      refetch();
      return;
    }
    toast.error('No se pudo cambiar el estado del chofer.');
  };

  return (
    <div className="logistics-admin-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Choferes</h2>
          <p className="page-header__subtitle">Personal habilitado para conducir viajes</p>
        </div>
        <div className="page-header__actions">
          <button
            className="logistics-admin-page__btn-primary"
            onClick={() => {
              setFormTarget(null);
              setIsFormOpen(true);
            }}
          >
            Nuevo chofer
          </button>
        </div>
      </header>

      <div className="logistics-admin-page__filters">
        <input
          type="search"
          className="logistics-admin-page__search"
          placeholder="Buscar por nombre o licencia…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="logistics-admin-page__content">
        {!empresaId || isLoading ? (
          <LoadingState message="Cargando choferes..." />
        ) : error ? (
          <ErrorState message="No se pudo cargar el listado de choferes." onRetry={refetch} />
        ) : (
          <ErrorBoundary fallbackTitle="No se pudo mostrar el listado de choferes." fallbackMessage="Intenta de nuevo.">
            <FetchingOverlay isFetching={isFetching}>
              <DriversTable
                drivers={drivers}
                onEdit={(d) => {
                  setFormTarget(d);
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

      <DriverFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} driver={formTarget} onSave={handleSave} />
    </div>
  );
};
