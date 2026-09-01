import { useEffect, useState, useMemo, type FC } from 'react';
import { toast } from 'sonner';
import type { ClientAccount } from '@/shared/types/client.types';
import { fetchClients, createClient, updateClient, type ClientFormInput } from '@/services/mock/clients.service';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { ClientActionBar } from './components/ClientActionBar';
import { ClientFilters } from './components/ClientFilters';
import { ClientDirectoryTable } from './components/ClientDirectoryTable';
import { ClientAccountsTable } from './components/ClientAccountsTable';
import { ClientOverdueTable } from './components/ClientOverdueTable';
import { CreateClientModal } from './components/create-client/CreateClientModal';
import './ClientsPage.css';

// ============================================================
// ClientsPage — Main Clients Module Container
// "Cuentas Corrientes" y "Clientes Morosos" se autoconsultan contra el
// contrato de paginacion server-side (ver ClientAccountsTable/
// ClientOverdueTable) — reciben `search` ya debounced (M6), no el
// array completo. "Directorio de Contacto" sigue filtrando en memoria
// (fuera de alcance de esta tarea): usa `searchQuery` sin debounce
// porque filtrar un array ya cargado es instantaneo, no dispara ningun
// fetch que debounce tenga sentido de frenar.
// ============================================================

type ActiveTab = 'directory' | 'accounts' | 'overdue';

// M6: debounce generico (useDebouncedValue) para no disparar un fetch
// por tecla contra un dataset de decenas de miles de cuentas. Vive en
// ClientsPage (no dentro de cada tab) porque las dos tabs paginadas
// comparten el mismo input de busqueda de arriba — un solo debounce,
// no uno por tab.
const SEARCH_DEBOUNCE_MS = 300;

export const ClientsPage: FC = () => {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [zone, setZone] = useState('');
  const [seller, setSeller] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    fetchClients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el listado de clientes.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // RF-CLI-001: Alta / Modificacion de cliente contra el mock service
  // (persiste en memoria durante la sesion, ver services/mock/clients.service.ts).
  const handleSaveClient = async (input: ClientFormInput, clientId?: string) => {
    if (clientId) {
      const updated = await updateClient(clientId, input);
      setClients(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      return updated;
    }
    const created = await createClient(input);
    setClients(prev => [...prev, created]);
    return created;
  };

  // Filter Logic
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchSearch = c.clientName.toLowerCase().includes(q) || c.cuit.includes(q);
      const matchZone = zone === '' || c.zone === zone;
      const matchSeller = seller === '' || c.sellerName === seller;
      const matchStatus = status === '' || c.status === status;
      return matchSearch && matchZone && matchSeller && matchStatus;
    });
  }, [clients, searchQuery, zone, seller, status]);

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
          <ClientDirectoryTable clients={filteredClients} />
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
