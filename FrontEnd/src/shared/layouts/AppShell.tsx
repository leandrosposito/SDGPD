import { useState, useCallback, useEffect, type FC } from 'react';
import { Outlet } from 'react-router-dom';
import { useSessionStore } from '@/shared/state/useSessionStore';
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};
