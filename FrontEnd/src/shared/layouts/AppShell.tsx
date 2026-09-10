import { useState, useCallback, useEffect, Suspense, type FC } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { LoadingState } from '@/shared/components/ui/LoadingState';
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
              fallback de una ruta que ya abandono. Tambien atrapa un
              fallo de carga del chunk lazy (ej. sin red). */}
          <ErrorBoundary
            resetKey={location.pathname}
            fallbackTitle="Ocurrio un error al mostrar esta pantalla."
            fallbackMessage="Intenta de nuevo o volve al inicio."
          >
            {/* Suspense unico (Tanda 10A, ADR-012) para las rutas lazy
                de AppRoutes.tsx. Va ADENTRO del ErrorBoundary de arriba
                y ENVOLVIENDO solo <Outlet/> (no en AppRoutes.tsx
                envolviendo <Routes>) a proposito: Sidebar/Header no son
                lazy, asi que si el Suspense estuviera mas arriba de
                AppShell, cada navegacion entre rutas lazy tiraria
                abajo todo el shell (sidebar incluido) mientras carga
                el chunk. Aca el fallback solo reemplaza el contenido. */}
            <Suspense fallback={<LoadingState message="Cargando modulo..." />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
