import { useState, type FC } from 'react';
import { TabCompanyProfile } from './components/tabs/TabCompanyProfile';
import { TabUsersRoles } from './components/tabs/TabUsersRoles';
import { TabCommercial } from './components/tabs/TabCommercial';
import { TabSystemPreferences } from './components/tabs/TabSystemPreferences';
import { TabSubscription } from './components/tabs/TabSubscription';
import { AuditLogWidget } from './components/widgets/AuditLogWidget';
import { BackupWidget } from './components/widgets/BackupWidget';
import './SettingsPage.css';

// ============================================================
// SettingsPage — Root configuration module
// ============================================================

type TabId = 'company' | 'users' | 'commercial' | 'preferences' | 'subscription';

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('company');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'company': return <TabCompanyProfile />;
      case 'users': return <TabUsersRoles />;
      case 'commercial': return <TabCommercial />;
      case 'preferences': return <TabSystemPreferences />;
      case 'subscription': return <TabSubscription />;
      default: return null;
    }
  };

  return (
    <div className="settings-page page-enter">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">Configuración del Sistema</h2>
          <p className="page-header__subtitle">Gestión centralizada de operativas, comerciales y de usuarios</p>
        </div>
      </header>

      <div className="settings-layout">
        
        {/* Left Col: Tabs & Content (75%) */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          
          <nav className="settings-tabs-nav" aria-label="Navegación de Configuración">
            <button 
              className={`settings-tab-btn ${activeTab === 'company' ? 'active' : ''}`}
              onClick={() => setActiveTab('company')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              Perfil Empresa
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Usuarios y Roles
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'commercial' ? 'active' : ''}`}
              onClick={() => setActiveTab('commercial')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="12" y1="2" x2="12" y2="6"></line></svg>
              Comercial
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Preferencias
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'subscription' ? 'active' : ''}`}
              onClick={() => setActiveTab('subscription')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              Suscripción
            </button>
          </nav>

          <main className="settings-content-area">
            {renderTabContent()}
          </main>

        </div>

        {/* Right Col: Widgets Sidebar (25%) */}
        <aside className="settings-widgets-sidebar">
          <BackupWidget />
          <AuditLogWidget />
        </aside>

      </div>
    </div>
  );
};
