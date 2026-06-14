import { useState, useEffect, type FC } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

// ============================================================
// Header — Top bar with search and user area
// ============================================================

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

const IconSun: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const IconMoon: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

interface HeaderProps {
  onRefresh?: () => void;
}

export const Header: FC<HeaderProps> = ({ onRefresh }) => {
  // Theme Toggle Logic
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';

    const applyTheme = () => {
      setTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('app-theme', newTheme);
    };

    if (!(document as any).startViewTransition) {
      applyTheme();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(applyTheme);

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  return (
    <header className="header" role="banner">
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
          className="header__action-btn"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          title="Modo Oscuro / Claro"
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>

        <button
          id="header-notifications-btn"
          className="header__action-btn header__action-btn--notify"
          aria-label="Notificaciones (3 nuevas)"
          title="Notificaciones"
        >
          <IconBell />
          <span className="header__notify-badge" aria-hidden="true">3</span>
        </button>

        <Link to="/settings" className="header__user" aria-label="Configuración de Usuario" style={{ textDecoration: 'none' }}>
          <div className="header__avatar" aria-hidden="true">
            <span>AD</span>
          </div>
          <div className="header__user-info">
            <span className="header__user-name">Admin</span>
            <span className="header__user-role">Configuración</span>
          </div>
        </Link>
      </div>
    </header>
  );
};
