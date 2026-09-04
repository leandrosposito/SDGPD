import { useEffect, useState, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import type { ClientAccount } from '@/shared/types/client.types';
import {
  getClientsPage,
  createClient,
  updateClient,
  type ClientFormInput,
  type ClientsQueryFilters,
} from './api/clients.service';
import { usePagedQuery } from '@/shared/hooks/usePagedQuery';
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

export const ClientsPage: FC = () => {
  const empresaId = useSessionStore((s) => s.session?.company.id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [zone, setZone] = useState('');
  const [seller, setSeller] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  // Directorio de Clientes (Tanda 3d): usePagedQuery server-side,
  // reemplaza al useCachedQuery + filtrado en memoria de Tanda 2.5.
  // Los filtros de zona/vendedor/estado, que antes corrian en memoria
  // acá (filteredClients), pasan al service — igual que la busqueda,
  // ahora debounced (antes el Directorio no debounceaba: filtrar en
  // memoria era instantaneo, pero ahora dispara una consulta real).
  const directoryFilters: ClientsQueryFilters = useMemo(
    () => ({
      empresaId: empresaId ?? '',
      search: debouncedSearchQuery || undefined,
      zone: zone || undefined,
      seller: seller || undefined,
      status: (status || undefined) as ClientAccount['status'] | undefined,
    }),
    [empresaId, debouncedSearchQuery, zone, seller, status]
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
  } = usePagedQuery(getClientsPage, directoryFilters, { enabled: Boolean(empresaId) });

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
        <ClientActionBar onNewClient={() => setIsCreateModalOpen(true)} />
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
