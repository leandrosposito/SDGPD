import { useState, useCallback, useEffect, type FC } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import './AppShell.css';

// ============================================================
// AppShell — Root layout composing Sidebar + Header + Content
// ============================================================

interface AppShellProps {
  onRefresh?: () => void;
}

export const AppShell: FC<AppShellProps> = ({ onRefresh }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const loadSession = useSessionStore((s) => s.loadSession);
  const location = useLocation();

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // loadSession es idempotente (ver useSessionStore): seguro aunque
  // este efecto corra dos veces en desarrollo (React StrictMode).
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' app-shell--collapsed' : ''}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="app-shell__main">
        <Header onRefresh={onRefresh} />
        <main id="main-content" className="app-shell__content" tabIndex={-1}>
          {/* Boundary por ruta (D4, DECISIONES_TECNICAS.md): un modulo
              roto no tira el resto de la app (Sidebar/Header siguen
              vivos). resetKey=pathname lo resetea automaticamente al
              navegar, para que el usuario no quede atrapado en el
              fallback de una ruta que ya abandono. */}
          <ErrorBoundary
            resetKey={location.pathname}
            fallbackTitle="Ocurrio un error al mostrar esta pantalla."
            fallbackMessage="Intenta de nuevo o volve al inicio."
          >
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
