import { useEffect, type FC, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/shared/components/ui/LoadingState';
import { ErrorState } from '@/shared/components/ui/ErrorState';
import { AUTH_IS_HTTP, useSessionStore } from '@/shared/state/useSessionStore';

// ============================================================
// RequireSession — guard de rutas (BE-1b). Envuelve a AppShell en
// AppRoutes.tsx, asi que cubre TODAS las rutas de la app salvo /login.
//
// - Auth en mock: no hace nada (la sesion mock la carga AppShell, como antes).
// - Auth por http: al cargar intenta un refresh (useSessionStore.loadSession).
//   Mientras tanto, "Cargando sesion"; si no hay sesion, al login, con la
//   ruta pedida en location.state.from para volver despues.
//
// Solo decide que se muestra: la autorizacion la hace el servidor en cada
// request (sin access token valido, 401).
// ============================================================

interface RequireSessionProps {
  children: ReactNode;
}

export const RequireSession: FC<RequireSessionProps> = ({ children }) => {
  const status = useSessionStore((s) => s.status);
  const loadSession = useSessionStore((s) => s.loadSession);
  const location = useLocation();

  useEffect(() => {
    if (AUTH_IS_HTTP && status === 'idle') void loadSession();
  }, [status, loadSession]);

  if (!AUTH_IS_HTTP) return <>{children}</>;
  if (status === 'authenticated') return <>{children}</>;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (status === 'error') {
    return <ErrorState message="No se pudo cargar la sesion." onRetry={() => window.location.reload()} />;
  }
  return <LoadingState message="Cargando sesion..." />;
};
