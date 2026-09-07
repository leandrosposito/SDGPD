import { useEffect, useState, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import type { ClientAccount } from '@/shared/types/client.types';
import {
  getClientsPage,
  createClient,
  updateClient,
  exportClients,
  type ClientFormInput,
  type ClientsQueryFilters,
} from './api/clients.service';
import type { ExportColumn } from '@/shared/components/ui/ExportButton';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
import { useUrlListState } from '@/shared/hooks/useUrlListState';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Pagination } from '@/shared/components/ui/Pagination';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { FetchingOverlay } from '@/shared/components/ui/FetchingOverlay';
import { ClientActionBar } from './components/ClientActionBar';
import { ClientFilters } from './components/ClientFilters';
import { ClientDirectoryTable } from './components/ClientDirectoryTable';
import { ClientAccountsTable } from './components/ClientAccountsTable';
import { ClientOverdueTable } from './components/ClientOverdueTable';
import { CreateClientModal } from './components/create-client/CreateClientModal';
import './ClientsPage.css';

// ============================================================
// ClientsPage — Main Clients Module Container (Tanda 3d de
// escalabilidad: el Directorio de Contacto migró de useCachedQuery +
// filtrado en memoria a usePagedQuery server-side).
//
// Las 3 pestañas se autoconsultan contra el contrato de paginación
// server-side (ver ClientDirectoryTable/ClientAccountsTable/
// ClientOverdueTable) — reciben `search` ya debounced (M6), no el
// array completo. Zona/vendedor/estado del filtro superior siguen
// aplicando SOLO al Directorio (decisión ya vigente antes de esta
// tanda, ver DECISIONES_TECNICAS.md): Cuentas Corrientes/Clientes
// Morosos no los soportan en su contrato paginado.
// ============================================================

type ActiveTab = 'directory' | 'accounts' | 'overdue';

// M6: debounce generico (useDebouncedValue) para no disparar un fetch
// por tecla contra un dataset de decenas de miles de cuentas. Vive en
// ClientsPage (no dentro de cada tab) porque las dos tabs paginadas
// comparten el mismo input de busqueda de arriba — un solo debounce,
// no uno por tab.
const SEARCH_DEBOUNCE_MS = 300;

const TAB_VALUES: readonly ActiveTab[] = ['directory', 'accounts', 'overdue'];

function isActiveTab(value: string | undefined): value is ActiveTab {
  return TAB_VALUES.includes(value as ActiveTab);
}

const directoryExportColumns: ExportColumn<ClientAccount>[] = [
  { header: 'Razon Social', accessor: (c) => c.clientName },
  { header: 'CUIT', accessor: (c) => c.cuit },
  { header: 'Direccion', accessor: (c) => c.address },
  { header: 'Telefono', accessor: (c) => c.phone },
  { header: 'Zona', accessor: (c) => c.zone },
  { header: 'Vendedor', accessor: (c) => c.sellerName },
  { header: 'Limite de Credito', accessor: (c) => c.creditLimit },
  { header: 'Saldo Actual', accessor: (c) => c.currentBalance },
  { header: 'Estado', accessor: (c) => c.status },
];

