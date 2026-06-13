import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import './Header.css';

// ============================================================
// Header — Top bar with page title, search and user area
// ============================================================

const ROUTE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/pedidos':     'Pedidos y Ventas',
  '/inventario':  'Inventario y Categorias',
  '/clientes':    'Directorio de Clientes',
  '/proveedores': 'Gestion de Proveedores',
  '/logistica':   'Logistica y Rutas',
};

const IconSearch: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconBell: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconRefresh: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface HeaderProps {
  onRefresh?: () => void;
}

export const Header: FC<HeaderProps> = ({ onRefresh }) => {
  const { pathname } = useLocation();
  const pageTitle = ROUTE_TITLES[pathname] ?? 'DistGestion';

  return (
    <header className="header" role="banner">
      {/* Left: Page title */}
      <div className="header__left">
        <h1 className="header__title">{pageTitle}</h1>
        <span className="header__date" aria-label="Fecha actual">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      {/* Center: Search */}
      <div className="header__search" role="search">
        <label htmlFor="global-search" className="sr-only">
          Buscar en el sistema
        </label>
        <span className="header__search-icon" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          id="global-search"
          type="search"
          className="header__search-input"
          placeholder="Buscar pedidos, clientes, productos..."
          autoComplete="off"
        />
        <kbd className="header__search-kbd" aria-hidden="true">Ctrl K</kbd>
      </div>

      {/* Right: Actions */}
      <div className="header__actions" role="toolbar" aria-label="Acciones rapidas">
        {onRefresh && (
          <button
            id="header-refresh-btn"
            className="header__action-btn"
            onClick={onRefresh}
            aria-label="Actualizar datos"
            title="Actualizar"
          >
            <IconRefresh />
          </button>
        )}

        <button
          id="header-notifications-btn"
          className="header__action-btn header__action-btn--notify"
          aria-label="Notificaciones (3 nuevas)"
          title="Notificaciones"
        >
          <IconBell />
          <span className="header__notify-badge" aria-hidden="true">3</span>
        </button>

        <div className="header__user" aria-label="Usuario actual">
          <div className="header__avatar" aria-hidden="true">
            <span>AD</span>
          </div>
          <div className="header__user-info">
            <span className="header__user-name">Admin</span>
            <span className="header__user-role">Administrador</span>
          </div>
        </div>
      </div>
    </header>
  );
};
