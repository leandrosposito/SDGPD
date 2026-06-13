import { useState, useCallback, type FC } from 'react';
import { Outlet } from 'react-router-dom';
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

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

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
