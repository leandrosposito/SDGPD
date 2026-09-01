import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

// ============================================================
// Sidebar — Main navigation panel
// ============================================================

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: FC<{ className?: string }>;
}

// SVG icon components — no emoji, corporate style
const IconDashboard: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/>
    <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/>
    <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/>
    <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/>
  </svg>
);

const IconOrders: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconInventory: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconClients: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconSuppliers: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconPurchases: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="1.75"/>
    <circle cx="18" cy="21" r="1" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M2.5 3h2l2.6 12.3a2 2 0 002 1.7h7.8a2 2 0 002-1.7L21 7H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconLogistics: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
  </svg>
);

const IconCash: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.75"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M6 12h.01M18 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconAnalytics: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCollapse: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-dashboard',  label: 'Dashboard',    path: '/',           icon: IconDashboard },
  { id: 'nav-orders',     label: 'Pedidos',       path: '/pedidos',    icon: IconOrders },
  { id: 'nav-inventory',  label: 'Inventario',    path: '/inventario', icon: IconInventory },
  { id: 'nav-clients',    label: 'Clientes',      path: '/clientes',   icon: IconClients },
  { id: 'nav-suppliers',  label: 'Proveedores',   path: '/proveedores',icon: IconSuppliers },
  { id: 'nav-purchases',  label: 'Compras',       path: '/compras',    icon: IconPurchases },
  { id: 'nav-logistics',  label: 'Logistica',     path: '/logistica',  icon: IconLogistics },
  { id: 'nav-cash',       label: 'Caja',          path: '/caja',       icon: IconCash },
  { id: 'nav-analytics',  label: 'Analitica',     path: '/analitica',  icon: IconAnalytics },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  return (
    <aside
      className={`sidebar${isCollapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="Navegacion principal"
    >
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#brand-gradient)"/>
            <path d="M8 20l8-12 8 12H8z" fill="white" opacity="0.9"/>
            <path d="M12 20l4-6 4 6H12z" fill="white" opacity="0.5"/>
            <defs>
              <linearGradient id="brand-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED"/>
                <stop offset="1" stopColor="#A78BFA"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {!isCollapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">DistGestion</span>
            <span className="sidebar__brand-sub">Panel de Control</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav" aria-label="Menu principal">
        <ul className="sidebar__nav-list" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id} className="sidebar__nav-item">
              <NavLink
                id={item.id}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `sidebar__nav-link${isActive ? ' sidebar__nav-link--active' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <item.icon className="sidebar__nav-icon" />
                {!isCollapsed && (
                  <span className="sidebar__nav-label">{item.label}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="sidebar__footer">
        <button
          id="sidebar-collapse-toggle"
          className="sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          title={isCollapsed ? 'Expandir' : 'Contraer'}
        >
          <IconCollapse className={`sidebar__collapse-icon${isCollapsed ? ' sidebar__collapse-icon--rotated' : ''}`} />
          {!isCollapsed && <span>Contraer</span>}
        </button>
      </div>
    </aside>
  );
};