export const ClientsPage: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Tanda 4 (corrida completa, A13): tab activa, busqueda/zona/vendedor/
  // estado (compartidos por las 3 tabs, ver comentario de cabecera) y la
  // pagina del Directorio viven en la URL, sin prefijo — es el filtro
  // "principal" de la pagina. Cuentas Corrientes/Morosos tienen su
  // propia pagina prefijada (`acc_`/`over_`) en sus propios componentes,
  // pero comparten esta misma busqueda via prop `search`, igual que antes.
  const urlState = useUrlListState<never, 'q' | 'zone' | 'seller' | 'status' | 'tab'>({
    filterKeys: ['q', 'zone', 'seller', 'status', 'tab'],
  });

  const activeTab: ActiveTab = isActiveTab(urlState.filters.tab) ? urlState.filters.tab : 'directory';
  const setActiveTab = (tab: ActiveTab) => urlState.setFilter('tab', tab === 'directory' ? undefined : tab);

  const [searchQuery, setSearchQuery] = useState(urlState.filters.q ?? '');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const current = urlState.filters.q ?? '';
    if (debouncedSearchQuery !== current) {
      urlState.setFilter('q', debouncedSearchQuery || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al valor debounceado
  }, [debouncedSearchQuery]);

  // V3 de VERIFICACION_CORRIDA_COMPLETA.md: si la URL cambia externamente
  // (back/forward del navegador) mientras el componente sigue montado,
  // el input debe reflejarlo — sin este efecto quedaba mostrando texto
  // viejo aunque el listado ya se hubiera re-filtrado segun la URL real.
  useEffect(() => {
    // Microtask (mismo patron ya usado en ReprogramarModal/AlertsBell/
    // RegistrarEntregaModal) para no disparar setState sincronico en
    // el cuerpo del efecto.
    Promise.resolve().then(() => setSearchQuery(urlState.filters.q ?? ''));
  }, [urlState.filters.q]);

  const zone = urlState.filters.zone ?? '';
  const setZone = (value: string) => urlState.setFilter('zone', value || undefined);
  const seller = urlState.filters.seller ?? '';
  const setSeller = (value: string) => urlState.setFilter('seller', value || undefined);
  const status = urlState.filters.status ?? '';
  const setStatus = (value: string) => urlState.setFilter('status', value || undefined);

  // Directorio de Clientes (Tanda 3d): usePagedQuery server-side,
  // reemplaza al useCachedQuery + filtrado en memoria de Tanda 2.5.
  // Los filtros de zona/vendedor/estado, que antes corrian en memoria
  // acá (filteredClients), pasan al service — igual que la busqueda,
  // ahora debounced (antes el Directorio no debounceaba: filtrar en
  // memoria era instantaneo, pero ahora dispara una consulta real).
  const directoryFilters: ClientsQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      search: urlState.filters.q || undefined,
      zone: urlState.filters.zone || undefined,
      seller: urlState.filters.seller || undefined,
      status: (urlState.filters.status || undefined) as ClientAccount['status'] | undefined,
    }),
    [empresaId, urlState.filters.q, urlState.filters.zone, urlState.filters.seller, urlState.filters.status]
  );

  const {
    items: clients,
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
  } = usePagedQuery(getClientsPage, directoryFilters, {
    enabled: Boolean(empresaId),
    page: urlState.page,
    onPageChange: urlState.setPage,
  });

  useEffect(() => {
    if (error) toast.error('No se pudo cargar el listado de clientes.');
  }, [error]);

  // RF-CLI-001: Alta / Modificacion de cliente contra el service nuevo
  // (persiste en memoria durante la sesion, ver modules/clients/api/clients.service.ts).
  // P10 (DECISIONES_TECNICAS.md): tras guardar se vuelve a pedir la
  // pagina vigente del Directorio (refetch), en vez de la invalidacion
  // de useCachedQuery que usaba Tanda 2.5 — mismo criterio que el
  // resto de los listados ya migrados a usePagedQuery.
  const handleSaveClient = async (input: ClientFormInput, clientId?: string) => {
    if (!empresaId) throw new Error('Todavia no hay una sesion activa.');
    if (clientId) {
      const updated = await updateClient(empresaId, clientId, input);
      refetch();
      return updated;
    }
    const created = await createClient(empresaId, input);
    refetch();
    return created;
  };

  return (
    <div className="clients-page page-enter">
      <header className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-header__title">Clientes</h2>
          <p className="page-header__subtitle">Directorio comercial y gestion de cuentas corrientes</p>
        </div>
        <ClientActionBar
          onNewClient={() => setIsCreateModalOpen(true)}
          exportColumns={directoryExportColumns}
          exportRows={() => exportClients(directoryFilters)}
        />
      </header>

      <ClientFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zone={zone}
        onZoneChange={setZone}
        seller={seller}
        onSellerChange={setSeller}
        status={status}
        onStatusChange={setStatus}
      />

      <div className="client-tabs">
        <button 
          className={`client-tab ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          Directorio de Contacto
        </button>
        <button
          className={`client-tab ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          Cuentas Corrientes
        </button>
        <button
          className={`client-tab ${activeTab === 'overdue' ? 'active' : ''}`}
          onClick={() => setActiveTab('overdue')}
        >
          Clientes Morosos
        </button>
      </div>

      <div className="clients-page__content mt-4">
        {activeTab === 'directory' && (
          !empresaId || isLoading ? (
            <LoadingState message="Cargando directorio de clientes..." />
          ) : error ? (
            <ErrorState message="No se pudo cargar el directorio de clientes." onRetry={refetch} />
          ) : (
            <ErrorBoundary
              fallbackTitle="No se pudo mostrar el directorio de clientes."
              fallbackMessage="Intenta de nuevo o volve al inicio."
            >
              <FetchingOverlay isFetching={isFetching}>
                <ClientDirectoryTable clients={clients} />
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
          )
        )}
        {activeTab === 'accounts' && (
          <ClientAccountsTable search={debouncedSearchQuery} />
        )}
        {activeTab === 'overdue' && (
          <ClientOverdueTable search={debouncedSearchQuery} />
        )}
      </div>

      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        client={null}
        onSave={handleSaveClient}
      />
    </div>
  );
};
