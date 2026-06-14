import { useState, useMemo, type FC } from 'react';
import { CLIENTS_MOCK_DATA } from '../../data/mock/clients.data';
import { ClientActionBar } from './components/ClientActionBar';
import { ClientFilters } from './components/ClientFilters';
import { ClientDirectoryTable } from './components/ClientDirectoryTable';
import { ClientAccountsTable } from './components/ClientAccountsTable';
import { CreateClientModal } from './components/create-client/CreateClientModal';
import './ClientsPage.css';

// ============================================================
// ClientsPage — Main Clients Module Container
// ============================================================

type ActiveTab = 'directory' | 'accounts';

export const ClientsPage: FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [zone, setZone] = useState('');
  const [seller, setSeller] = useState('');
  const [status, setStatus] = useState('');

  // Filter Logic
  const filteredClients = useMemo(() => {
    return CLIENTS_MOCK_DATA.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchSearch = c.clientName.toLowerCase().includes(q) || c.cuit.includes(q);
      const matchZone = zone === '' || c.zone === zone;
      const matchSeller = seller === '' || c.sellerName === seller;
      const matchStatus = status === '' || c.status === status;
      return matchSearch && matchZone && matchSeller && matchStatus;
    });
  }, [searchQuery, zone, seller, status]);

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
      </div>

      <div className="clients-page__content mt-4">
        {activeTab === 'directory' && (
          <ClientDirectoryTable clients={filteredClients} />
        )}
        {activeTab === 'accounts' && (
          <ClientAccountsTable clients={filteredClients} />
        )}
      </div>

      <CreateClientModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
